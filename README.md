# Maze War - Distributed Multiplayer Game

# Demo video

- Video URL: https://youtu.be/pb8Yd65MUH4
- [![Open on youtube](https://img.youtube.com/vi/pb8Yd65MUH4/0.jpg)](https://youtu.be/pb8Yd65MUH4)

## Project Structure

```
maze/
├── main.go                    # Entry point, goroutine setup
├── config.json                # Game configuration
├── internal/
│   ├── game/
│   │   └── engine.go          # Game logic, Run() loop
│   └── server/
│       ├── hub.go             # WebSocket hub, Run() loop
│       └── client.go          # readPump/writePump goroutines
├── pkg/
│   ├── config/
│   │   └── config.go          # Config loader
│   └── models/
│       └── models.go          # Data structures
└── static/
    ├── index.html             # Game UI
    ├── game.js                # Client main
    ├── websocket.js           # WebSocket handling
    ├── input.js               # Input handling
    ├── render.js              # Canvas rendering
    └── style.css              # Styling
```

## Local Usage

```bash
# Build and run
go build -o maze_server .
./maze_server

# Open browser
http://localhost:8080
```

## Architecture

**Client-Server Model** with three main components:

1. **Game Engine** - Authoritative game state
2. **WebSocket Hub** - Connection manager
3. **Web Client** - Browser interface

## Server startup Flow

```
main.go
  ├─► Load config.json
  ├─► Initialize Game Engine
  │     └─► Generate maze using DFS algorithm
  ├─► Start Engine goroutine (go engine.Run())
  ├─► Initialize WebSocket Hub
  ├─► Start Hub goroutine (go hub.Run())
  ├─► Start Bridge goroutine (Engine → Hub broadcast)
  └─► Start HTTP Server (:8080)
        ├─► Static files (/)
        └─► WebSocket endpoint (/ws)
```

## Client Flow

```
1. User opens browser → index.html loads
2. User enters username → clicks "Join"
3. JavaScript establishes WebSocket connection
   └─► ws = new WebSocket("ws://localhost:8080/ws")

4. Server receives connection (hub.go:67-110)
   ├─► Upgrade HTTP to WebSocket
   ├─► Create Client object (ID = RemoteAddr)
   ├─► Register with Hub (hub.register <- client)
   ├─► Register with Engine (engine.Register <- client)
   │     └─► Engine creates Player entity
   └─► Send INIT message to client

5. Client receives INIT message
   ├─► Store: myID, grid, colors, player_speed
   ├─► Start input loop (setInterval every 50ms)
   └─► Render initial maze

6. Game loop starts
   ├─► Client sends inputs (move, shoot, quit)
   ├─► Server processes and updates state
   └─► Server broadcasts state every 50ms
```

## Server Flow

```
Client sends message
  ↓
readPump() receives (client.go:31-62)
  ├─► conn.ReadMessage()
  ├─► json.Unmarshal() → Input struct
  └─► engine.Inputs <- ClientInput{ClientID, Input}
  ↓
Engine.Run() receives from Inputs channel
  ↓
handleInput() processes (engine.go:162-189)
  ├─► Type: "move" → movePlayer()
  ├─► Type: "shoot" → shootBullet()
  ├─► Type: "join" → update player name
  └─► Type: "quit" → mark player inactive
  ↓
Next tick (50ms later)
  ↓
update() executes (engine.go:235-291)
  ├─► Move bullets (4 tiles per tick)
  ├─► Check collisions
  └─► Update cooldowns
  ↓
broadcastState() (engine.go:365-382)
  ├─► Lock state (thread-safe)
  ├─► Marshal to JSON
  ├─► Send to engine.Broadcast channel
  └─► Clear events list
  ↓
Bridge goroutine forwards to Hub
  ↓
Hub broadcasts to all clients
  ↓
writePump() sends to each client (client.go:64-102)
```

## Major Functions

### Engine.Run() - Main Game Loop

**Purpose**: Central event loop for all game logic  
**Goroutine**: Runs in dedicated goroutine

```go
ticker := time.NewTicker(50ms)  // Configurable tick rate

for {
    select {
        case client := <-e.Register:
            // New player joins
            e.addPlayer(client.ID, "Warrior")

        case client := <-e.Unregister:
            // Player disconnects
            e.removePlayer(client.ID)

        case input := <-e.Inputs:
            // Player input (move/shoot/join/quit)
            e.handleInput(input)

        case <-ticker.C:
            // Every 50ms
            e.update()           // Physics & collisions
            e.broadcastState()   // Send to clients
    }
}
```

**Key Properties**:

- **Non-blocking**: Uses `select` to handle multiple channels
- **Sequential**: Only one case executes at a time (no race conditions)
- **Deterministic**: Same inputs always produce same outputs

### update() - Physics Tick

**Purpose**: Update all game entities  
**Called**: Every 50ms by ticker

```go
func (e *Engine) update() {
    e.mu.Lock()
    defer e.mu.Unlock()

    // 1. Update bullets
    activeBullets := []*Bullet{}
    for _, bullet := range e.State.Bullets {
        keep := true

        // Move bullet 4 times (bullet_speed_multiplier)
        for i := 0; i < 4; i++ {
            nextPos := calculateNextPos(bullet)
            bullet.DistanceMoved++

            // Check wall collision
            if isWall(nextPos) {
                keep = false
                break
            }

            // Check player collision
            if hitPlayerID := getPlayerAt(nextPos); hitPlayerID != "" {
                if hitPlayerID != bullet.OwnerID {
                    handleHit(bullet.OwnerID, hitPlayerID)
                    keep = false
                    break
                }
            }

            bullet.Pos = nextPos
        }

        if keep {
            activeBullets = append(activeBullets, bullet)
        }
    }
    e.State.Bullets = activeBullets

    // 2. Update player cooldowns
    for _, player := range e.State.Players {
        if player.Cooldown > 0 {
            player.Cooldown--
        }
    }
}
```

### broadcastState() - State Synchronization

**Purpose**: Send game state to all clients  
**Called**: Every tick after `update()`

```go
func (e *Engine) broadcastState() {
    e.mu.Lock()
    data, _ := json.Marshal(e.State)
    e.mu.Unlock()

    e.Broadcast <- data  // Non-blocking send

    e.mu.Lock()
    e.State.Events = make([]string, 0)  // Clear events
    e.mu.Unlock()
}
```

**Thread Safety**: Uses `sync.RWMutex` for concurrent access

### Hub.Run() - Connection Manager

**Purpose**: Manage WebSocket connections  
**Goroutine**: Runs in dedicated goroutine

```go
for {
    select {
        case client := <-h.register:
            h.clients[client] = true

        case client := <-h.unregister:
            delete(h.clients, client)
            close(client.Send)

        case message := <-h.broadcast:
            for client := range h.clients {
                select {
                    case client.Send <- message:
                        // Success
                    default:
                        // Client buffer full, disconnect
                        close(client.Send)
                        delete(h.clients, client)
                }
            }
    }
}
```

## Event Design

### Example: Player Presses "Move Forward" (Arrow Up)

**Step-by-Step Flow**:

```
┌─────────────────────────────────────────────────────────┐
│ CLIENT SIDE (Browser)                                   │
└─────────────────────────────────────────────────────────┘

1. User presses ↑ key
   └─► keydown event listener
         └─► keys['ArrowUp'] = true

2. Input loop iteration (50ms interval)
   └─► Detect keys['ArrowUp'] === true
         └─► ws.send({"type":"move","data":"up"})

┌─────────────────────────────────────────────────────────┐
│ NETWORK LAYER                                           │
└─────────────────────────────────────────────────────────┘

3. WebSocket frame transmitted over TCP
   └─► JSON: {"type":"move","data":"up"}

┌─────────────────────────────────────────────────────────┐
│ SERVER SIDE (Go Backend)                                │
└─────────────────────────────────────────────────────────┘

4. readPump() goroutine receives message
   └─► conn.ReadMessage()

5. Parse JSON to Input struct
   └─► Input{Type: "move", Data: "up"}

6. Send to Engine input channel
   └─► engine.Inputs <- ClientInput{
         ClientID: "192.168.1.1:12345",
         Input: Input{Type: "move", Data: "up"}
       }

7. Engine.Run() receives from channel
   └─► case input := <-e.Inputs:
         e.handleInput(input)

8. handleInput() processes
   └─► case "move":
         e.movePlayer(player, "up")

9. movePlayer() executes
   ├─► newPos.Y--  (move up)
   ├─► newDir = DirUp
   ├─► Check collision:
   │     ├─► isWall(newPos) → false ✓
   │     └─► isPlayerAt(newPos) → false ✓
   └─► player.Pos = newPos  (update position)

10. Next tick (up to 50ms later)
    └─► case <-ticker.C:
          e.update()
          e.broadcastState()

11. broadcastState() sends to all clients
    └─► JSON: {players: {...}, bullets: [...], events: [...]}

┌─────────────────────────────────────────────────────────┐
│ CLIENT SIDE (All Browsers)                              │
└─────────────────────────────────────────────────────────┘

12. ws.onmessage receives state
    └─► gameState = JSON.parse(event.data)

13. render() draws updated state
    └─► Player appears at new position

```

## Consistency & Correctness

### Move Ordering

**Problem**: Multiple clients sending moves simultaneously

**Solution**: Server-Authoritative Model with Sequential Processing

```
┌─────────────────────────────────────────────────────────┐
│ FIFO ORDERING MECHANISM                                 │
└─────────────────────────────────────────────────────────┘

1. Buffered Input Channel
   └─► Inputs: make(chan ClientInput, 100)
         └─► Queues up to 100 inputs

2. Sequential Processing
   └─► Single goroutine processes one at a time
         └─► FIFO order guaranteed by Go channels

3. Mutex Protection
   └─► e.mu.Lock() before state modification
         └─► Prevents race conditions

4. Atomic State Updates
   └─► Each move completes before next starts
         └─► No partial state visible
```

### Bullet Ordering & Collision Detection

**Problem**: Bullets move 4 tiles/tick, could skip over players

**Solution**: Incremental Movement with Per-Tile Collision Checks

```go
// For each bullet
for i := 0; i < bullet_speed_multiplier; i++ {
    nextPos := calculateNextPos(bullet)
    bullet.DistanceMoved++

    // Check collision at EACH tile
    if isWall(nextPos) {
        remove bullet
        break
    }

    if hitPlayer := getPlayerAt(nextPos); hitPlayer != "" {
        if hitPlayer != bullet.Owner {
            handleHit(bullet.Owner, hitPlayer)
            remove bullet
            break
        }

        // Self-hit protection (first tile)
        if bullet.DistanceMoved > 1 {
            handleHit(bullet.Owner, bullet.Owner)
            remove bullet
            break
        }
    }

    bullet.Pos = nextPos
}
```

### State Synchronization

**Algorithm**: Full State Broadcast with Event Clearing

```
Every 50ms:
1. Lock game state (read)
2. Serialize entire state to JSON
3. Unlock state
4. Send to all clients via Hub
5. Lock state (write)
6. Clear events list (prevent duplicates)
7. Unlock state
```

**Thread Safety**: `sync.RWMutex`

- Multiple goroutines can read simultaneously
- Only one can write (exclusive lock)

## Message Structure

### Client → Server Messages

**1. JOIN** - Set player name

```json
{
  "type": "join",
  "name": "PlayerName"
}
```

- Sent after WebSocket connection
- Updates player name from "Warrior" to actual name
- Broadcasts join event to all clients

**2. MOVE** - Request movement

```json
{
  "type": "move",
  "data": "up"
}
```

- Data values: `"up"`, `"down"`, `"left"`, `"right"`
- Frequency: Up to 20/sec (50ms input loop)
- Server validates collision before applying

**3. SHOOT** - Fire bullet

```json
{
  "type": "shoot"
}
```

- Creates bullet in player's direction
- Cost: -1 point
- Cooldown: 8 ticks (400ms) enforced server-side

**4. QUIT** - Leave game

```json
{
  "type": "quit"
}
```

- Marks player as inactive
- Broadcasts quit event
- Client closes WebSocket connection

### Server → Client Messages

**1. INIT** - Initial game configuration

```json
{
  "type": "init",
  "your_id": "192.168.1.1:12345",
  "grid": [
    [0, 1, 0, 1, ...],  // 16 rows × 32 columns
    [1, 0, 0, 0, ...],
    ...
  ],
  "colors": {
    "self": "lime",
    "rival": "red"
  },
  "player_speed": 50
}
```

- Sent once on connection
- Grid: 0=empty, 1=wall
- Size: ~2KB

**2. GAME STATE** - Regular updates (every 50ms)

```json
{
  "players": {
    "192.168.1.1:12345": {
      "id": "192.168.1.1:12345",
      "name": "Alice",
      "pos": { "x": 15, "y": 8 },
      "dir": 3,
      "score": 42,
      "cooldown": 0,
      "is_active": true
    }
  },
  "bullets": [
    {
      "id": "192.168.1.1:12345-1701878400000",
      "owner_id": "192.168.1.1:12345",
      "pos": { "x": 16, "y": 8 },
      "dir": 3,
      "distance_moved": 4
    }
  ],
  "events": ["Alice hit Bob", "Charlie joined"]
}
```

- Broadcast to all clients every tick
- Events cleared after broadcast
- Size: ~1-3KB depending on player count

## Configuration

Edit `config.json`:

```json
{
  "port": "8080",
  "tick_rate_ms": 50,
  "player_speed_ms": 50,
  "bullet_speed_multiplier": 4,
  "colors": {
    "self_color": "lime",
    "rival_color": "red"
  }
}
```

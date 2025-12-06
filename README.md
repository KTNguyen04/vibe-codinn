# Maze War - Distributed Multiplayer Game

A real-time, web-based multiplayer Maze War game built with Go and WebSockets. Players navigate through a procedurally generated maze, shoot bullets, and compete for the highest score.

## Quick Start - local usage

```bash
# Build and run
go build -o maze_server .
./maze_server

# Open browser
http://localhost:8080
```

## Architecture

**Client-Server Model** with three main components:
1. **Game Engine** (`internal/game/engine.go`) - Authoritative game state
2. **WebSocket Hub** (`internal/server/hub.go`) - Connection manager
3. **Web Client** (`static/game.js`) - Browser interface

### Startup Flow
```
main.go
  ├─► Load config.json
  ├─► Initialize Game Engine (generate maze, start 50ms tick loop)
  ├─► Initialize WebSocket Hub
  └─► Start HTTP Server (:8080)
        ├─► Static files (/)
        └─► WebSocket (/ws)
```

## Game Flow

### Client Connection
```
1. User enters username → Join
2. WebSocket connection established
3. Server sends INIT: {your_id, grid, colors, player_speed}
4. Client starts input loop (50ms) and rendering
```

### Input Processing
```
Client: Press ↑ → Send {"type":"move","data":"up"}
  ↓
Server: Receive → Validate → Update position
  ↓
Server: Broadcast new state to all clients (every 50ms)
  ↓
Client: Receive state → Render on canvas
```

## Core Functions

### Server-Side

**`initMap()`** - Maze Generation
- Algorithm: Depth-First Search (DFS) with recursive backtracking
- Sparsification: Remove 10% of walls randomly
- Result: Connected maze with clear borders

**`update()`** - Game Loop (50ms tick)
- Move bullets (4 tiles/tick)
- Check collisions (wall, player)
- Update cooldowns
- Complexity: O(B × S + P) where B=bullets, S=speed, P=players

**`handleInput()`** - Process player commands
- `move`: Update position if valid (no wall/player collision)
- `shoot`: Create bullet, deduct 1 point, set 8-tick cooldown
- `join`: Update player name, broadcast event
- `quit`: Mark inactive, broadcast quit event

**`handleHit()`** - Collision Resolution
- Victim: -5 points, respawn randomly
- Shooter: +11 points
- Net gain: +6 points per kill (11 - 5 from shooting cost)

### Client-Side

**`render()`** - Canvas Drawing
- Clear canvas
- Draw maze walls (30×30px tiles)
- Draw players (Pac-Man style, lime=self, red=others)
- Draw bullets (circles, color-coded by owner)

**`updateUI()`** - HUD Update
- Sort players by score
- Update scoreboard
- Append color-coded events (green=join, orange=leave, red=hit)

## Consistency & Correctness

### Move Ordering
- **FIFO Processing**: Buffered channel (100 inputs) with sequential processing
- **Mutex Protection**: `sync.RWMutex` prevents race conditions
- **Atomic Updates**: Each move completes before next starts
- **Guarantees**: Consistent game state, no players in walls

### Bullet Collision
- **Incremental Movement**: Check collision at each tile (prevents tunneling)
- **Self-Hit Protection**: Bullets don't hit shooter on spawn tile
- **Deterministic**: Same input → same output

### State Synchronization
- **Server-Authoritative**: Engine holds single source of truth
- **Broadcast**: Full state sent to all clients every 50ms (~2KB/tick)
- **Event Clearing**: Events shown once, then cleared

## Message Protocol

### Client → Server

**JOIN**: `{"type":"join","name":"PlayerName"}`  
**MOVE**: `{"type":"move","data":"up|down|left|right"}`  
**SHOOT**: `{"type":"shoot"}`  
**QUIT**: `{"type":"quit"}`

### Server → Client

**INIT** (once on connect):
```json
{
  "type": "init",
  "your_id": "192.168.1.1:12345",
  "grid": [[0,1,0,...], ...],
  "colors": {"self":"lime","rival":"red"},
  "player_speed": 50
}
```

**GAME STATE** (every 50ms):
```json
{
  "players": {
    "id": {"name":"Alice","pos":{"x":15,"y":8},"dir":3,"score":42,"is_active":true}
  },
  "bullets": [{"owner_id":"id","pos":{"x":16,"y":8},"dir":3}],
  "events": ["Alice hit Bob"]
}
```

## Configuration

Edit `config.json`:
```json
{
  "port": 8080,
  "tick_rate_ms": 50,
  "player_speed_ms": 50,
  "bullet_speed_multiplier": 4,
  "colors": {
    "self_color": "lime",
    "rival_color": "red"
  }
}
```
## Project Structure

```
maze/
├── main.go                    # Entry point
├── config.json                # Game configuration
├── internal/
│   ├── game/
│   │   └── engine.go          # Game logic
│   └── server/
│       ├── hub.go             # Connection manager
│       └── client.go          # WebSocket handlers
├── pkg/
│   ├── config/
│   │   └── config.go          # Config loader
│   └── models/
│       └── models.go          # Data structures
└── static/
    ├── index.html             # Game UI
    ├── game.js                # Client logic
    └── style.css              # Styling
```





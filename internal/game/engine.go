package game

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"maze/pkg/config"
	"maze/pkg/models"
)

const (
	Width  = 32
	Height = 16

	// Tile types
	TileEmpty = 0
	TileWall  = 1

	// Game Rules
	HitScoreGain  = 11
	HitScoreLoss  = 5
	ShootCost     = 1
	CooldownTicks = 8
)

type Engine struct {
	Grid  [Height][Width]int
	State *models.GameState
	mu    sync.RWMutex

	Register   chan *Client
	Unregister chan *Client
	Inputs     chan ClientInput
	Broadcast  chan []byte
}

type ClientInput struct {
	ClientID string
	Input    models.Input
}

type Client struct {
	ID   string
	Send chan []byte
}

func NewEngine() *Engine {
	e := &Engine{
		State: &models.GameState{
			Players: make(map[string]*models.Player),
			Bullets: make([]*models.Bullet, 0),
			Events:  make([]string, 0),
		},
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Inputs:     make(chan ClientInput, 100), // Buffer inputs
		Broadcast:  make(chan []byte),
	}
	e.initMap()
	return e
}

func (e *Engine) Run() {
	ticker := time.NewTicker(time.Duration(config.AppConfig.TickRateMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case client := <-e.Register:
			e.addPlayer(client.ID, "Warrior")
		case client := <-e.Unregister:
			e.removePlayer(client.ID)
		case input := <-e.Inputs:
			e.handleInput(input)
		case <-ticker.C:
			e.update()
			e.broadcastState()
		}
	}
}

func (e *Engine) initMap() {
	// Fill with walls
	for y := 0; y < Height; y++ {
		for x := 0; x < Width; x++ {
			e.Grid[y][x] = TileWall
		}
	}

	// DFS Maze Generation
	// Start at (1,1)
	e.generateMaze(1, 1)

	// Sparsify: Remove random walls
	for y := 1; y < Height-1; y++ {
		for x := 1; x < Width-1; x++ {
			if e.Grid[y][x] == TileWall && rand.Float32() < 0.1 {
				e.Grid[y][x] = TileEmpty
			}
		}
	}

	// Clear Border Walls
	for x := 0; x < Width; x++ {
		e.Grid[0][x] = TileEmpty
		e.Grid[Height-1][x] = TileEmpty
	}
	for y := 0; y < Height; y++ {
		e.Grid[y][0] = TileEmpty
		e.Grid[y][Width-1] = TileEmpty
	}
}

func (e *Engine) generateMaze(x, y int) {
	e.Grid[y][x] = TileEmpty

	// Directions: Up, Down, Left, Right (2 steps at a time)
	dirs := [][2]int{{0, -2}, {0, 2}, {-2, 0}, {2, 0}}
	rand.Shuffle(len(dirs), func(i, j int) { dirs[i], dirs[j] = dirs[j], dirs[i] })

	for _, d := range dirs {
		nx, ny := x+d[0], y+d[1]

		if nx > 0 && nx < Width-1 && ny > 0 && ny < Height-1 && e.Grid[ny][nx] == TileWall {
			// Carve path
			e.Grid[y+d[1]/2][x+d[0]/2] = TileEmpty
			e.generateMaze(nx, ny)
		}
	}
}

func (e *Engine) addPlayer(id, name string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	pos := e.findRandomSpawn()

	e.State.Players[id] = &models.Player{
		ID:       id,
		Name:     name,
		Pos:      pos,
		Dir:      models.DirRight,
		Score:    0,
		IsActive: true,
	}
	// Don't log here, strictly wait for name (or log "New connection")
	// e.State.Events = append(e.State.Events, fmt.Sprintf("%s joined", name))
}

func (e *Engine) removePlayer(id string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if p, ok := e.State.Players[id]; ok {
		e.State.Events = append(e.State.Events, fmt.Sprintf("%s left", p.Name))
		delete(e.State.Players, id)
	}
}

func (e *Engine) handleInput(ci ClientInput) {
	e.mu.Lock()
	defer e.mu.Unlock()

	p, ok := e.State.Players[ci.ClientID]
	if !ok {
		return
	}

	switch ci.Input.Type {
	case "move":
		e.movePlayer(p, ci.Input.Data)
	case "shoot":
		e.shootBullet(p)
	case "join":
		oldName := p.Name
		p.Name = ci.Input.Name
		if oldName == "Warrior" {
			e.State.Events = append(e.State.Events, fmt.Sprintf("%s joined", p.Name))
		} else {
			e.State.Events = append(e.State.Events, fmt.Sprintf("%s renamed to %s", oldName, p.Name))
		}
	case "quit":
		e.State.Events = append(e.State.Events, fmt.Sprintf("%s quit the game", p.Name))
		// Mark player as inactive immediately
		p.IsActive = false
	}
}

func (e *Engine) movePlayer(p *models.Player, direction string) {
	newPos := p.Pos
	var newDir models.Direction

	switch direction {
	case "up":
		newPos.Y--
		newDir = models.DirUp
	case "down":
		newPos.Y++
		newDir = models.DirDown
	case "left":
		newPos.X--
		newDir = models.DirLeft
	case "right":
		newPos.X++
		newDir = models.DirRight
	}

	p.Dir = newDir

	if !e.isWall(newPos.X, newPos.Y) && !e.isPlayerAt(newPos.X, newPos.Y) {
		p.Pos = newPos
	}
}

func (e *Engine) shootBullet(p *models.Player) {
	if p.Cooldown > 0 {
		return
	}

	p.Score -= ShootCost
	p.Cooldown = CooldownTicks

	b := &models.Bullet{
		ID:            fmt.Sprintf("%s-%d", p.ID, time.Now().UnixNano()),
		OwnerID:       p.ID,
		Pos:           p.Pos,
		Dir:           p.Dir,
		DistanceMoved: 0,
	}
	e.State.Bullets = append(e.State.Bullets, b)
}

func (e *Engine) update() {
	e.mu.Lock()
	defer e.mu.Unlock()

	activeBullets := []*models.Bullet{}

	for _, b := range e.State.Bullets {
		keep := true
		for i := 0; i < config.AppConfig.BulletSpeedMultiplier; i++ {
			nextPos := b.Pos
			switch b.Dir {
			case models.DirUp:
				nextPos.Y--
			case models.DirDown:
				nextPos.Y++
			case models.DirLeft:
				nextPos.X--
			case models.DirRight:
				nextPos.X++
			}
			// ...

			b.DistanceMoved++

			if e.isWall(nextPos.X, nextPos.Y) {
				keep = false
				break
			}

			if hitPlayerID := e.getPlayerAt(nextPos.X, nextPos.Y); hitPlayerID != "" {
				if hitPlayerID != b.OwnerID {
					e.handleHit(b.OwnerID, hitPlayerID)
					keep = false
					break
				}
				if b.DistanceMoved > 1 {
					e.handleHit(b.OwnerID, hitPlayerID)
					keep = false
					break
				}
			}

			b.Pos = nextPos
		}

		if keep && e.isValid(b.Pos.X, b.Pos.Y) {
			activeBullets = append(activeBullets, b)
		}
	}
	e.State.Bullets = activeBullets

	for _, p := range e.State.Players {
		if p.Cooldown > 0 {
			p.Cooldown--
		}
	}
}

func (e *Engine) handleHit(shooterID, victimID string) {
	victim, ok := e.State.Players[victimID]
	if ok {
		victim.Score -= HitScoreLoss
		victim.Pos = e.findRandomSpawn()
		victim.Dir = models.Direction(rand.Intn(4))

		// Auto-change direction if facing wall
		dx, dy := 0, 0
		switch victim.Dir {
		case models.DirUp:
			dy = -1
		case models.DirDown:
			dy = 1
		case models.DirLeft:
			dx = -1
		case models.DirRight:
			dx = 1
		}
		if e.isWall(victim.Pos.X+dx, victim.Pos.Y+dy) {
			// Rotate 90
			victim.Dir = (victim.Dir + 1) % 4
		}
	}

	shooter, ok := e.State.Players[shooterID]
	if ok {
		shooter.Score += HitScoreGain
		e.State.Events = append(e.State.Events, fmt.Sprintf("%s hit %s", shooter.Name, victim.Name))
	}
}

func (e *Engine) isWall(x, y int) bool {
	if !e.isValid(x, y) {
		return true
	}
	return e.Grid[y][x] == TileWall
}

func (e *Engine) isValid(x, y int) bool {
	return x >= 0 && x < Width && y >= 0 && y < Height
}

func (e *Engine) isPlayerAt(x, y int) bool {
	for _, p := range e.State.Players {
		if p.Pos.X == x && p.Pos.Y == y {
			return true
		}
	}
	return false
}

func (e *Engine) getPlayerAt(x, y int) string {
	for id, p := range e.State.Players {
		if p.Pos.X == x && p.Pos.Y == y {
			return id
		}
	}
	return ""
}

func (e *Engine) findRandomSpawn() models.Point {
	for i := 0; i < 100; i++ {
		x := rand.Intn(Width)
		y := rand.Intn(Height)
		if !e.isWall(x, y) && !e.isPlayerAt(x, y) {
			return models.Point{X: x, Y: y}
		}
	}
	return models.Point{1, 1}
}

func (e *Engine) broadcastState() {
	e.mu.Lock() // safe read
	data, err := json.Marshal(e.State)
	e.mu.Unlock()

	if err != nil {
		fmt.Println("Error marshalling state:", err)
		return
	}

	e.Broadcast <- data

	e.mu.Lock()
	if len(e.State.Events) > 0 {
		e.State.Events = make([]string, 0)
	}
	e.mu.Unlock()
}

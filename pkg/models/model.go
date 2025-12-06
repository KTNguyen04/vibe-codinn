package models

const (
	Width     = 32
	Height    = 16
	TileEmpty = 0
	TileWall  = 1
)

// Point represents a position in the grid
type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Direction represents the orientation of a player
type Direction int

const (
	DirUp    Direction = 0
	DirDown  Direction = 1
	DirLeft  Direction = 2
	DirRight Direction = 3
)

// Player represents a single client/warrior
type Player struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Pos      Point     `json:"pos"`
	Dir      Direction `json:"dir"` // 0: Up, 1: Down, 2: Left, 3: Right
	Score    int       `json:"score"`
	Cooldown int       `json:"cooldown"` // Ticks until next shot allowed
	IsActive bool      `json:"is_active"`
}

// Bullet represents a fired projectile
type Bullet struct {
	ID            string    `json:"id"`
	OwnerID       string    `json:"owner_id"`
	Pos           Point     `json:"pos"`
	Dir           Direction `json:"dir"`
	DistanceMoved int       `json:"distance_moved"`
}

// GameState is the full state sent to clients
type GameState struct {
	Players map[string]*Player `json:"players"`
	Bullets []*Bullet          `json:"bullets"`
	Events  []string           `json:"events"`
}

// InitMessage is sent to the client upon connection
type InitMessage struct {
	Type   string             `json:"type"` // "init"
	YourID string             `json:"your_id"`
	Grid   [Height][Width]int `json:"grid"`
	Colors struct {
		Self  string `json:"self"`
		Rival string `json:"rival"`
	} `json:"colors"`
	PlayerSpeed int `json:"player_speed"`
}

// Input represents command from client
type Input struct {
	Type string `json:"type"`           // "move", "shoot", "quit", "join"
	Data string `json:"data"`           // e.g., "up", "down" for move
	Name string `json:"name,omitempty"` // For joining
}

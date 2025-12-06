package server

import (
	"encoding/json"
	"log"
	"net/http"

	"maze/internal/game"
	"maze/pkg/config"
	"maze/pkg/models"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for dev
	},
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

func (h *Hub) BroadcastState(state []byte) {
	h.broadcast <- state
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client)
				}
			}
		}
	}
}

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *Hub, engine *game.Engine, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	// Create new client
	gameClient := &game.Client{
		ID:   r.RemoteAddr,
		Send: make(chan []byte, 256),
	}
	gameClient.ID = conn.RemoteAddr().String()

	client := &Client{
		Client: gameClient,
	}

	hub.register <- client
	engine.Register <- gameClient

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.

	// Send Init Packet
	initMsg := models.InitMessage{
		Type:   "init",
		YourID: client.ID,
		Grid:   engine.Grid,
		Colors: struct {
			Self  string `json:"self"`
			Rival string `json:"rival"`
		}{
			Self:  config.AppConfig.Colors.Self,
			Rival: config.AppConfig.Colors.Rival,
		},
		PlayerSpeed: config.AppConfig.PlayerSpeedMs,
	}
	initBytes, _ := json.Marshal(initMsg)
	client.Send <- initBytes

	go client.writePump(conn)
	go client.readPump(conn, engine, hub)
}

package main

import (
	"log"
	"maze/internal/game"
	"maze/internal/server"
	"maze/pkg/config"
	"net/http"
)

func main() {
	// Load Config
	err := config.LoadConfig("config.json")
	if err != nil {
		log.Fatal("Failed to load config:", err)
	}

	// Initialize Game Engine
	engine := game.NewEngine()
	go engine.Run()

	// Initialize Websocket Hub
	hub := server.NewHub()
	go hub.Run()

	// Bridge Engine Broadcast to Hub
	go func() {
		for state := range engine.Broadcast {
			hub.BroadcastState(state)
		}
	}()

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		server.ServeWs(hub, engine, w, r)
	})

	log.Println("Server started on " + config.AppConfig.Port)
	err = http.ListenAndServe(":"+config.AppConfig.Port, nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

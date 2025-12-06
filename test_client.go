//go:build ignore

package main

import (
	"log"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

func main() {
	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/ws"}
	log.Printf("connecting to %s", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	// Send Join
	err = c.WriteJSON(map[string]string{"type": "join", "name": "TestBot"})
	if err != nil {
		log.Fatal("write join:", err)
	}

	time.Sleep(1 * time.Second)
	// Send Move
	err = c.WriteJSON(map[string]string{"type": "move", "data": "right"})
	if err != nil {
		log.Fatal("write move:", err)
	}

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read:", err)
				return
			}
			log.Printf("recv: %s", message)
			// Just read one message to confirm we get state
			return
		}
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		log.Fatal("timeout waiting for message")
	}
	log.Println("Test passed")
}

import { WS_URL } from './constants.js';
import { render } from './renderer.js';
import { updateUI } from './ui.js';
import { startInputLoop } from './input.js';

// WebSocket connection
let ws = null;

// Game state
let gameState = null;
let myID = null;
let grid = null;
let playerColors = { self: 'lime', rival: 'red' };

// DOM elements
const connectionStatus = document.getElementById('connection-status');
const joinModal = document.getElementById('join-modal');

/**
 * Get the current WebSocket connection
 */
export function getWebSocket() {
    return ws;
}

/**
 * Get the current game state
 */
export function getGameState() {
    return gameState;
}

/**
 * Get the current player ID
 */
export function getMyID() {
    return myID;
}

/**
 * Get the game grid
 */
export function getGrid() {
    return grid;
}

/**
 * Get player colors
 */
export function getPlayerColors() {
    return playerColors;
}

/**
 * Connect to the WebSocket server
 */
export function connect(name) {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        connectionStatus.textContent = 'Connected';
        connectionStatus.style.color = 'green';
        
        // Send join packet
        ws.send(JSON.stringify({
            type: 'join',
            name: name
        }));
    };
    
    ws.onclose = (event) => {
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.color = 'red';
        console.log("WS Closed", event);
        if (!gameState) {
            // Failed before game started
            joinModal.style.display = 'flex';
            alert("Connection lost or failed to connect. Ensure you are using HTTPS if on Ngrok.");
        }
    };

    ws.onerror = (err) => {
        console.error("WS Error", err);
        connectionStatus.textContent = 'Error';
        connectionStatus.style.color = 'red';
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'init') {
                myID = data.your_id;
                grid = data.grid;
                if (data.colors) {
                    playerColors = data.colors;
                }
                if (data.player_speed) {
                    startInputLoop(data.player_speed);
                }
                console.log("Joined as", myID, "Map received");
                // Pre-draw map
                render();
                return;
            }
            
            gameState = data;
            render();
            updateUI();
        } catch (e) {
            console.error("Error parsing message", e);
        }
    };
}

/**
 * Reset the game state (used when quitting)
 */
export function resetGameState() {
    gameState = null;
    myID = null;
}

/**
 * Close the WebSocket connection
 */
export function closeConnection() {
    if (ws) {
        ws.close();
    }
}

import { DEFAULT_INPUT_INTERVAL_MS } from './constants.js';
import { getWebSocket, resetGameState, closeConnection } from './websocket.js';

// Input state
const keys = {};
let inputIntervalMs = DEFAULT_INPUT_INTERVAL_MS;
let inputLoopId = null;

// DOM elements
const joinModal = document.getElementById('join-modal');

/**
 * Initialize input event listeners
 */
export function initializeInput() {
    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        // Prevent default scrolling for game keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
}

/**
 * Start the input loop
 */
export function startInputLoop(customIntervalMs = null) {
    if (customIntervalMs !== null) {
        inputIntervalMs = customIntervalMs;
    }
    
    if (inputLoopId) clearInterval(inputLoopId);
    
    inputLoopId = setInterval(() => {
        const ws = getWebSocket();
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        // Movement
        let moveAction = '';
        if (keys['ArrowUp']) moveAction = 'up';
        else if (keys['ArrowDown']) moveAction = 'down';
        else if (keys['ArrowLeft']) moveAction = 'left';
        else if (keys['ArrowRight']) moveAction = 'right';
        
        if (moveAction) {
            ws.send(JSON.stringify({ type: 'move', data: moveAction }));
        }
        
        // Shooting
        if (keys[' ']) {
            ws.send(JSON.stringify({ type: 'shoot' }));
        }
        
        // Quit
        if (keys['q'] || keys['Q']) {
            ws.send(JSON.stringify({ type: 'quit' }));
            keys['q'] = false; // Trigger once
            keys['Q'] = false;
            
            // Close connection and reset
            setTimeout(() => {
                closeConnection();
                resetGameState();
                joinModal.style.display = 'flex';
            }, 100); // Small delay to ensure quit message is sent
        }
    }, inputIntervalMs);
}

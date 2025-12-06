import { connect } from './websocket.js';
import { initializeInput, startInputLoop } from './input.js';

// DOM elements
const joinModal = document.getElementById('join-modal');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

/**
 * Start the game with the given player name
 */
function startGame(name) {
    joinModal.style.display = 'none';
    connect(name);
}

/**
 * Initialize the game
 */
function init() {
    // Initialize input handling
    initializeInput();
    
    // Start input loop with default settings
    startInputLoop();
    
    // Handle join button click
    joinBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (name) {
            startGame(name);
        }
    });
}

// Start the game when the page loads
init();

import { getGameState } from './websocket.js';

// DOM elements
const logBox = document.getElementById('log-box');
const scoreList = document.getElementById('score-list');

/**
 * Update the UI (scores and logs)
 */
export function updateUI() {
    const gameState = getGameState();
    if (!gameState) return;
    
    updateScores(gameState);
    updateLogs(gameState);
}

/**
 * Update the scoreboard
 */
function updateScores(gameState) {
    // Sort players by score
    const players = Object.values(gameState.players).sort((a,b) => b.score - a.score);
    
    scoreList.innerHTML = players.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.score}</td>
        </tr>
    `).join('');
}

/**
 * Update the event logs
 */
function updateLogs(gameState) {
    if (gameState.events && gameState.events.length > 0) {
        gameState.events.forEach(msg => {
            const div = document.createElement('div');
            
            // Check for join event
            if (msg.includes("joined")) {
                div.style.color = '#00ff00'; // Lime green for joins
                div.style.fontWeight = 'bold';
            } else if (msg.includes("left")) {
                 div.style.color = '#ff9900'; // Orange for leave
            } else if (msg.includes("hit")) {
                 div.style.color = '#ff4444'; // Red for hits
            }
            
            div.textContent = msg;
            logBox.appendChild(div);
            // Scroll to bottom
            logBox.scrollTop = logBox.scrollHeight;
        });
    }
}

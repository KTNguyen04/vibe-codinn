const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const logBox = document.getElementById('log-box');
const scoreList = document.getElementById('score-list');
const connectionStatus = document.getElementById('connection-status');
const joinModal = document.getElementById('join-modal');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

// Constants
const TILE_SIZE = 30;
const GRID_WIDTH = 32;
const GRID_HEIGHT = 16;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = protocol + '//' + window.location.host + '/ws';

let ws;
let gameState = null;
let myID = null;
let grid = null;
let playerColors = { self: 'lime', rival: 'red' };

// We will handle "Join" first.
joinBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        startGame(name);
    }
});

function startGame(name) {
    joinModal.style.display = 'none';
    connect(name);
}

function connect(name) {
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
                    inputIntervalMs = data.player_speed;
                    startInputLoop();
                }
                console.log("Joined as", myID, "Map received");
                // Pre-draw map?
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

// Input handling
// Input handling
const keys = {};

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

// Input Loop
let inputIntervalMs = 50;
let inputLoopId = null;

function startInputLoop() {
    if (inputLoopId) clearInterval(inputLoopId);
    inputLoopId = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    // Movement
    let moveAction = '';
    if (keys['ArrowUp']) moveAction = 'up';
    else if (keys['ArrowDown']) moveAction = 'down';
    else if (keys['ArrowLeft']) moveAction = 'left';
    else if (keys['ArrowRight']) moveAction = 'right';
    
    if (moveAction) {
        // console.log("Sending move", moveAction);
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
            if (ws) {
                ws.close();
            }
            gameState = null;
            myID = null;
            joinModal.style.display = 'flex';
        }, 100); // Small delay to ensure quit message is sent
    }
}, inputIntervalMs);
}

startInputLoop(); // Start with default

function render() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawMap();

    if (!gameState) return;

    // Draw Players
    for (const id in gameState.players) {
        const p = gameState.players[id];
        if(!p.is_active) continue;
        drawPlayer(p);
    }
    
    // Draw Bullets
    for (const b of gameState.bullets) {
        ctx.beginPath();
        // Determine color: owned by me?
        if (b.owner_id === myID) {
            ctx.fillStyle = 'darkgreen'; // Darker lime
        } else {
            ctx.fillStyle = 'darkred'; // Darker red
        }
        
        const x = b.pos.x * TILE_SIZE + TILE_SIZE/2;
        const y = b.pos.y * TILE_SIZE + TILE_SIZE/2;
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawMap() {
    ctx.fillStyle = 'black'; // Walls
    
    if (grid) {
        // Use received grid
        for (let y = 0; y < grid.length; y++) {
             for (let x = 0; x < grid[y].length; x++) {
                 if (grid[y][x] === 1) { // 1 = Wall
                     drawWall(x, y);
                 }
             }
        }
    } else {
        // Fallback or empty
    }
    
    // Draw Border Line
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function drawWall(x, y) {
    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

function drawPlayer(p) {
    const x = p.pos.x * TILE_SIZE + TILE_SIZE/2;
    const y = p.pos.y * TILE_SIZE + TILE_SIZE/2;
    const r = TILE_SIZE / 2 - 2;
    
    // Colors: Self = Green, Rivals = Red
    let color = 'red';
    if (p.id === myID) {
        color = playerColors.self;
    } else {
        color = playerColors.rival;
    }
    
    ctx.fillStyle = color;
    
    // Draw Pacman shape
    ctx.beginPath();
    
    let startAngle = 0;
    let endAngle = 2 * Math.PI;
    
    // Direction: 0: Up, 1: Down, 2: Left, 3: Right
    // Standard arc 0 is Right (3 o'clock).
    // Up is -PI/2.
    // Down is PI/2.
    // Left is PI.
    
    const mouthSize = 0.2 * Math.PI; // Size of mouth
    let baseAngle = 0;
    
    switch(p.dir) {
        case 3: baseAngle = 0; break; // Right
        case 1: baseAngle = 0.5 * Math.PI; break; // Down
        case 2: baseAngle = Math.PI; break; // Left
        case 0: baseAngle = 1.5 * Math.PI; break; // Up
    }
    
    startAngle = baseAngle + mouthSize;
    endAngle = baseAngle - mouthSize;
    
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, startAngle, endAngle);
    ctx.lineTo(x, y);
    ctx.fill();
    
    // Name
    ctx.fillStyle = 'black';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, x, y - r - 2);
}

function updateUI() {
    if (!gameState) return;
    
    // Scores
    // Sort players by score
    const players = Object.values(gameState.players).sort((a,b) => b.score - a.score);
    
    scoreList.innerHTML = players.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.score}</td>
        </tr>
    `).join('');
    
    // Logs
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

import { TILE_SIZE } from './constants.js';
import { getGameState, getMyID, getGrid, getPlayerColors } from './websocket.js';

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/**
 * Main render function
 */
export function render() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawMap();

    const gameState = getGameState();
    if (!gameState) return;

    // Draw Players
    for (const id in gameState.players) {
        const p = gameState.players[id];
        if(!p.is_active) continue;
        drawPlayer(p);
    }
    
    // Draw Bullets
    for (const b of gameState.bullets) {
        drawBullet(b);
    }
}

/**
 * Draw the game map
 */
function drawMap() {
    ctx.fillStyle = 'black'; // Walls
    
    const grid = getGrid();
    if (grid) {
        // Use received grid
        for (let y = 0; y < grid.length; y++) {
             for (let x = 0; x < grid[y].length; x++) {
                 if (grid[y][x] === 1) { // 1 = Wall
                     drawWall(x, y);
                 }
             }
        }
    }
    
    // Draw Border Line
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw a wall tile
 */
function drawWall(x, y) {
    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

/**
 * Draw a player
 */
function drawPlayer(p) {
    const x = p.pos.x * TILE_SIZE + TILE_SIZE/2;
    const y = p.pos.y * TILE_SIZE + TILE_SIZE/2;
    const r = TILE_SIZE / 2 - 2;
    
    // Colors: Self = Green, Rivals = Red
    const myID = getMyID();
    const playerColors = getPlayerColors();
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

/**
 * Draw a bullet
 */
function drawBullet(b) {
    const myID = getMyID();
    
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

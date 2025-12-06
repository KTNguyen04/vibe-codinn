# Game.js Modular Structure

The game.js file has been refactored into smaller, more maintainable modules:

## Module Overview

### 1. **constants.js** (411 bytes)
- Contains all game constants and configuration values
- Exports: `TILE_SIZE`, `GRID_WIDTH`, `GRID_HEIGHT`, `WS_URL`, `DEFAULT_PLAYER_COLORS`, `DEFAULT_INPUT_INTERVAL_MS`

### 2. **websocket.js** (2,908 bytes)
- Handles WebSocket connection and server communication
- Manages game state (gameState, myID, grid, playerColors)
- Exports:
  - `connect(name)` - Establish WebSocket connection
  - `getWebSocket()` - Get current WebSocket instance
  - `getGameState()` - Get current game state
  - `getMyID()` - Get current player ID
  - `getGrid()` - Get game grid
  - `getPlayerColors()` - Get player color configuration
  - `resetGameState()` - Reset game state
  - `closeConnection()` - Close WebSocket connection

### 3. **input.js** (2,149 bytes)
- Handles keyboard input and player actions
- Manages input loop for sending commands to server
- Exports:
  - `initializeInput()` - Set up keyboard event listeners
  - `startInputLoop(customIntervalMs)` - Start the input polling loop

### 4. **renderer.js** (3,252 bytes)
- Handles all canvas rendering operations
- Draws map, players, and bullets
- Exports:
  - `render()` - Main render function
- Internal functions:
  - `drawMap()` - Draw the game map
  - `drawWall(x, y)` - Draw a wall tile
  - `drawPlayer(p)` - Draw a player with Pacman shape
  - `drawBullet(b)` - Draw a bullet

### 5. **ui.js** (1,572 bytes)
- Manages UI updates (scoreboard and event logs)
- Exports:
  - `updateUI()` - Update all UI elements
- Internal functions:
  - `updateScores(gameState)` - Update scoreboard
  - `updateLogs(gameState)` - Update event logs

### 6. **game.js** (863 bytes) - Main Entry Point
- Lightweight orchestrator that initializes all modules
- Handles game startup and join modal
- Imports and coordinates all other modules

## Benefits of This Structure

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Maintainability**: Easier to find and fix bugs in specific areas
3. **Testability**: Individual modules can be tested in isolation
4. **Reusability**: Modules can be reused in other projects
5. **Readability**: Smaller files are easier to understand
6. **Scalability**: New features can be added without cluttering existing code

## Module Dependencies

```
game.js (main)
├── websocket.js
│   ├── constants.js
│   ├── renderer.js
│   └── ui.js
├── input.js
│   ├── constants.js
│   └── websocket.js
renderer.js
├── constants.js
└── websocket.js
ui.js
└── websocket.js
```

## File Size Comparison

- **Original game.js**: 8,309 bytes (305 lines)
- **New game.js**: 863 bytes (39 lines) - 90% reduction!
- **Total modular code**: 11,155 bytes across 6 files

The slight increase in total size is due to:
- Module imports/exports
- Better code organization and comments
- Improved maintainability

## Usage

The HTML file loads the main `game.js` as an ES6 module:

```html
<script type="module" src="game.js"></script>
```

All other modules are automatically loaded via ES6 import statements.

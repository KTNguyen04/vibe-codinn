// Game Constants
export const TILE_SIZE = 30;
export const GRID_WIDTH = 32;
export const GRID_HEIGHT = 16;

// WebSocket URL
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
export const WS_URL = protocol + '//' + window.location.host + '/ws';

// Player Colors
export const DEFAULT_PLAYER_COLORS = { self: 'lime', rival: 'red' };

// Input
export const DEFAULT_INPUT_INTERVAL_MS = 50;

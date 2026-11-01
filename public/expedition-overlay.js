import { createBoard } from './expedition-board.js';
import { connectState } from './expedition-connection.js';
const root = document.getElementById('board');
if (new URLSearchParams(location.search).has('preview'))
    root.classList.add('preview');
const draw = createBoard(root);
let healthy = true;
connectState(data => { healthy = data.healthy !== false; draw(data.state, data.now); }, connected => { document.getElementById('overlay-status').hidden = connected && healthy; root.classList.toggle('disconnected', !connected || !healthy); });

import { WIDTH, HEIGHT } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#eee';
ctx.font = '20px system-ui, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Your game goes here', WIDTH / 2, HEIGHT / 2);

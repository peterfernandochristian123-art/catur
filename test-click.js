const fs = require('fs');

// Simple DOM & Window simulation
const html = fs.readFileSync('index.html', 'utf8');

console.log('--- Simulating Click Events ---');
// Let's check what onSquareClicked does when clicking a piece
const audioCode = fs.readFileSync('js/audio.js', 'utf8');
const chessEngineCode = fs.readFileSync('js/chess-engine.js', 'utf8');
const aiCode = fs.readFileSync('js/ai-bot.js', 'utf8');
const puzzleCode = fs.readFileSync('js/puzzles.js', 'utf8');
const serviceCode = fs.readFileSync('js/firebase-service.js', 'utf8');

global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = v; }
};

eval(audioCode);
eval(chessEngineCode);
eval(aiCode);
eval(puzzleCode);
eval(serviceCode);

console.log('Turn is:', chessEngine.turn);
console.log('Piece at row 6, col 4 (e2):', chessEngine.board[6][4]);
console.log('Is piece white?:', chessEngine.isWhite(chessEngine.board[6][4]));
console.log('Legal moves for e2:', chessEngine.getLegalMoves(6, 4));

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const games = new Map();

class Game {
  constructor() {
    this.board = this.initializeBoard();
    this.currentPlayer = 'A';
    this.moveHistory = [];
    this.gameOver = false;
    this.winner = null;
  }

  initializeBoard() {
    const board = Array(5).fill().map(() => Array(5).fill(null));
    board[0] = ['A-P1', 'A-P2', 'A-H1', 'A-H2', 'A-P3'];
    board[4] = ['B-P1', 'B-P2', 'B-H1', 'B-H2', 'B-P3'];
    return board;
  }

  isValidMove(piece, from, to) {
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const [player, type] = piece.split('-');
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;

    // Check if the move is within bounds
    if (toRow < 0 || toRow > 4 || toCol < 0 || toCol > 4) {
      return false;
    }

    // Check if the destination contains a friendly piece
    const destPiece = this.board[toRow][toCol];
    if (destPiece && destPiece[0] === player) {
      return false;
    }

    if (type.startsWith('P')) {
      // Pawn: moves one block in any direction (not diagonally)
      return (Math.abs(rowDiff) === 1 && colDiff === 0) || (rowDiff === 0 && Math.abs(colDiff) === 1);
    } else if (type === 'H1') {
      // Hero1: moves two blocks straight in any direction
      return (Math.abs(rowDiff) === 2 && colDiff === 0) || (Math.abs(colDiff) === 2 && rowDiff === 0);
    } else if (type === 'H2') {
      // Hero2: moves two blocks diagonally in any direction
      return Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2;
    }
    return false;
  }

  makeMove(from, to) {
    if (this.gameOver) {
      return false;
    }

    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const piece = this.board[fromRow][fromCol];

    if (!piece || piece[0] !== this.currentPlayer) {
      return false;
    }

    if (!this.isValidMove(piece, from, to)) {
      return false;
    }

    const [player, type] = piece.split('-');
    const capturedPieces = [];

    // Handle Hero1 and Hero2 path capturing
    if (type === 'H1' || type === 'H2') {
      const rowStep = Math.sign(toRow - fromRow);
      const colStep = Math.sign(toCol - fromCol);
      let currentRow = fromRow + rowStep;
      let currentCol = fromCol + colStep;

      while (currentRow !== toRow || currentCol !== toCol) {
        const pathPiece = this.board[currentRow][currentCol];
        if (pathPiece && pathPiece[0] !== player) {
          capturedPieces.push(pathPiece);
          this.board[currentRow][currentCol] = null;
        }
        currentRow += rowStep;
        currentCol += colStep;
      }
    }

    // Capture piece at the destination
    const destPiece = this.board[toRow][toCol];
    if (destPiece && destPiece[0] !== player) {
      capturedPieces.push(destPiece);
    }

    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    const moveNotation = `${piece}: ${String.fromCharCode(97 + fromCol)}${5 - fromRow} to ${String.fromCharCode(97 + toCol)}${5 - toRow}`;
    this.moveHistory.push(moveNotation + (capturedPieces.length > 0 ? ` (Captured ${capturedPieces.join(', ')})` : ''));

    this.checkGameOver();
    if (!this.gameOver) {
      this.currentPlayer = this.currentPlayer === 'A' ? 'B' : 'A';
    }

    return true;
  }

  checkGameOver() {
    const playerAPieces = this.board.flat().filter(piece => piece && piece.startsWith('A'));
    const playerBPieces = this.board.flat().filter(piece => piece && piece.startsWith('B'));

    if (playerAPieces.length === 0) {
      this.gameOver = true;
      this.winner = 'B';
    } else if (playerBPieces.length === 0) {
      this.gameOver = true;
      this.winner = 'A';
    }
  }

  getState() {
    return {
      board: this.board,
      currentPlayer: this.currentPlayer,
      moveHistory: this.moveHistory,
      gameOver: this.gameOver,
      winner: this.winner,
    };
  }
}
wss.on('connection', (ws) => {
  console.log('New client connected');
  let game;

  if (games.size === 0 || Array.from(games.values())[games.size - 1].players.length === 2) {
    game = new Game();
    games.set(ws, game);
    game.players = [ws];
  } else {
    game = Array.from(games.values())[games.size - 1];
    game.players.push(ws);
  }

  ws.send(JSON.stringify({ type: 'gameState', state: game.getState() }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log('Received message:', data);

    if (data.type === 'move') {
      if (game.makeMove(data.from, data.to)) {
        const gameState = game.getState();
        game.players.forEach(player => player.send(JSON.stringify({ type: 'gameState', state: gameState })));
        
        if (gameState.gameOver) {
          game.players.forEach(player => player.send(JSON.stringify({ 
            type: 'gameOver', 
            winner: gameState.winner 
          })));
        }
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    games.delete(ws);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
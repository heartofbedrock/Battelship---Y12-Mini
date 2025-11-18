const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// In-memory rooms store
const rooms = {}; // code -> { players: {socketId: {id, name}}, boards: {socketId: board}, turn: socketId, state }

function ensureRoom(code) {
  if (!rooms[code]) {
    rooms[code] = { players: [], boards: {}, turn: null, started: false };
  }
  return rooms[code];
}

io.on('connection', (socket) => {
  socket.on('create', ({ code, name }, cb) => {
    const room = ensureRoom(code);
    if (room.players.length >= 2) return cb && cb({ ok: false, error: 'Room full' });
    socket.join(code);
    socket.code = code;
    socket.playerName = name || 'Player';
    room.players.push(socket.id);
    io.to(code).emit('roomUpdate', { players: room.players.length });
    cb && cb({ ok: true, playerId: socket.id });
  });

  socket.on('join', ({ code, name }, cb) => {
    const room = ensureRoom(code);
    if (room.players.length >= 2) return cb && cb({ ok: false, error: 'Room full' });
    socket.join(code);
    socket.code = code;
    socket.playerName = name || 'Player';
    room.players.push(socket.id);
    io.to(code).emit('roomUpdate', { players: room.players.length });
    cb && cb({ ok: true, playerId: socket.id });
  });

  socket.on('place', ({ board }, cb) => {
    const code = socket.code;
    if (!code) return cb && cb({ ok: false });
    const room = ensureRoom(code);
    room.boards[socket.id] = board; // board is 10x10 with ship ids or 0
    // if both players placed, start game
    if (room.players.length === 2 && Object.keys(room.boards).length === 2 && !room.started) {
      room.started = true;
      // pick random starter
      const starter = room.players[Math.floor(Math.random() * 2)];
      room.turn = starter;
      io.to(code).emit('start', { starter });
    }
    cb && cb({ ok: true });
  });

  socket.on('fire', ({ x, y }, cb) => {
    const code = socket.code;
    if (!code) return cb && cb({ ok: false });
    const room = rooms[code];
    if (!room || !room.started) return cb && cb({ ok: false, error: 'Game not started' });
    if (room.turn !== socket.id) return cb && cb({ ok: false, error: 'Not your turn' });
    // find opponent
    const opponentId = room.players.find((id) => id !== socket.id);
    if (!opponentId) return cb && cb({ ok: false });
    const oppBoard = room.boards[opponentId];
    if (!oppBoard) return cb && cb({ ok: false });

    const cell = oppBoard[y] && oppBoard[y][x];
    let hit = false;
    let sunk = false;
    let shipId = null;
    if (cell && cell !== 0) {
      hit = true;
      shipId = cell;
      // mark as hit by setting negative value
      oppBoard[y][x] = -Math.abs(cell);
      // check if ship is sunk
      let found = false;
      for (let row = 0; row < oppBoard.length; row++) {
        for (let col = 0; col < oppBoard[row].length; col++) {
          if (oppBoard[row][col] === shipId) found = true;
        }
      }
      if (!found) sunk = true;
    } else {
      // mark miss as -0? keep 0 as miss marker could be `null`; we'll mark as -0 to indicate checked
      if (oppBoard[y] && oppBoard[y][x] === 0) oppBoard[y][x] = -0;
    }

    // broadcast result
    io.to(code).emit('shot', { shooter: socket.id, x, y, hit, sunk, shipId });

    // check win
    let opponentHasShips = false;
    for (let row = 0; row < oppBoard.length; row++) {
      for (let col = 0; col < oppBoard[row].length; col++) {
        if (oppBoard[row][col] > 0) opponentHasShips = true;
      }
    }
    if (!opponentHasShips) {
      io.to(code).emit('gameOver', { winner: socket.id });
      room.started = false;
      return cb && cb({ ok: true, hit, sunk, gameOver: true });
    }

    // toggle turn
    room.turn = opponentId;
    io.to(code).emit('turn', { turn: room.turn });

    cb && cb({ ok: true, hit, sunk });
  });

  socket.on('disconnect', () => {
    const code = socket.code;
    if (!code) return;
    const room = rooms[code];
    if (!room) return;
    // remove player
    room.players = room.players.filter((id) => id !== socket.id);
    delete room.boards[socket.id];
    io.to(code).emit('roomUpdate', { players: room.players.length });
    // if room empty, delete
    if (room.players.length === 0) delete rooms[code];
  });
});

const PORT = process.env.PORT || 4300;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});

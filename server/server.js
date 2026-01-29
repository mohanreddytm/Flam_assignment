const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { joinDefaultRoom } = require('./rooms');
const {
  getStrokes,
  startStroke,
  addPointToStroke,
  endStroke,
  undoLastStrokeForUser,
  setCursorPosition,
  removeCursor,
  getCursors
} = require('./state-manager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const PORT = process.env.PORT || 3000;

const CLIENT_DIR = path.join(__dirname, '..', 'client');
app.use(express.static(CLIENT_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

io.on('connection', (socket) => {
  const userId = socket.id;
  const roomId = joinDefaultRoom(socket);

  // Send initial state: existing strokes and cursors
  socket.emit('init', {
    userId,
    strokes: getStrokes(),
    cursors: getCursors()
  });

  socket.on('stroke:start', (stroke) => {
    // stroke: { strokeId, userId, color, width, points: [point] }
    startStroke(stroke);
    socket.to(roomId).emit('stroke:start', stroke);
  });

  socket.on('stroke:point', ({ strokeId, point }) => {
    addPointToStroke(strokeId, point);
    socket.to(roomId).emit('stroke:point', { strokeId, point, userId });
  });

  socket.on('stroke:end', ({ strokeId }) => {
    endStroke(strokeId);
    socket.to(roomId).emit('stroke:end', { strokeId, userId });
  });

  socket.on('stroke:undo', () => {
    const changed = undoLastStrokeForUser(userId);
    if (changed) {
      const strokes = getStrokes();
      io.to(roomId).emit('strokes:update', strokes);
    }
  });

  socket.on('cursor:move', ({ x, y, color }) => {
    setCursorPosition(userId, { x, y, color });
    socket.to(roomId).emit('cursor:update', { userId, x, y, color });
  });

  socket.on('disconnect', () => {
    removeCursor(userId);
    socket.to(roomId).emit('cursor:remove', { userId });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});



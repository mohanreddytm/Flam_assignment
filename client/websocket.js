// WebSocket (Socket.io) logic: manages real-time communication.

(function () {
  function createSocketManager(options) {
    const {
      onInit,
      onStrokeStart,
      onStrokePoint,
      onStrokeEnd,
      onStrokesUpdate,
      onCursorUpdate,
      onCursorRemove
    } = options || {};

    // Connect directly to the deployed backend URL
    const socket = io('https://flam-assignment-slbc.onrender.com/');

    let userColor = '#22c55e';

    function setUserColor(color) {
      userColor = color || userColor;
    }

    socket.on('connect', function () {
      // No-op; server will send 'init'
    });

    socket.on('init', function (payload) {
      if (onInit) {
        onInit(payload);
      }
    });

    socket.on('stroke:start', function (stroke) {
      if (onStrokeStart) {
        onStrokeStart(stroke);
      }
    });

    socket.on('stroke:point', function (data) {
      if (onStrokePoint) {
        onStrokePoint(data);
      }
    });

    socket.on('stroke:end', function (data) {
      if (onStrokeEnd) {
        onStrokeEnd(data);
      }
    });

    socket.on('strokes:update', function (strokes) {
      if (onStrokesUpdate) {
        onStrokesUpdate(strokes);
      }
    });

    socket.on('cursor:update', function (data) {
      if (onCursorUpdate) {
        onCursorUpdate(data);
      }
    });

    socket.on('cursor:remove', function (data) {
      if (onCursorRemove) {
        onCursorRemove(data);
      }
    });

    function emitStrokeStart(stroke) {
      socket.emit('stroke:start', stroke);
    }

    function emitStrokePoint(data) {
      socket.emit('stroke:point', data);
    }

    function emitStrokeEnd(data) {
      socket.emit('stroke:end', data);
    }

    function requestUndo() {
      socket.emit('stroke:undo');
    }

    function emitCursorMove(pos) {
      socket.emit('cursor:move', {
        x: pos.x,
        y: pos.y,
        color: userColor
      });
    }

    return {
      setUserColor,
      emitStrokeStart,
      emitStrokePoint,
      emitStrokeEnd,
      requestUndo,
      emitCursorMove
    };
  }

  window.createSocketManager = createSocketManager;
}());



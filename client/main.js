// App bootstrap: wires canvas and websocket together.

(function () {
  function randomColor() {
    const colors = [
      '#22c55e',
      '#3b82f6',
      '#ec4899',
      '#f97316',
      '#eab308',
      '#a855f7'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  window.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('drawingCanvas');
    const undoButton = document.getElementById('undoButton');

    if (!canvas) {
      // eslint-disable-next-line no-console
      console.error('Canvas element not found');
      return;
    }

    const canvasManager = window.createCanvasManager(canvas, undoButton);

    const socketManager = window.createSocketManager({
      onInit: function (payload) {
        const { userId, strokes, cursors } = payload;
        const color = randomColor();
        canvasManager.setUserId(userId);
        canvasManager.setUserColor(color);
        socketManager.setUserColor(color);
        if (Array.isArray(strokes)) {
          canvasManager.setStrokesFromServer(strokes);
        }
        if (Array.isArray(cursors)) {
          canvasManager.syncCursors(cursors);
        }
      },
      onStrokeStart: function (stroke) {
        canvasManager.onRemoteStrokeStart(stroke);
      },
      onStrokePoint: function (data) {
        canvasManager.onRemoteStrokePoint(data);
      },
      onStrokeEnd: function (data) {
        canvasManager.onRemoteStrokeEnd(data);
      },
      onStrokesUpdate: function (strokes) {
        canvasManager.setStrokesFromServer(strokes);
      },
      onCursorUpdate: function (data) {
        canvasManager.updateRemoteCursor(data.userId, data.x, data.y, data.color);
      },
      onCursorRemove: function (data) {
        canvasManager.removeRemoteCursor(data.userId);
      }
    });

    canvasManager.setNetworkHandlers({
      emitStrokeStart: socketManager.emitStrokeStart,
      emitStrokePoint: socketManager.emitStrokePoint,
      emitStrokeEnd: socketManager.emitStrokeEnd,
      requestUndo: socketManager.requestUndo,
      emitCursorMove: socketManager.emitCursorMove
    });
  });
}());



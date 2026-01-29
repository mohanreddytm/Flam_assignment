// Canvas drawing logic: manages local drawing, rendering, and ghost cursors.

(function () {
  function createCanvasManager(canvasElement, undoButton) {
    const canvas = canvasElement;
    const ctx = canvas.getContext('2d');

    let userId = null;
    let userColor = '#22c55e';
    const lineWidth = 3;

    // Network handlers are injected from main.js
    const network = {
      emitStrokeStart: function () {},
      emitStrokePoint: function () {},
      emitStrokeEnd: function () {},
      requestUndo: function () {},
      emitCursorMove: function () {}
    };

    // Local state
    let isDrawing = false;
    let currentStroke = null;
    const strokesById = new Map();
    const strokeOrder = [];

    const cursorDots = new Map(); // userId -> DOM element

    function setUserId(id) {
      userId = id;
    }

    function setUserColor(color) {
      userColor = color;
    }

    function setNetworkHandlers(handlers) {
      if (!handlers) return;
      if (handlers.emitStrokeStart) network.emitStrokeStart = handlers.emitStrokeStart;
      if (handlers.emitStrokePoint) network.emitStrokePoint = handlers.emitStrokePoint;
      if (handlers.emitStrokeEnd) network.emitStrokeEnd = handlers.emitStrokeEnd;
      if (handlers.requestUndo) network.requestUndo = handlers.requestUndo;
      if (handlers.emitCursorMove) network.emitCursorMove = handlers.emitCursorMove;
    }

    function getCanvasRect() {
      return canvas.getBoundingClientRect();
    }

    function resizeCanvas() {
      const rect = getCanvasRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      redrawAllStrokes();
    }

    function toNormalizedPoint(clientX, clientY) {
      const rect = getCanvasRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function getCanvasSizeCss() {
      const rect = getCanvasRect();
      return { width: rect.width, height: rect.height };
    }

    function pointToCanvasCoords(point) {
      const { width, height } = getCanvasSizeCss();
      return {
        x: point.x * width,
        y: point.y * height
      };
    }

    function drawStrokeSegment(prevPoint, point, color, width) {
      const p0 = pointToCanvasCoords(prevPoint);
      const p1 = pointToCanvasCoords(point);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    function drawFullStroke(stroke) {
      if (!stroke.points || stroke.points.length === 0) return;
      const pts = stroke.points;
      if (pts.length === 1) {
        const p = pointToCanvasCoords(pts[0]);
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const first = pointToCanvasCoords(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i += 1) {
        const p = pointToCanvasCoords(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    function redrawAllStrokes() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < strokeOrder.length; i += 1) {
        const id = strokeOrder[i];
        const stroke = strokesById.get(id);
        if (stroke) {
          drawFullStroke(stroke);
        }
      }
    }

    function clearAndSetStrokes(strokes) {
      strokesById.clear();
      strokeOrder.length = 0;
      if (Array.isArray(strokes)) {
        strokes.forEach((s) => {
          if (!s || !s.strokeId) return;
          strokesById.set(s.strokeId, {
            strokeId: s.strokeId,
            userId: s.userId,
            color: s.color,
            width: s.width,
            points: Array.isArray(s.points) ? s.points.slice() : []
          });
          strokeOrder.push(s.strokeId);
        });
      }
      redrawAllStrokes();
    }

    function handlePointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      isDrawing = true;
      const point = toNormalizedPoint(event.clientX, event.clientY);
      const strokeId = `${userId || 'local'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      currentStroke = {
        strokeId,
        userId,
        color: userColor,
        width: lineWidth,
        points: [point]
      };
      strokesById.set(strokeId, currentStroke);
      strokeOrder.push(strokeId);

      network.emitStrokeStart({
        strokeId,
        userId,
        color: userColor,
        width: lineWidth,
        points: [point]
      });
    }

    function handlePointerMove(event) {
      if (!userId) return;
      const point = toNormalizedPoint(event.clientX, event.clientY);

      network.emitCursorMove({
        x: point.x,
        y: point.y
      });

      if (!isDrawing || !currentStroke) return;
      const pts = currentStroke.points;
      const prevPoint = pts[pts.length - 1];
      pts.push(point);
      drawStrokeSegment(prevPoint, point, currentStroke.color, currentStroke.width);

      network.emitStrokePoint({
        strokeId: currentStroke.strokeId,
        point
      });
    }

    function handlePointerUp() {
      if (!isDrawing) return;
      isDrawing = false;
      if (!currentStroke) return;

      if (currentStroke.points.length === 1) {
        const p = pointToCanvasCoords(currentStroke.points[0]);
        ctx.fillStyle = currentStroke.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentStroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      network.emitStrokeEnd({
        strokeId: currentStroke.strokeId
      });

      currentStroke = null;
    }

    function attachPointerEvents() {
      canvas.addEventListener('mousedown', handlePointerDown);
      canvas.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);

      canvas.addEventListener('touchstart', function (event) {
        if (event.touches.length > 0) {
          const touch = event.touches[0];
          handlePointerDown(touch);
        }
        event.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchmove', function (event) {
        if (event.touches.length > 0) {
          const touch = event.touches[0];
          handlePointerMove(touch);
        }
        event.preventDefault();
      }, { passive: false });

      window.addEventListener('touchend', function () {
        handlePointerUp();
      });
    }

    function handleUndoClick() {
      network.requestUndo();
    }

    function ensureCursorDot(userIdValue, color) {
      const container = document.getElementById('canvas-container');
      if (!container) return null;
      let dot = cursorDots.get(userIdValue);
      if (!dot) {
        dot = document.createElement('div');
        dot.className = 'cursor-dot';
        container.appendChild(dot);
        cursorDots.set(userIdValue, dot);
      }
      dot.style.backgroundColor = color || '#f97316';
      return dot;
    }

    function updateRemoteCursor(userIdValue, x, y, color) {
      if (!userIdValue || userIdValue === userId) return;
      const container = document.getElementById('canvas-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const dot = ensureCursorDot(userIdValue, color);
      if (!dot) return;
      const clampedX = clamp(x, 0, 1);
      const clampedY = clamp(y, 0, 1);
      const px = clampedX * rect.width;
      const py = clampedY * rect.height;
      dot.style.transform = `translate(${px}px, ${py}px)`;
    }

    function removeRemoteCursor(userIdValue) {
      const dot = cursorDots.get(userIdValue);
      if (dot && dot.parentNode) {
        dot.parentNode.removeChild(dot);
      }
      cursorDots.delete(userIdValue);
    }

    function syncCursors(cursorList) {
      cursorDots.forEach((dot) => {
        if (dot.parentNode) {
          dot.parentNode.removeChild(dot);
        }
      });
      cursorDots.clear();
      if (!Array.isArray(cursorList)) return;
      cursorList.forEach((c) => {
        updateRemoteCursor(c.userId, c.x, c.y, c.color);
      });
    }

    // Remote stroke event handlers
    function onRemoteStrokeStart(stroke) {
      if (!stroke || !stroke.strokeId) return;
      strokesById.set(stroke.strokeId, {
        strokeId: stroke.strokeId,
        userId: stroke.userId,
        color: stroke.color,
        width: stroke.width,
        points: Array.isArray(stroke.points) ? stroke.points.slice() : []
      });
      if (!strokeOrder.includes(stroke.strokeId)) {
        strokeOrder.push(stroke.strokeId);
      }
    }

    function onRemoteStrokePoint(data) {
      const { strokeId, point } = data;
      const stroke = strokesById.get(strokeId);
      if (!stroke) return;
      const pts = stroke.points;
      const prevPoint = pts[pts.length - 1] || point;
      pts.push(point);
      drawStrokeSegment(prevPoint, point, stroke.color, stroke.width);
    }

    function onRemoteStrokeEnd(data) {
      const { strokeId } = data;
      const stroke = strokesById.get(strokeId);
      if (!stroke) return;
      // Nothing extra needed; stroke already drawn incrementally.
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    attachPointerEvents();

    if (undoButton) {
      undoButton.addEventListener('click', handleUndoClick);
    }

    return {
      setUserId,
      setUserColor,
      setNetworkHandlers,
      setStrokesFromServer: clearAndSetStrokes,
      onRemoteStrokeStart,
      onRemoteStrokePoint,
      onRemoteStrokeEnd,
      updateRemoteCursor,
      removeRemoteCursor,
      syncCursors
    };
  }

  window.createCanvasManager = createCanvasManager;
}());



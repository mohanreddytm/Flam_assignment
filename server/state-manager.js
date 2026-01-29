// In-memory state for strokes and cursor positions

const strokes = [];
// Map of strokeId -> index in strokes array for quick lookup while drawing
const strokeIndexById = new Map();

// Map of userId -> { x, y, color }
const cursors = new Map();

function getStrokes() {
  // Return a shallow copy to avoid external mutation
  return strokes.map((s) => ({
    strokeId: s.strokeId,
    userId: s.userId,
    color: s.color,
    width: s.width,
    points: s.points.slice()
  }));
}

function startStroke(stroke) {
  if (!stroke || !stroke.strokeId) {
    return;
  }
  const copy = {
    strokeId: stroke.strokeId,
    userId: stroke.userId,
    color: stroke.color,
    width: stroke.width,
    points: Array.isArray(stroke.points) ? stroke.points.slice() : []
  };
  strokeIndexById.set(copy.strokeId, strokes.length);
  strokes.push(copy);
}

function addPointToStroke(strokeId, point) {
  if (!strokeIndexById.has(strokeId)) return;
  const index = strokeIndexById.get(strokeId);
  const stroke = strokes[index];
  if (!stroke) return;
  stroke.points.push(point);
}

function endStroke(strokeId) {
  // No additional metadata needed for now; function exists for symmetry
  if (!strokeIndexById.has(strokeId)) return;
}

function undoLastStrokeForUser(userId) {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    if (strokes[i].userId === userId) {
      const [removed] = strokes.splice(i, 1);
      strokeIndexById.delete(removed.strokeId);

      // Rebuild index map after removal
      strokeIndexById.clear();
      strokes.forEach((s, idx) => {
        strokeIndexById.set(s.strokeId, idx);
      });

      return true;
    }
  }
  return false;
}

function setCursorPosition(userId, cursor) {
  if (!userId || !cursor) return;
  cursors.set(userId, {
    x: cursor.x,
    y: cursor.y,
    color: cursor.color
  });
}

function removeCursor(userId) {
  cursors.delete(userId);
}

function getCursors() {
  const list = [];
  cursors.forEach((value, key) => {
    list.push({
      userId: key,
      x: value.x,
      y: value.y,
      color: value.color
    });
  });
  return list;
}

module.exports = {
  getStrokes,
  startStroke,
  addPointToStroke,
  endStroke,
  undoLastStrokeForUser,
  setCursorPosition,
  removeCursor,
  getCursors
};



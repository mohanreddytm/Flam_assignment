## Architecture Overview

This project is a minimal real-time collaborative drawing canvas using **Node.js**, **Express**, **Socket.io**, and **HTML5 Canvas**. All state is kept in memory; there is no database.

### High-Level Flow

- The **server** hosts the static frontend and manages a shared in-memory `strokes[]` array plus current cursor positions.
- Each **client**:
  - Renders a full-screen canvas.
  - Handles mouse / touch input and draws locally using `canvas.getContext('2d')`.
  - Uses Socket.io to send stroke and cursor events to the server.
- The **server** broadcasts stroke and cursor events to all other connected clients.

---

## Drawing Sync

### Data model

Each stroke is stored as:

```js
{
  strokeId: string,
  userId: string,   // socket.id
  color: string,
  width: number,    // line width in CSS pixels
  points: [         // sequence of points in normalized coordinates
    { x: number, y: number } // 0–1 relative to canvas width/height
  ]
}
```

On the server, all strokes live in a global array:

```js
const strokes = []; // in server/state-manager.js
```

The server exposes helpers to:

- `startStroke(stroke)` – add a new stroke with its first point.
- `addPointToStroke(strokeId, point)` – append points as the user draws.
- `endStroke(strokeId)` – currently a no-op, kept for symmetry.
- `getStrokes()` – return a copy of all strokes for new clients or full redraw.

### Event flow

1. **User draws locally**
   - On `mousedown` / `touchstart`, the client:
     - Creates a new `strokeId`.
     - Records the first point in **normalized coordinates** (0–1 based on canvas size).
     - Draws nothing yet or a single point dot.
     - Emits `stroke:start` with the stroke metadata and first point.
   - On `mousemove` / `touchmove` while drawing:
     - The client appends a new point to the local stroke.
     - It immediately draws a line segment between the last point and the new point using `ctx.moveTo` / `ctx.lineTo`.
     - It emits `stroke:point` with `{ strokeId, point }`.
   - On `mouseup` / `touchend`:
     - The client emits `stroke:end` with `{ strokeId }`.

2. **Server processes stroke events**
   - `stroke:start` → `startStroke(stroke)` and broadcast to all **other** clients.
   - `stroke:point` → `addPointToStroke(strokeId, point)` and broadcast to others.
   - `stroke:end` → `endStroke(strokeId)` and broadcast to others.

3. **Other clients render strokes**
   - On `stroke:start`, they create a local stroke entry.
   - On `stroke:point`, they:
     - Append the new point to that stroke.
     - Draw a line segment from the previous point to the new one using their own canvas size.
   - On `stroke:end`, nothing extra is required; the stroke is already drawn incrementally.

### Coordinate mapping (CSS pixels → canvas pixels)

- The canvas is styled to fill the viewport (`width: 100%; height: 100%`).
- On every resize:
  - `canvas.width` and `canvas.height` are set to `clientWidth * devicePixelRatio` and `clientHeight * devicePixelRatio`.
  - `ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)` is applied.
  - All strokes are **redrawn** from the shared history.
- Points sent over the wire are **normalized**:
  - `x = (clientX - rect.left) / rect.width`
  - `y = (clientY - rect.top) / rect.height`
- When rendering:
  - Each point is converted back to canvas coordinates using current CSS size:
    - `px = x * rect.width`
    - `py = y * rect.height`
- This keeps drawings visually consistent across clients with different resolutions and device pixel ratios.

---

## Undo Logic

### Per-user undo rule

Undo is **per-user** and affects only the last stroke created by the requesting user, across all clients.

### Server-side undo

1. Client clicks the **Undo** button.
2. Client emits `stroke:undo` to the server.
3. The server calls `undoLastStrokeForUser(userId)`:
   - Iterates `strokes[]` from the end.
   - Finds the last stroke whose `userId` matches the requesting user.
   - Removes that stroke from the array.
   - Rebuilds the internal `strokeIndexById` map.
4. If a stroke was removed:
   - The server broadcasts `strokes:update` with the **full updated** `strokes[]` history to all clients.

### Client-side undo handling

- On `strokes:update`:
  - Each client replaces its local stroke collection with the authoritative list from the server.
  - The canvas is **cleared and fully redrawn** from this shared history.
  - This guarantees that:
    - All clients see exactly the same canvas.
    - Only the requesting user’s last stroke is removed.
    - No flickering or partial erasures occur.

---

## Cursor Tracking and Ghost Cursors

### Data model

The server stores cursor positions in memory:

```js
// Map<userId, { x, y, color }>
const cursors = new Map();
```

Each cursor position is normalized (0–1) relative to the canvas/container size, plus a color string.

### Event flow

1. **Local cursor movement**
   - On every mouse / touch move, the client:
     - Computes normalized `{ x, y }` relative to the canvas.
     - Emits `cursor:move` with `{ x, y, color }`.

2. **Server cursor tracking**
   - On `cursor:move`:
     - Updates `cursors[userId] = { x, y, color }`.
     - Broadcasts `cursor:update` with `{ userId, x, y, color }` to all **other** clients.
   - On `disconnect`:
     - Removes the cursor from the map.
     - Broadcasts `cursor:remove` with `{ userId }`.

3. **Client ghost cursor rendering**
   - Instead of drawing cursors on the canvas, each client:
     - Maintains DOM elements (`.cursor-dot`) inside `#canvas-container`.
     - For each `cursor:update`:
       - Creates/updates a positioned `<div>` representing the remote cursor.
       - Positions it using:
         - `left = x * containerWidth`
         - `top = y * containerHeight`
   - On `cursor:remove`, the corresponding dot is removed.

This avoids redrawing the canvas just to move cursors and keeps drawing performance smooth.

---

## Why the Server Holds Stroke History

1. **Authoritative state**
   - The server is the single source of truth for `strokes[]`.
   - New clients can immediately render the full canvas by requesting the existing stroke history on `init`.

2. **Consistent undo semantics**
   - Because the server knows every stroke and its `userId`, it can reliably:
     - Find the last stroke for a given user.
     - Remove it and broadcast the updated history.
   - Clients never have to guess which strokes are “theirs”; they simply follow the shared history.

3. **Simple resync**
   - If a client disconnects or refreshes, the server’s `strokes[]` array is used to rebuild the canvas.
   - The client does not need to persist or reconcile local history.

4. **No database required**
   - For this minimal application, in-memory arrays are enough.
   - The state is lost when the server restarts, which is acceptable for a lightweight collaborative demo.

---

## File Responsibilities

- `server/server.js`
  - Sets up Express + HTTP server.
  - Serves static files from `client/`.
  - Initializes Socket.io and wires up all real-time events.
  - Handles connection lifecycle, stroke events, undo, and cursor events.

- `server/state-manager.js`
  - Maintains in-memory `strokes[]` and cursor positions.
  - Provides simple helper functions to query and mutate this state.

- `server/rooms.js`
  - Defines and manages the default room (`main`) that all users join.
  - Simplifies future extension to multiple rooms.

- `client/index.html`
  - Basic HTML shell, includes canvas, toolbar, and script tags.

- `client/style.css`
  - Full-screen layout, toolbar styling, and ghost cursor styling.

- `client/canvas.js`
  - All drawing logic using `canvas.getContext('2d')`.
  - Handles input events, local rendering, stroke history, resizing, and ghost cursor DOM elements.

- `client/websocket.js`
  - Wraps Socket.io client.
  - Listens for server events and exposes simple methods for emitting stroke and cursor events.

- `client/main.js`
  - Bootstraps the app:
    - Creates `canvasManager` and `socketManager`.
    - Wires callbacks between drawing logic and websocket logic.
    - Assigns each user a color and passes it to both canvas and websocket layers.



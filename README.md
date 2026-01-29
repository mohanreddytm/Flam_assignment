## Collaborative Canvas

A minimal, clean, real-time collaborative drawing canvas built with **Node.js**, **Express**, **Socket.io**, and **HTML5 Canvas** (no drawing libraries).

Multiple users can draw on the same canvas in real time, see each other’s cursors, and each user can undo only **their own** last stroke. All drawing is kept **in memory** on the server.

### Project Structure

```text
collaborative-canvas/
├── client/
│   ├── index.html
│   ├── style.css
│   ├── canvas.js
│   ├── websocket.js
│   └── main.js
├── server/
│   ├── server.js
│   ├── rooms.js
│   └── state-manager.js
├── package.json
├── README.md
└── ARCHITECTURE.md
```

### Requirements

- Node.js (v16+ recommended)

### Setup

```bash
npm install
```

### Run the app locally

```bash
npm start
# or
node server/server.js
```

Then open your browser at:

```text
http://localhost:3000
```

### Test real-time collaboration

1. Start the server:

   ```bash
   npm start
   ```

2. Open the app in two browser tabs (or two different browsers) pointing to `http://localhost:3000`.
3. Draw with the mouse in one tab:
   - You should see strokes appear **immediately** in that tab.
   - The same strokes should appear in the **other tab** in real time.
4. Move the mouse in one tab:
   - The **ghost cursor** (small colored circle) for that user appears and moves in the other tab.
5. Click **“Undo”** in one tab:
   - Only that user’s **last stroke** disappears from **both** tabs.
   - Other users’ strokes remain.
6. Refresh one of the tabs:
   - The full shared canvas history is restored from the server.

### Notes

- No database is used; all strokes and cursor positions live in memory on the server.
- The canvas is full-screen and responsive, with proper mapping from CSS pixels to canvas pixels using `devicePixelRatio`.
- Drawing is done with `canvas.getContext('2d')` only—no Fabric.js, Konva, or other drawing libraries.



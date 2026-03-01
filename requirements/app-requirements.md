# 90 Waypoint Map — App Requirements

## Background

The 90 Waypoint Walk is a walking experiment created by Marcus John Henry Brown, originating from a 19km stroll through Munich in August 2016. The walk follows a fixed sequence of 90 turns (left or right relative to current heading) recorded in a notebook. The same turn sequence can be applied anywhere in the world — the map stays the same, but distances and destinations change. The app draws this walk as an orthogonal grid map.

Source: https://www.marcusjohnhenrybrown.com/the-90-waypoint-walk/

---

## Map Generation

### Turn Sequence
- The walk consists of exactly **90 waypoints**, each representing a turn: **Left (L)** or **Right (R)** relative to the current direction of travel.
- The turn sequence is **fixed** — it does not change between runs. Embed a hardcoded sequence of 90 L/R values representing the original Munich walk. If the exact sequence is unavailable, generate one randomly on first load and persist it for the session.
- The walker begins facing **North** (up on the canvas).
- At each waypoint, apply the turn to update the heading: L turns 90° counter-clockwise, R turns 90° clockwise.
- After the turn, the walker travels in the new heading until the next waypoint.

### Distances
- The distance between consecutive waypoints (segment length) is **randomised per segment**, between a configurable minimum distance and `minDistance + 80px`.
- Default minimum distance: **60px**.
- All waypoints must remain within the canvas bounds (30px padding from all edges). If a segment would go out of bounds, pick the next available cardinal direction that keeps the path in bounds, then continue applying the turn sequence from there.

### Wildcards
- The walk includes **10 wildcards**. A wildcard skips a waypoint's turn — the walker continues straight ahead instead of turning.
- Wildcards are distributed across the sequence (e.g. every ~9th waypoint) or can be user-triggered.
- Visual indicator marks which waypoints are wildcards.

---

## Canvas & Rendering

### Grid
- Draw a background grid that covers only the bounding box of all placed waypoints, with **100px padding** on each side.
- Grid lines are subtle (light grey).

### Path Lines
- Connect consecutive waypoints with **orthogonal lines** (no diagonals): draw the horizontal segment first, then the vertical.
- Line colour: dark grey or black.
- Line weight: 2px.
- Parallel path lines must maintain a **comfortable minimum separation** — no two parallel segments that share overlapping range should be closer than the circle diameter (50px). If a new segment would run too close to an existing parallel segment, try alternative headings or segment lengths before placing.

### Waypoints
- Each waypoint is a **circle, radius 25px**, centred at its coordinate.
- **Waypoint 1 (start):** Black fill, white border, white number.
- **Waypoint 90 (end):** Black fill, white border, white number.
- **All other waypoints:** White fill, black border, black number.
- Wildcard waypoints: add a secondary visual marker (e.g. a small star or coloured ring).
- Label each waypoint with its sequence number (**1–90**) in bold Arial 20px, centred in the circle.
- Waypoints must not overlap — no two waypoint circles may share the same position or overlap each other.

### Iterate design
- Iterate designs until all path lines and waypoints have **comfortable minimum separation** AND **no overlapping waypoints**.
- Path lines can be any length to prioritise **comfortable minimum separation**.
- Only render the design when the above criteria has been met. 

---

## Controls

| Control | Behaviour |
|---|---|
| **Generate Walk** | Clears the canvas and draws a new walk using the fixed turn sequence with newly randomised segment distances. |
| **Clear** | Removes all waypoints and lines from the canvas. |
| **Min Distance slider** | Range 20–100px. Adjusts the minimum segment length for subsequent generations. |
| **Show/Hide Wildcards** | Toggle visibility of wildcard markers. |

---

## Canvas Size
- Canvas size must be A4 size.
- The path auto-centres after generation so the full walk is visible within the canvas.

---

## Interaction
- Clicking on a waypoint circle displays a tooltip/label showing: waypoint number, turn direction (L/R/Wildcard), and cumulative distance from the start.
- Hovering highlights the waypoint and its connecting segments.

---

## Technology
- Vanilla TypeScript with the Canvas 2D API — no external runtime dependencies.
- Single-file source (`src/index.ts`) compiled to `dist/index.js`, loaded by `index.html`.
- Build: `npm run build` (TypeScript compiler).
- Dev: `npm run dev` (watch mode) + `npm run serve` (Python HTTP server on port 8000).

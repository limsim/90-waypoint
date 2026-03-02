# 90 Waypoint Map — App Requirements

## Background

The 90 Waypoint Walk is a walking experiment created by Marcus John Henry Brown, originating from a 19km stroll through Munich in August 2016. The walk follows a fixed sequence of 90 turns (left or right relative to current heading) recorded in a notebook. The same turn sequence can be applied anywhere in the world — the map stays the same, but distances and destinations change. The app draws this walk as an orthogonal grid map.

Source: https://www.marcusjohnhenrybrown.com/the-90-waypoint-walk/

---

## Map Generation

### Turn Sequence
- The walk consists of between **10 and 90 waypoints** (configurable), each representing a turn: **Left (L)** or **Right (R)** relative to the current direction of travel.
- The turn sequence is **randomised** on each generation — a new sequence of L/R values is generated each time **Generate Walk** is clicked.
- The walker begins facing **North** (up on the canvas).
- At each waypoint, apply the turn to update the heading: L turns 90° counter-clockwise, R turns 90° clockwise.
- After the turn, the walker travels in the new heading until the next waypoint.
- Each waypoint records the **outbound turn** — the turn taken when leaving that waypoint toward the next — not the inbound turn used to arrive. The last waypoint has no outbound turn.

### Distances
- The distance between consecutive waypoints (segment length) is **randomised per segment**, between **60px and 140px**.
- All waypoints must remain within the canvas bounds (30px padding from all edges). If a segment would go out of bounds, pick the next available cardinal direction that keeps the path in bounds, then continue applying the turn sequence from there.

### Wildcards
- A wildcard skips a waypoint's turn — the walker continues straight ahead instead of turning.
- The number of wildcards scales with the waypoint count: `max(1, round(count / 9))` wildcards per walk.
- Wildcard positions are **randomised** on each generation.
- The first and last waypoints cannot be wildcards. Because turns are shifted to record the outbound turn (see below), wildcard selection also excludes position index 1 in the generation sequence, preventing waypoint #1 from inheriting a wildcard state after the shift.
- Visual indicator marks which waypoints are wildcards: an **orange ring** drawn outside the waypoint circle.

---

## Canvas & Rendering

### Grid
- Draw a background grid that covers only the bounding box of all placed waypoints, with **100px padding** on each side.
- Grid lines are subtle (light grey), with **60px cell size**.

### Path Lines
- Connect consecutive waypoints with **orthogonal lines** (no diagonals), drawn in the direction of the outbound turn at each waypoint: right turns corner horizontally first; left turns corner vertically first; wildcards follow the current heading.
- Line colour: dark grey or black.
- Line weight: 2px.
- Parallel path lines must maintain a **comfortable minimum separation** — no two parallel segments that share overlapping range should be closer than the circle diameter (50px). If a new segment would run too close to an existing parallel segment, try alternative headings or segment lengths before placing.

### Waypoints
- Each waypoint is a **circle, radius 25px**, centred at its coordinate.
- **Waypoint 1 (start):** Black fill, white border, white number.
- **Last waypoint (end):** Black fill, white border, white number.
- **All other waypoints:** White fill, black border, black number.
- Wildcard waypoints: add a secondary visual marker (e.g. a small star or coloured ring).
- Label each waypoint with its sequence number in bold Arial 20px, centred in the circle.
- Waypoints must not overlap — no two waypoint circles may share the same position or overlap each other.

### Iterate design
- Iterate designs until all path lines and waypoints have **comfortable minimum separation** AND **no overlapping waypoints**.
- Path lines can be any length to prioritise **comfortable minimum separation** — segment lengths may be scaled up by multipliers (up to 8×) to satisfy spacing constraints.
- If no valid position can be found with any heading/length combination, fall back to the heading that maximises clearance from existing waypoints (this placement may still fail validation and trigger a new attempt).
- Only render the design when the above criteria has been met.

---

## Controls

| Control | Behaviour |
|---|---|
| **Generate Walk** | Clears the canvas and draws a new walk with a freshly randomised turn sequence and segment distances. |
| **Clear** | Removes all waypoints and lines from the canvas. |
| **Waypoints** | Number input, range 10–90, default 90. Sets the number of waypoints for the next generation. |
| **Show/Hide Wildcards** | Toggle visibility of wildcard markers. Wildcards are **visible by default**. |
| **Show Turns** | Debug toggle. When enabled, displays the outbound turn direction (L, R, or W for wildcard) beside each waypoint. Hidden by default. |
| **Print** | Opens the browser print dialog; prints the canvas and legend on a single A4 page with all other UI chrome hidden. |

---

## Canvas Size
- Canvas starts at A4 size (794×1123px at 96 PPI).
- If no valid layout can be found after 50 attempts at the current size, the canvas grows by 10% and generation retries. This repeats until a valid walk is produced.
- The path auto-centres after generation so the full walk is visible within the canvas.
- If the canvas is wider than the viewport, it scales down to fit (preserving aspect ratio) so it always fits on screen without horizontal scrolling.

---

## Interaction
- Clicking on a waypoint circle displays a tooltip/label showing: waypoint number, turn direction (L/R/Wildcard), and cumulative distance from the start in px.
- Hovering over a waypoint: cursor changes to pointer, the waypoint gains a drop shadow, and its connecting path segments are thickened to 4px.
- Moving off the canvas removes all hover highlighting.

---

## Legend
- A legend is displayed below the canvas and is included in print output.
- It contains three entries: **Start / End** (black filled circle), **Waypoint** (white filled circle with black border), **Wildcard** (orange ring — walker goes straight).

---

## On Load
- A walk is automatically generated when the page first loads, so the canvas is never blank on opening.

---

## Technology
- Vanilla TypeScript with the Canvas 2D API — no external runtime dependencies.
- Single-file source (`src/index.ts`) compiled to `dist/index.js`, loaded by `index.html`.
- Build: `npm run build` (TypeScript compiler).
- Dev: `npm run dev` (watch mode) + `npm run serve` (Python HTTP server on port 8000).

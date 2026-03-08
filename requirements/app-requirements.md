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
- The first waypoint is always oriented facing North — the walker travels straight North to reach it, with no turn applied. The path from waypoint 1 to waypoint 2 therefore exits straight upward.
- Turns from the sequence are applied from the **third waypoint** onwards (i.e. the first turn determines how to arrive at waypoint 3).
- At each waypoint (from waypoint 3 onwards), apply the turn to update the heading: L turns 90° counter-clockwise, R turns 90° clockwise. After the turn, the walker travels in the new heading until the next waypoint.
- Each waypoint records the **outbound turn** — the turn taken when leaving that waypoint toward the next — not the inbound turn used to arrive. The **first and last waypoints** have no outbound turn and display no turn label.

### Distances
- The distance between consecutive waypoints (segment length) is **randomised per segment**, between **60px and 140px**.
- All waypoints must remain within the canvas bounds (30px padding from all edges).
- Each segment must exit the waypoint in a direction strictly consistent with the outbound turn label. Only the intended turn (L or R from the random sequence) is attempted — there is no opposite-turn fallback. Turn labels always match the random sequence exactly. If the intended turn cannot place the next waypoint for any segment length, the generation attempt fails and retries. A lookahead check is performed before committing to a position: if placing waypoint i would leave no valid position for waypoint i+1 (or i+2), the candidate is skipped in favour of one that keeps future placements open.

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
- Connect consecutive waypoints with **straight orthogonal lines** (no diagonals, no mid-segment corners). Each segment is either purely horizontal or purely vertical — turns happen at waypoints, not within them.
- Line colour: dark grey or black.
- Line weight: 2px.
- Parallel path lines must maintain a **comfortable minimum separation** — no two parallel segments that share overlapping range should be closer than **55px**. If a new segment would run too close to an existing parallel segment, try alternative segment lengths before placing.

### Waypoints
- Each waypoint is a **circle, radius 25px**, centred at its coordinate.
- **Waypoint 1 (start):** Black fill, white border, white number.
- **Last waypoint (end):** Black fill, white border, white number.
- **All other waypoints:** White fill, black border, black number.
- Wildcard waypoints display an **orange ring** (3px stroke) drawn at radius 30px outside the circle centre.
- Label each waypoint with its sequence number in bold Arial 20px, centred in the circle.
- Waypoints must not overlap — no two waypoint circles may share the same position or overlap each other.

### Turn Labels
- The outbound turn (L, R, or W for wildcard) is displayed as a small label beside each waypoint (first and last waypoints have no label).
- Labels are always placed at the **fixed top-right (NE, 45°)** position, at **46px from the waypoint centre**. This offset ensures the label clears the wildcard ring outer edge (~31.5px) with comfortable margin.
- The label position must maintain at least **8px clearance** from all non-adjacent path line segments. Generation steers path segments away from label zones proactively during placement; a layout is considered invalid if any label would be closer than 8px to a non-adjacent segment.

### Iterate design
- Iterate designs until all of the following criteria are met:
  - No two waypoint circles overlap.
  - No two parallel path segments with overlapping range are closer than 55px.
  - No path segment passes through a non-adjacent waypoint circle.
  - No existing segment passes through a non-adjacent waypoint circle.
  - Every turn label's fixed NE position has at least 8px clearance from all non-adjacent path segments.
- Path lines can be any length to satisfy spacing — segment lengths may be scaled up by multipliers (up to 8×).
- During placement, all of the above criteria are checked proactively before accepting a candidate position. This includes checking that existing segments do not cross the new waypoint's circle, and that the new waypoint's label has clearance from all existing segments.
- If the intended turn cannot place the next waypoint for any segment length (including scaled multipliers), the attempt fails and retries (no fallback to opposite turn, straight, or 180° headings).
- Only render the design when all criteria are met.

---

## Controls

| Control | Behaviour |
|---|---|
| **Generate Walk** | Clears the canvas and draws a new walk with a freshly randomised turn sequence and segment distances. The button is disabled and a loading overlay (spinner + "Generating…" label) is shown over the canvas while generation is in progress; both are restored when generation completes. |
| **Clear** | Removes all waypoints and lines from the canvas. |
| **Waypoints** | Number input, range 10–90, default 90. Sets the number of waypoints for the next generation. |
| **Show/Hide Wildcards** | Toggle visibility of wildcard markers. Wildcards are **visible by default**. |
| **Show Turns** | Toggle. When enabled, displays the outbound turn direction (L, R, or W for wildcard) beside each waypoint (first and last waypoints show no label). **Visible by default.** |
| **Print** | Opens the browser print dialog; prints the canvas and legend on a single A4 page with all other UI chrome hidden. |

---

## Canvas Size
- The rendered canvas is always capped at A4 size (794×1123px at 96 PPI).
- Internally, generation starts at A4 size. If no valid layout can be found after 200 attempts at the current size, the internal generation bounds grow by 10% and generation retries. This repeats until a valid walk is produced.
- Once a valid walk is found, the bounding box of the waypoints (plus 100px padding) is computed and scaled down uniformly to fit within A4 if it exceeds those dimensions. Walks that already fit within A4 are not scaled.
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
- Dev: `npm run dev` (watch mode) + `npm run serve` (Node.js static server, starts on port 8000 and automatically tries the next port if that port is already in use).

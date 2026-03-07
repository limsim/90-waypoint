Build a **90 Waypoint Walk** web app using **vanilla TypeScript** and the **Canvas 2D API** (no external runtime dependencies).

## Project structure

- `src/index.ts` — single source file
- `dist/index.js` — compiled output
- `index.html` — loads `dist/index.js`
- `tsconfig.json` — ES2020 target, strict mode, declarations + source maps to `dist/`
- `package.json` — scripts: `build` (tsc), `dev` (tsc --watch), `serve` (python3 -m http.server 8000)

---

## Walk generation

**Turn sequence**
- 10–90 waypoints (configurable, default 90), each turn is Left or Right relative to current heading.
- Sequence is randomised on every generation.
- Walker starts facing North.
- Waypoint 1 is placed after travelling straight North — no turn is applied to arrive at it.
- Turns are applied from waypoint 3 onwards (the first turn in the sequence determines how to arrive at waypoint 3).
- Each waypoint stores its **outbound turn** — the turn taken when leaving toward the next waypoint. Waypoints 1 and last have no outbound turn label.
- L = 90° counter-clockwise, R = 90° clockwise.

**Distances**
- Each segment is randomised between 60 px and 140 px.
- All waypoints must stay within canvas bounds (30 px padding). If a segment goes out of bounds, pick the next available cardinal direction that keeps the path in bounds, then resume the turn sequence.

**Wildcards**
- Count: `max(1, round(waypointCount / 9))`, positions randomised each generation.
- A wildcard skips the turn — walker continues straight.
- First waypoint, last waypoint, and sequence index 1 (after the outbound-turn shift) cannot be wildcards.
- Wildcard waypoints display an **orange ring** outside the circle.

---

## Canvas & rendering

**Grid**
- Covers the bounding box of all placed waypoints plus 100 px padding on each side.
- Light-grey grid lines, 60 px cell size.

**Path lines**
- Orthogonal only (no diagonals). Each segment between consecutive waypoints is a single straight horizontal or vertical line — no mid-segment corners.
- Turns happen at waypoints: the turn direction (L/R) changes the heading for the next segment.
- Colour: dark grey / black. Weight: 2 px.
- Parallel segments that share overlapping range must be separated by at least 50 px (the circle diameter).
- Turn labels (L/R/W) are always placed at the top-right (NE, 45°) of the waypoint at `TURN_LABEL_OFFSET` (46 px) from the waypoint centre. This offset clears the wildcard ring outer edge (~31.5 px) with comfortable margin. The label must have at least `TURN_LABEL_CLEARANCE` (8 px) clearance from all non-adjacent path line segments.

**Waypoints**
- Circle radius 25 px.
- Waypoint 1 and last waypoint: black fill, white border, white number.
- All others: white fill, black border, black number.
- Label: bold Arial 20 px, centred.
- No two waypoints may overlap.
- Turn labels (L/R/W) are always placed at the fixed NE (top-right, 45°) position at `TURN_LABEL_OFFSET` (46 px) from the waypoint centre — consistent across all waypoints.

**Iteration / retry logic**
- After each generation attempt, validate that all path lines and waypoints have comfortable minimum separation and no overlaps.
- To satisfy spacing, segment lengths may be scaled up by up to 8× their randomised base length.
- If no valid heading/length combination works, fall back to the heading that maximises clearance (placement may still fail and trigger a retry).
- Only render when validation passes.
- A generation is invalid if any turn label's fixed NE position has less than `TURN_LABEL_CLEARANCE` (8 px) clearance from any non-adjacent path line segment.
- During placement, candidate segments that would pass within `TURN_LABEL_CLEARANCE` of any existing waypoint's label zone are rejected before attempting other multipliers.
- After 50 failed attempts at the current canvas size, grow the canvas by 10 % and retry. Repeat until a valid walk is produced.
- Auto-centre the path after generation.

**Canvas size**
- Starts at A4 (794 × 1123 px at 96 PPI).
- If the canvas is wider than the viewport, scale it down to fit (preserve aspect ratio, no horizontal scroll).

---

## Controls

| Control | Behaviour |
|---|---|
| **Generate Walk** | Clear canvas, generate new randomised walk |
| **Clear** | Remove all waypoints and lines |
| **Waypoints** | Number input, range 10–90, default 90 |
| **Show/Hide Wildcards** | Toggle orange wildcard rings (visible by default) |
| **Show Turns** | Toggle L/R/W labels beside each waypoint (visible by default) |
| **Print** | Open browser print dialog; print canvas + legend on A4, hide all other UI chrome |

---

## Interaction

- **Click** a waypoint → tooltip showing waypoint number, turn direction (L / R / Wildcard), and cumulative distance from start in px.
- **Hover** a waypoint → cursor becomes pointer, waypoint gains drop shadow, its connecting path segments thicken to 4 px.
- **Mouse leaves canvas** → remove all hover highlighting.

---

## Legend

Displayed below the canvas and included in print output. Three entries:
- **Start / End** — black filled circle
- **Waypoint** — white filled circle with black border
- **Wildcard** — orange ring (walker goes straight)

---

## On load

Automatically generate a walk when the page first opens so the canvas is never blank.

---

Refer to the screenshot for the expected visual output: numbered circles connected by orthogonal lines on a grid, with red L/R/W turn labels, orange wildcard rings, and black-filled start/end circles.

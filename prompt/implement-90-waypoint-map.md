# Prompt: Implement the 90 Waypoint Map App

Rewrite `src/index.ts` and `index.html` to implement the 90 Waypoint Map as described below. Do not add external runtime dependencies — use only the Canvas 2D API and vanilla TypeScript.

---

## What to build

A browser-based app that draws the **90 Waypoint Walk** as an orthogonal grid map on an HTML canvas. The walk is a randomised sequence of left/right turns applied relative to the walker's current heading, producing a path that looks like a route through city blocks.

---

## Turn sequence

- Generate a random sequence of `count` values, each `'L'` or `'R'`, on every generation.
- **Waypoint 1 always faces North.** The walker travels straight North to place waypoint 1 and continues straight North to place waypoint 2 — no turn is applied for the first two steps.
- Turns from the sequence are applied from the **third waypoint** onwards.
- `L` rotates the heading 90° counter-clockwise; `R` rotates 90° clockwise.

---

## Wildcards

- A wildcard skips the scheduled turn — the walker continues straight ahead instead.
- Wildcard count: `max(1, round(count / 9))`.
- Wildcard positions are randomised on each generation.
- The first and last waypoints cannot be wildcards. To prevent waypoint 1 inheriting a wildcard state after the outbound-turn shift (see below), also exclude generation index 1 from wildcard selection.

---

## Map generation algorithm

1. Place the starting position at the centre of the canvas, heading **North**.
2. For each waypoint `i` from `0` to `count - 1`:
   a. If `i > 1` and the waypoint is not a wildcard, apply the turn from the sequence to update the heading.
   b. Pick a random base segment length between 60 px and 140 px.
   c. Try placing the next waypoint in the current heading using a range of length multipliers `[1.0, 1.5, 2.0, 0.75, 2.5, 0.5, 3.0, 4.0, 0.33, 5.0, 6.0, 7.0, 8.0]`. For each multiplier, also try the other three cardinal directions. Accept the first candidate that:
      - Stays within canvas bounds (30 px padding).
      - Does not place the new circle within 72 px (centre-to-centre) of any existing waypoint.
      - Does not create a parallel segment closer than 55 px to an existing parallel segment with overlapping range.
      - Does not route the L-shaped path through the circle of any non-adjacent existing waypoint.
   d. If no candidate passes all checks, fall back to the heading that maximises clearance from existing waypoints.
   e. Record the waypoint: position, sequence number, turn direction, heading, cumulative distance.
3. **Outbound-turn shift:** after all waypoints are placed, shift the stored turn and wildcard fields one position forward (`result[i] = result[i+1]`) so each waypoint records the turn taken when *leaving* it, not when arriving. The last waypoint keeps its own values.
4. Translate the entire path so it is centred on the canvas.

### Validation

Accept a generated layout only if:
- No two waypoint circles overlap (centre-to-centre distance ≥ 72 px for all pairs).
- No two parallel segments with overlapping range are closer than 55 px.
- No L-shaped segment passes through the circle (radius 25 px) of a non-adjacent waypoint.

Retry up to 50 times per canvas size. If 50 attempts all fail, grow the canvas by 10% (both dimensions) and retry. Repeat until a valid layout is found.

---

## Rendering

Draw in this order on each render:

1. **Grid** — light grey lines (`#e0e0e0`, 1 px) covering the bounding box of all waypoints plus 100 px padding, with a **60 px cell size**.
2. **Path lines** — connect consecutive waypoints with orthogonal lines (colour `#222`, 2 px, `round` lineCap). Corner routing: right turn = horizontal first, then vertical; left turn = vertical first, then horizontal; wildcard = follow current heading direction.
3. **Waypoint circles** — radius 25 px, centred at each waypoint:
   - Waypoint 1 (start) and last waypoint (end): black fill (`#000`), white border (2 px, `#fff`), white label.
   - All others: white fill (`#fff`), black border (2 px, `#000`), black label.
   - Wildcard waypoints (when Show Wildcards is enabled): draw an additional orange ring (3 px, `#f5a623`, radius 30 px) around the circle.
4. **Labels** — bold Arial 20 px, centred in the circle, showing the waypoint sequence number.
5. **Turn labels** (when Show Turns is enabled) — bold Arial 13 px at 45° offset from the circle edge, showing `L`, `R`, or `W` (wildcard) in red (`#e00`) or orange (`#f5a623`) for wildcards. Hidden on waypoint 1 and the last waypoint.

---

## Controls (render in a toolbar above the canvas)

| Control | Behaviour |
|---|---|
| **Generate Walk** button | Randomise a new turn sequence, re-run generation, and redraw. |
| **Clear** button | Remove all waypoints and lines; reset canvas to A4 size. |
| **Waypoints** number input | Range 10–90, default 90. Sets the waypoint count for the next generation. |
| **Show Wildcards** checkbox | Toggle the orange wildcard rings. **Checked by default.** |
| **Show Turns** checkbox | Toggle the L/R/W turn labels beside waypoints. **Checked by default.** |
| **Print** button | Call `window.print()`. CSS hides all UI chrome; canvas and legend print on a single A4 portrait page. |

---

## Interaction

- **Click** a waypoint circle: show a tooltip near the cursor displaying waypoint number, turn direction, and cumulative distance from start in px. Clicking elsewhere dismisses it.
- **Hover** a waypoint: change cursor to pointer, apply a drop shadow to the circle, and thicken its connecting segments to 4 px (`#555`). Mouseleave removes all hover state.

---

## Legend

Render a legend below the canvas (also visible in print) with three entries:
- Black filled circle → **Start / End**
- White circle with black border → **Waypoint**
- Orange ring → **Wildcard — walker goes straight**

---

## Canvas & layout

- Canvas starts at **A4 portrait** (794 × 1123 px at 96 PPI), white background.
- If the canvas is wider than `window.innerWidth - 40 px`, scale it down (CSS only, preserving aspect ratio).
- On each generation, resize the canvas to the tier that produced a valid layout.
- Print CSS: `@page { size: A4 portrait; margin: 10mm; }`. Canvas height set to `245mm`; toolbar, heading, and tooltip hidden.

---

## On load

Automatically call `generateWalk()` on construction so the canvas is never blank.

---

## Code structure

Implement a single `WaypointApp` class in `src/index.ts` with responsibilities clearly separated:

- `generateWalk()` — randomises the turn sequence, runs the layout algorithm, centres the path, and calls `drawCanvas()`.
- `tryGenerate(W, H, turnSequence, count, wildcardIndices)` — one layout attempt; returns `WaypointData[]`.
- `isValid(waypoints)` — validates overlap and separation constraints.
- `drawCanvas()` — full render (grid → lines → circles → labels).
- `setupEventListeners()` — wires all controls and canvas mouse events.

Export the class and instantiate it with `new WaypointApp()` at the bottom of the file.

`index.html` should include all CSS inline and load `dist/index.js` as a module script.

---

## What to preserve

- `package.json` scripts (`build`, `dev`, `serve`) — do not change.
- `tsconfig.json` — do not change.
- The `.github/` directory — do not touch.

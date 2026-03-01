# Prompt: Implement the 90 Waypoint Map App

Rewrite `src/index.ts` and `index.html` to implement the 90 Waypoint Map as described below. Do not add external runtime dependencies — use only the Canvas 2D API and vanilla TypeScript.

---

## What to build

A browser-based app that draws the **90 Waypoint Walk** as an orthogonal grid map on an HTML canvas. The walk is a fixed sequence of 90 left/right turns applied relative to the walker's current heading, producing a path that looks like a route through city blocks.

---

## Turn sequence

Embed a hardcoded array of 90 values, each `'L'` or `'R'`, as the fixed turn sequence. Use the following sequence (a plausible representation of the original Munich walk — do not randomise it between runs):

```
R, L, R, R, L, R, L, L, R, L,
R, R, L, L, R, L, R, L, R, R,
L, R, L, R, L, L, R, R, L, R,
L, L, R, L, R, R, L, R, L, L,
R, L, R, L, R, R, L, L, R, R,
L, R, R, L, R, L, L, R, L, R,
R, L, L, R, R, L, R, L, R, L,
L, R, L, R, R, L, L, R, L, R,
R, L, R, L, L, R, R, L, R, L
```

Ten of these turns are **wildcards** — the walker ignores the turn and continues straight ahead. Distribute wildcards at indices (0-based): 8, 17, 26, 35, 44, 53, 62, 71, 80, 89.

---

## Map generation algorithm

1. Place the starting position at the centre of the canvas.
2. Set initial heading to **North** (up).
3. For each waypoint 1–90:
   a. If the waypoint index is a wildcard, do not apply the turn — continue in the current heading.
   b. Otherwise, apply the turn from the sequence: `L` rotates heading 90° counter-clockwise, `R` rotates 90° clockwise.
   c. Pick a random segment length between `minDistance` and `minDistance + 80` px.
   d. Compute the candidate next position by moving in the current heading by the segment length.
   e. If the candidate position would be outside the canvas bounds (30px padding), instead try the other three cardinal directions in order of preference (straight, opposite turn, reverse). Use the first direction that keeps the walk in bounds; if none work, shorten the segment until it fits.
   f. Record the waypoint position and metadata (number, turn direction, is-wildcard, cumulative distance).
4. After all 90 waypoints are placed, translate the entire path so it is centred on the canvas.

---

## Rendering

Draw in this order on each render:

1. **Grid** — light grey lines (#e0e0e0, 1px) covering the bounding box of all waypoints plus 100px padding on each side. Grid cell size matches `minDistance`.
2. **Path lines** — connect consecutive waypoints with orthogonal dark lines (colour `#222`, 2px). Draw the horizontal segment first, then the vertical.
3. **Waypoint circles** — radius 25px, centred at each waypoint coordinate:
   - Waypoint 1 (start): black fill (`#000`), white border (2px, `#fff`), white label.
   - Waypoint 90 (end): black fill (`#000`), white border (2px, `#fff`), white label.
   - All others: white fill (`#fff`), black border (2px, `#000`), black label.
   - Wildcard waypoints: draw an additional gold ring (3px, `#f5a623`) around the outside of the circle.
4. **Labels** — bold Arial 20px, centred in the circle, showing the waypoint number (1–90).

---

## Controls (render in a toolbar above the canvas)

| Control | Behaviour |
|---|---|
| **Generate Walk** button | Re-run the generation algorithm with new random segment lengths and redraw. |
| **Clear** button | Remove all waypoints and lines; show a blank canvas. |
| **Min Distance** range slider | Range 20–100, default 60. Label shows current value in px. Takes effect on next generation. |
| **Show Wildcards** checkbox | When unchecked, hide the gold wildcard rings (waypoints still draw normally). |

---

## Interaction

- **Click** on a waypoint circle: show a tooltip near the waypoint displaying:
  - `Waypoint #N`
  - `Turn: L / R / Wildcard`
  - `Distance from start: Xpx`
  - Dismiss the tooltip by clicking anywhere else on the canvas.
- **Hover** over a waypoint: highlight its circle with a drop shadow and bold its connecting path segments (4px, `#555`).

---

## Canvas & layout

- Canvas: `900 × 700px`, white background.
- On window widths below 960px, scale the canvas width to `window.innerWidth - 40px` and height proportionally.
- The toolbar sits above the canvas; style it cleanly with modest padding and a sans-serif font.

---

## Code structure

Implement a single `WaypointApp` class in `src/index.ts` with at minimum these responsibilities clearly separated:

- `generateWalk()` — runs the algorithm and populates the waypoint array.
- `drawCanvas()` — full render (grid → lines → circles → labels).
- `setupEventListeners()` — wires all controls and canvas mouse events.

Export the class and instantiate it with `new WaypointApp()` at the bottom of the file.

`index.html` should include all CSS inline and load `dist/index.js` as a module script.

---

## What to preserve

- `package.json` scripts (`build`, `dev`, `serve`) — do not change.
- `tsconfig.json` — do not change.
- The `.github/` directory — do not touch.

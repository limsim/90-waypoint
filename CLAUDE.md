# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build   # Compile TypeScript to dist/
npm run dev     # Watch mode (recompiles on changes)
npm run serve   # Serve on http://localhost:8000
```

After editing `src/index.ts`, run `npm run build` before opening `index.html` — the browser loads `dist/index.js`.

## Architecture

Single-page canvas app with no runtime dependencies. One TypeScript class (`WaypointApp` in `src/index.ts`) manages all state and rendering. The compiled output is loaded directly by `index.html`.

**Data model:** `Waypoint { x, y, number }` — waypoints are stored as an ordered array; sequence matters for rendering and cardinal-direction logic.

**Waypoint placement rules:**
- First waypoint: anywhere within 30px canvas padding
- Subsequent waypoints: placed in a cardinal direction (N/S/E/W) from the last waypoint, at a random distance between `minDistance` and `minDistance + 80`
- Overlap check runs against all existing waypoints; falls back to alternative cardinal directions if the preferred one overlaps

**Rendering pipeline** (`drawCanvas`):
1. Clear canvas
2. Draw grid (only within waypoint bounding box + 100px padding)
3. Draw orthogonal connection lines (horizontal segment first, then vertical)
4. Draw waypoint circles (first/last: black fill; middle: white fill)

**tsconfig:** `ES2020` target, strict mode, outputs declarations and source maps to `dist/`.

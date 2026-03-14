# Test Coverage Analysis

> Last updated: 2026-03-14 — corrected against actual test files `src/walk.test.ts` and `src/app.test.ts`, which were added after the original analysis was written.

## Test Types

| Label | Framework | What it tests |
|---|---|---|
| **Unit** | Vitest | Pure functions in `src/walk.ts` — no DOM, no browser |
| **App** | Vitest + jsdom | `WaypointApp` class in `src/index.ts` — DOM interactions, canvas mock |
| **Visual** | Playwright + canvas interception | Canvas draw calls captured via `CanvasRenderingContext2D` prototype patching |
| **E2E** | Playwright | Full browser interactions — clicks, inputs, hover, DOM state |

---

## Coverage Summary

**~33 / 65 requirements covered (≈51%)**
*(counting partials as 0.5 gives ~37 / 65 ≈ 56%)*

### By Category

| Category | Covered | Partial | Not Covered |
|---|---|---|---|
| **Map Generation** (turn sequence, distances, wildcards) | 8 | 1 | 7 |
| **Canvas & Rendering** (grid, path lines, waypoints, labels) | 12 | 1 | 3 |
| **Layout Validation** (overlap, spacing, clearance) | 3 | 0 | 3 |
| **Controls** (buttons, inputs, toggles) | 5 | 3 | 3 |
| **Canvas Size** | 2 | 0 | 4 |
| **Interaction** (hover, click, tooltip) | 2 | 1 | 2 |
| **Legend** | 0 | 0 | 3 |
| **On Load** | 0 | 1 | 0 |

---

## Full Requirement-by-Requirement Table

| Requirement Category | Specific Requirement | Status | Existing Test | Test Type Needed |
|---|---|---|---|---|
| **Turn Sequence** | 10–90 waypoints, configurable | NOT COVERED | — | E2E: assert input accepts 10 and 90, rejects values outside range |
| | Turn sequence randomised on each generation | NOT COVERED | — | Unit: generate two sequences, assert they differ (probabilistic) |
| | Walker begins facing North | COVERED | `walk.test.ts` — tryGenerate north-facing start | — |
| | First waypoint always faces North, path exits upward | COVERED | `walk.test.ts` — wp[1].y < wp[0].y | — |
| | Turns applied from waypoint 3 onwards | NOT COVERED | — | Unit: verify result[0] and result[1] both have heading N even with all-L turn sequence |
| | L = 90° CCW, R = 90° CW | COVERED | `walk.test.ts` — TURN_LEFT / TURN_RIGHT | — |
| | First and last waypoints have no outbound turn/label | PARTIAL | `visual-check.spec.ts` (styling only) | Visual: assert no L/R/W text drawn at NE position of waypoint 1 or last waypoint |
| **Distances** | Segment length randomised 60–140px | NOT COVERED | — | Unit: export `SEG_MIN=60` and `SEG_JITTER=80`; assert constant values |
| | Segment length multipliers up to 8× | NOT COVERED | — | Unit: export `MULTIPLIERS`; assert `Math.max(...MULTIPLIERS) === 8.0` |
| | All waypoints within 30px canvas padding | COVERED | `walk.test.ts` — generateWalk integration (bounds check) | — |
| | Lookahead check prevents orphaning future waypoints | NOT COVERED | — | Unit: construct near-wall scenario; verify fallback position is still placeable |
| **Wildcards** | Count = max(1, round(count/9)) | COVERED | `walk.test.ts` — wildcard index selection | — |
| | Wildcard positions randomised per generation | NOT COVERED | — | Unit: generate two walks with same turn sequence, assert wildcard positions differ |
| | First/last waypoints cannot be wildcards | COVERED | `walk.test.ts` — wildcard index selection (1000 iterations) | — |
| | Position index 1 excluded post-turn-shift | COVERED | `walk.test.ts` — wildcard index selection | — |
| | Orange ring visual indicator | COVERED | `visual-check.spec.ts` | — |
| **Grid** | Covers bounding box with 100px padding | NOT COVERED | — | Visual: verify grid lines exist at canvas edges relative to waypoint bounding box |
| | Light grey (#e0e0e0), 60px cells | NOT COVERED | — | Visual: assert captured lines with `strokeStyle '#e0e0e0'` have consistent 60px spacing |
| **Path Lines** | Straight orthogonal (H or V only) | COVERED | `visual-check.spec.ts` | — |
| | Colour #222222 | COVERED | `visual-check.spec.ts` | — |
| | Weight 2px | COVERED | `visual-check.spec.ts` | — |
| | Parallel segments ≥55px apart | COVERED | `visual-check.spec.ts` | — |
| **Waypoints** | Circle radius 25px | COVERED | `visual-check.spec.ts` | — |
| | Waypoint 1: black fill, white border, white number | COVERED | `visual-check.spec.ts` | — |
| | Last waypoint: black fill, white border, white number | COVERED | `visual-check.spec.ts` | — |
| | Intermediate: white fill, black border, black number | COVERED | `visual-check.spec.ts` | — |
| | Orange wildcard ring at radius 30px, 3px stroke | COVERED | `visual-check.spec.ts` | — |
| | Numbers bold Arial 20px, centred | COVERED | `visual-check.spec.ts` | — |
| | No two waypoint circles overlap | COVERED | `visual-check.spec.ts` | — |
| **Turn Labels** | L/R/W labels beside intermediate waypoints | PARTIAL | `visual-check.spec.ts` (labels exist, position correct) | Visual: assert label count equals waypoint count − 2; assert no label at waypoint 1 or last |
| | Fixed NE (45°) position, 46px from centre | COVERED | `visual-check.spec.ts` | — |
| | Bold 13px Arial | COVERED | `visual-check.spec.ts` | — |
| | ≥8px clearance from non-adjacent segments | NOT COVERED | — | Unit: export `canPlace`; test `isValid` rejects layout with label <8px from non-adjacent segment |
| **Layout Validation** | No waypoint circles overlap | COVERED | `visual-check.spec.ts` + `walk.test.ts` — isValid() | — |
| | No parallel segments closer than 55px | COVERED | `visual-check.spec.ts` + `walk.test.ts` — isValid() | — |
| | No segment passes through non-adjacent waypoint circle | COVERED | `walk.test.ts` — isValid() segment/circle crossing | — |
| | Segment ≥35px from any waypoint centre (incl. wildcard ring) | NOT COVERED | — | Unit: export `canPlace`; assert it rejects segment at 27px, accepts at 36px |
| | Label ≥8px clearance from non-adjacent segments | NOT COVERED | — | Unit: `isValid` rejects layout with label at 6px from segment |
| | Retry on invalid layout (200 attempts, then +10% bounds) | NOT COVERED | — | App Unit: mock `tryGenerate` to always fail; verify canvas dimensions grow by `SCALE_STEP` |
| **Controls — Generate Walk** | Button triggers new walk | NOT COVERED | — | App Unit + E2E: click Generate Walk; assert canvas data URL changes |
| | Button disabled during generation | PARTIAL | `visual-check.spec.ts` (after-load state only) | E2E: click Generate; assert `#generateBtn` is disabled before load completes |
| | Loading overlay visible during generation | PARTIAL | `visual-check.spec.ts` (after-load state only) | E2E: assert `#loading` has class `visible` before generation completes |
| **Controls — Clear** | Removes all waypoints and lines | COVERED | `app.test.ts` — Clear button resets waypoints to [] | E2E: generate a walk, click Clear, assert canvas has no dark pixels |
| **Controls — Waypoints** | Input range 10–90, default 90 | PARTIAL | `app.test.ts` — clamping logic only; default 90 not tested | E2E: assert input value is 90 on load; assert `min`/`max` attributes present |
| | Setting affects next generation | NOT COVERED | — | E2E: set input to 10, click Generate Walk, assert exactly 10 waypoint circles drawn |
| **Controls — Show/Hide Wildcards** | Toggle hides/shows orange rings | COVERED | `visual-check.spec.ts` | — |
| | Visible by default | COVERED | `visual-check.spec.ts` | — |
| **Controls — Show Turns** | Toggle hides/shows labels | COVERED | `visual-check.spec.ts` | — |
| | Visible by default | COVERED | `visual-check.spec.ts` | — |
| **Controls — Print** | Opens print dialog, hides UI chrome | NOT COVERED | — | E2E: intercept `window.print`, click Print button, assert it was called |
| **Canvas Size** | CSS display capped at A4 (794×1123px) | COVERED | `visual-check.spec.ts` | — |
| | Internal generation starts at A4 | NOT COVERED | — | App Unit: spy on `tryGenerate`; assert first call uses `A4_W` × `A4_H` |
| | Retry with +10% growth after 200 failed attempts | NOT COVERED | — | App Unit: mock `tryGenerate` to fail 200 times; assert second call uses `A4_W * 1.1` |
| | Bounding box + 100px padding scaled to fit A4 if needed | NOT COVERED | — | Unit: generate oversized walk; assert canvas pixel dimensions ≤ A4 after fit |
| | Path auto-centres after generation | COVERED | `walk.test.ts` — centering logic (bounding-box midpoint = canvas midpoint) | — |
| | Scales to fit viewport, no horizontal scroll | NOT COVERED | — | E2E: assert `scrollWidth <= clientWidth` at viewports 375px, 768px, 1280px |
| **Interaction** | Click shows tooltip: number, turn, cumulative distance | PARTIAL | `app.test.ts` — tooltip shown on click, but content not asserted | E2E: click a waypoint circle; assert `#tooltip` contains number, turn, and distance text |
| | Hover: cursor changes to pointer | COVERED | `app.test.ts` — mousemove sets `cursor: pointer` | — |
| | Hover: waypoint gains drop shadow | NOT COVERED | — | Visual: hover over waypoint; assert shadow drawing calls present in re-captured canvas |
| | Hover: connecting segments thicken to 4px | NOT COVERED | — | Visual: hover over waypoint; assert adjacent path line captures have `lineWidth 4` |
| | Mouse leave: all hover highlighting removed | COVERED | `app.test.ts` — mouseleave resets `hoveredIndex` and cursor | — |
| **Legend** | Displayed below canvas | NOT COVERED | — | E2E: assert legend element is visible and positioned below `#waypointCanvas` |
| | Included in print output | NOT COVERED | — | E2E: `page.emulateMedia({ media: 'print' })`; assert legend is not hidden |
| | Three entries: Start/End, Waypoint, Wildcard | NOT COVERED | — | E2E: assert legend DOM contains text matching start/end, waypoint, and wildcard |
| **On Load** | Walk auto-generated on page load | PARTIAL | `app.test.ts` — constructor auto-generates; E2E browser test missing | E2E: navigate to page; wait for load; assert canvas has non-transparent pixels |

---

## What IS Covered

### `visual-check.spec.ts`
- Path lines: orthogonal, colour `#222222`, weight 2px, ≥55px separation
- Waypoints: radius 25px, endpoint colours, intermediate colours, no circle overlap
- Wildcards: orange ring r=30, colour `#f5a623`, lineWidth=3, toggle hides/shows
- Turn labels: exist, bold 13px, NE position ~46px, toggle hides/shows
- Canvas CSS size ≤ A4 (794×1123px)
- Show Wildcards / Show Turns default to checked

### `src/walk.test.ts` *(added after original analysis)*
- TURN_LEFT / TURN_RIGHT — all cardinal direction transitions
- `overlaps()`, `inBounds()`, `segTooClose()`, `segCrossesCircle()`, `pointToSegDist()`
- `turnLabelPos()` — NE position, distance, 45° diagonal, clearance from wildcard ring
- `isValid()` — circles overlap, parallel segments, segment crossing non-adjacent circle
- `tryGenerate()` — north-facing start, cumulative distance monotonicity
- Wildcard index selection — never index 0, 1, or count-1; count formula
- Turn/heading consistency for counts 10, 45, 90
- Centering logic — bounding-box midpoint equals canvas midpoint
- Integration — `isValid` passes and all waypoints within canvas bounds after centering

### `src/app.test.ts` *(added after original analysis)*
- Auto-generates walk on construction
- Clear button resets waypoints to `[]`
- Waypoint count clamping (value outside 10–90 is clamped)
- Show Wildcards / Show Turns checkbox change triggers redraw
- Click on waypoint shows tooltip; click off hides tooltip
- `hitTest` returns correct index within radius, -1 for miss
- `mousemove` over waypoint: `hoveredIndex` set, cursor = pointer; off: reset
- `mouseleave`: `hoveredIndex` = -1, cursor = default
- `drawCanvas` calls `ctx.save`/`restore` when a waypoint is hovered
- Wildcard path rendering (N/S and E/W heading branches)

---

## Priority Gaps

### 1. Unit: walk.ts missing exports (blocks A-category tests)
- **Export needed:** `SEG_MIN`, `SEG_JITTER`, `MULTIPLIERS`, `canPlace`
- These unlock: segment length range, multiplier max, `SEG_CLEAR_R` boundary, label clearance

### 2. Layout Validation (correctness-critical)
- **Unit:** `canPlace` rejects segment at 27px from waypoint; accepts at 36px
- **Unit:** `isValid` rejects layout where turn label is <8px from non-adjacent segment
- **App Unit:** Canvas grows by 10% after 200 `tryGenerate` failures

### 3. Generation Logic (logic-critical)
- **Unit:** Segment base length is 60–140px (`SEG_MIN` / `SEG_JITTER` constants)
- **Unit:** Multipliers include 8.0 (max stretch)
- **Unit:** Turns NOT applied at indices 0 and 1

### 4. Interaction (partially untested)
- **E2E:** Click tooltip content: waypoint number, turn, cumulative distance
- **Visual:** Hover drop shadow; adjacent segments thicken to 4px

### 5. Controls & Canvas Size (E2E gaps)
- **E2E:** Generate Walk button produces a changed canvas
- **E2E:** Waypoint count default 90; setting to 10 gives exactly 10 waypoints
- **E2E:** No horizontal scroll at 375px / 768px / 1280px viewports

### 6. Legend & On Load (completely untested in browser)
- **E2E:** Legend present below canvas with all three entries
- **E2E:** Legend not hidden in print media
- **E2E:** Navigate to page → canvas has content

---

## Test File Status

| File | Status |
|---|---|
| `src/walk.test.ts` | Active — ~60 unit tests covering geometry, validation, and generation |
| `src/app.test.ts` | Active — ~15 integration tests covering WaypointApp class |
| `tests/visual-check.spec.ts` | Active — ~30 visual/geometric tests via canvas interception |
| `tests/e2e.spec.ts` | **Missing** — needs to be created (see `prompt/test-implementation-plan.md`) |
| `tests/seed.spec.ts` | Placeholder — no tests |
| `tests/example.spec.ts` | Playwright demo — not relevant to app |

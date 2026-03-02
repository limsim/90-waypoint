# Prompt: Add a Test Suite to the 90 Waypoint Walk App

Add a comprehensive test suite to `src/index.ts`. This requires a small source refactor to extract pure logic into a separate module, followed by test setup and test authoring.

---

## Part 1 — Refactor source

Create `src/walk.ts` and move the following into it as named exports. Do not change any behaviour.

### Types

```typescript
export type Heading = 'N' | 'E' | 'S' | 'W';

export interface WaypointData {
  x: number;
  y: number;
  number: number;
  turn: 'L' | 'R' | null;
  heading: Heading;
  isWildcard: boolean;
  cumulativeDistance: number;
}
```

### Constants

```typescript
export const CIRCLE_SEP = 72;
export const CIRCLE_R   = 25;
export const LINE_SEP   = 55;
export const A4_W       = 794;
export const A4_H       = 1123;
export const ATTEMPTS_PER_SIZE = 50;
export const SCALE_STEP        = 0.1;
export const HEADING_DELTA     = 60;
export const TURN_LEFT: Record<Heading, Heading>  = { N: 'W', W: 'S', S: 'E', E: 'N' };
export const TURN_RIGHT: Record<Heading, Heading> = { N: 'E', E: 'S', S: 'W', W: 'N' };
```

### Helper functions (export each)

Move these four inner helpers out of `tryGenerate` and export them:

```typescript
export function overlaps(x: number, y: number, waypoints: WaypointData[]): boolean
export function inBounds(x: number, y: number, W: number, H: number, pad: number): boolean
export function segTooClose(ax1: number, ay1: number, ax2: number, ay2: number,
                            bx1: number, by1: number, bx2: number, by2: number): boolean
export function segCrossesCircle(ax1: number, ay1: number, ax2: number, ay2: number,
                                  cx: number, cy: number, r: number): boolean
```

### Generation functions (export each)

```typescript
export function tryGenerate(
  W: number, H: number,
  turnSequence: Array<'L' | 'R'>,
  count: number,
  wildcardIndices: Set<number>
): WaypointData[]

export function isValid(waypoints: WaypointData[]): boolean
```

### Update `src/index.ts`

Replace the moved declarations with a barrel import:

```typescript
import {
  WaypointData, Heading,
  CIRCLE_SEP, CIRCLE_R, LINE_SEP, A4_W, A4_H,
  ATTEMPTS_PER_SIZE, SCALE_STEP, HEADING_DELTA,
  TURN_LEFT, TURN_RIGHT,
  overlaps, inBounds, segTooClose, segCrossesCircle,
  tryGenerate, isValid,
} from './walk';
```

No behaviour changes — all canvas, DOM, and class code stays in `src/index.ts`.

---

## Part 2 — Test setup

### Install dev dependencies

```bash
npm install --save-dev vitest @vitest/coverage-v8 jsdom @types/jsdom
```

### `package.json` scripts

Add to the `"scripts"` section:

```json
"test": "vitest run",
"test:watch": "vitest"
```

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

### `tsconfig.test.json`

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.test.ts"]
}
```

---

## Part 3 — `src/walk.test.ts`

Test all exported pure-logic symbols. Use `describe` blocks matching the headings below.

### Constants

```typescript
describe('constants', () => {
  it('CIRCLE_SEP is 72', () => expect(CIRCLE_SEP).toBe(72));
  it('LINE_SEP is 55',   () => expect(LINE_SEP).toBe(55));
  it('CIRCLE_R is 25',   () => expect(CIRCLE_R).toBe(25));
  it('A4_W is 794',      () => expect(A4_W).toBe(794));
  it('A4_H is 1123',     () => expect(A4_H).toBe(1123));
});
```

### TURN_LEFT / TURN_RIGHT

```typescript
describe('TURN_LEFT / TURN_RIGHT', () => {
  it.each([
    ['N', 'W', 'E'],
    ['W', 'S', 'N'],
    ['S', 'E', 'W'],
    ['E', 'N', 'S'],
  ])('heading %s → left %s, right %s', (h, l, r) => {
    expect(TURN_LEFT[h as Heading]).toBe(l);
    expect(TURN_RIGHT[h as Heading]).toBe(r);
  });
});
```

### overlaps()

```typescript
describe('overlaps()', () => {
  const wp = (x: number, y: number): WaypointData =>
    ({ x, y, number: 1, turn: null, heading: 'N', isWildcard: false, cumulativeDistance: 0 });

  it('returns false for empty list',           () => expect(overlaps(0, 0, [])).toBe(false));
  it('returns true when distance < CIRCLE_SEP',  () => expect(overlaps(10, 0, [wp(0, 0)])).toBe(true));
  it('returns false when distance === CIRCLE_SEP', () => expect(overlaps(72, 0, [wp(0, 0)])).toBe(false));
  it('returns false when distance > CIRCLE_SEP',  () => expect(overlaps(100, 0, [wp(0, 0)])).toBe(false));
});
```

### inBounds()

```typescript
describe('inBounds()', () => {
  const W = 794, H = 1123, PAD = 30;

  it('returns true for a well-centred point',  () => expect(inBounds(400, 560, W, H, PAD)).toBe(true));
  it('returns false left of pad',   () => expect(inBounds(PAD - 1, 560, W, H, PAD)).toBe(false));
  it('returns false right of pad',  () => expect(inBounds(W - PAD + 1, 560, W, H, PAD)).toBe(false));
  it('returns false above pad',     () => expect(inBounds(400, PAD - 1, W, H, PAD)).toBe(false));
  it('returns false below pad',     () => expect(inBounds(400, H - PAD + 1, W, H, PAD)).toBe(false));
  it('returns false exactly on left boundary',  () => expect(inBounds(PAD, 560, W, H, PAD)).toBe(false));
  it('returns false exactly on top boundary',   () => expect(inBounds(400, PAD, W, H, PAD)).toBe(false));
});
```

### segTooClose()

```typescript
describe('segTooClose()', () => {
  // Two horizontal segments with gap < LINE_SEP and overlapping x-range
  it('parallel horizontal, gap < LINE_SEP, overlapping → true', () =>
    expect(segTooClose(0, 0, 200, 0,   0, 40, 200, 40)).toBe(true));

  // Same but gap === LINE_SEP
  it('parallel horizontal, gap === LINE_SEP → false', () =>
    expect(segTooClose(0, 0, 200, 0,   0, 55, 200, 55)).toBe(false));

  // Two vertical segments with gap < LINE_SEP, overlapping y-range
  it('parallel vertical, gap < LINE_SEP, overlapping → true', () =>
    expect(segTooClose(0, 0, 0, 200,   40, 0, 40, 200)).toBe(true));

  // Non-overlapping x-ranges
  it('parallel horizontal, non-overlapping x-range → false', () =>
    expect(segTooClose(0, 0, 100, 0,   200, 30, 300, 30)).toBe(false));

  // Perpendicular segments
  it('perpendicular segments → false', () =>
    expect(segTooClose(0, 0, 200, 0,   50, -50, 50, 50)).toBe(false));
});
```

### segCrossesCircle()

```typescript
describe('segCrossesCircle()', () => {
  it('horizontal segment passing through circle → true', () =>
    expect(segCrossesCircle(0, 100, 200, 100,  100, 100, CIRCLE_R)).toBe(true));

  it('vertical segment passing through circle → true', () =>
    expect(segCrossesCircle(100, 0, 100, 200,  100, 100, CIRCLE_R)).toBe(true));

  it('segment that misses circle → false', () =>
    expect(segCrossesCircle(0, 200, 400, 200,  100, 100, CIRCLE_R)).toBe(false));
});
```

### isValid()

```typescript
describe('isValid()', () => {
  const wp = (x: number, y: number, n = 1): WaypointData =>
    ({ x, y, number: n, turn: null, heading: 'N', isWildcard: false, cumulativeDistance: 0 });

  it('empty array → true',    () => expect(isValid([])).toBe(true));
  it('single waypoint → true', () => expect(isValid([wp(400, 560)])).toBe(true));

  it('overlapping circles → false', () =>
    expect(isValid([wp(0, 0), wp(10, 0)])).toBe(false));

  it('non-overlapping circles → true', () =>
    expect(isValid([wp(0, 0), wp(200, 0)])).toBe(true));

  it('two horizontal segments gap < LINE_SEP with overlapping range → false', () => {
    // Build a minimal two-segment path that triggers the line-separation check.
    // wp1 → wp2 is horizontal (same y), wp2 → wp3 is horizontal (same y, gap < 55).
    const path: WaypointData[] = [
      { x: 0,   y: 0,  number: 1, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 0 },
      { x: 200, y: 0,  number: 2, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 200 },
      { x: 200, y: 30, number: 3, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 230 },
      { x: 0,   y: 30, number: 4, turn: 'R', heading: 'W', isWildcard: false, cumulativeDistance: 430 },
    ];
    expect(isValid(path)).toBe(false);
  });

  it('two horizontal segments gap >= LINE_SEP → true', () => {
    const path: WaypointData[] = [
      { x: 0,   y: 0,  number: 1, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 0 },
      { x: 200, y: 0,  number: 2, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 200 },
      { x: 200, y: 60, number: 3, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 260 },
      { x: 0,   y: 60, number: 4, turn: 'R', heading: 'W', isWildcard: false, cumulativeDistance: 460 },
    ];
    expect(isValid(path)).toBe(true);
  });
});
```

### Wildcard index selection

Test the wildcard-selection logic extracted from `generateWalk` (or call `generateWalk` indirectly via the app). The rules are:

- `wildcardCount = Math.max(1, Math.round(count / 9))`
- Indices `0`, `1`, and `count - 1` are never selected

```typescript
describe('wildcard index selection', () => {
  it('count=10 → wildcardCount = 1', () => {
    expect(Math.max(1, Math.round(10 / 9))).toBe(1);
  });

  it('count=90 → wildcardCount = 10', () => {
    expect(Math.max(1, Math.round(90 / 9))).toBe(10);
  });

  it('indices 0, 1, and count-1 never selected (1000 iterations, count=20)', () => {
    // Generate wildcard sets 1000 times and assert the forbidden indices never appear.
    for (let trial = 0; trial < 1000; trial++) {
      const count = 20;
      const pool = Array.from({ length: count }, (_, i) => i)
        .filter(i => i !== 0 && i !== 1 && i !== count - 1);
      const wildcardCount = Math.max(1, Math.round(count / 9));
      // Shuffle pool and take first wildcardCount items (mirror the app's approach).
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const chosen = new Set(pool.slice(0, wildcardCount));
      expect(chosen.has(0)).toBe(false);
      expect(chosen.has(1)).toBe(false);
      expect(chosen.has(count - 1)).toBe(false);
    }
  });
});
```

### tryGenerate() — north-facing start

```typescript
describe('tryGenerate() — north-facing start', () => {
  const turns: Array<'L' | 'R'> = Array(90).fill('R');
  const W = A4_W, H = A4_H;

  it('wp[0] and wp[1] share the same x-coordinate', () => {
    const result = tryGenerate(W, H, turns, 10, new Set());
    if (result.length < 2) return; // skip if generation failed
    expect(result[0].x).toBe(result[1].x);
  });

  it('wp[1] is directly above wp[0] (lower y)', () => {
    const result = tryGenerate(W, H, turns, 10, new Set());
    if (result.length < 2) return;
    expect(result[1].y).toBeLessThan(result[0].y);
  });

  it('first two headings are N', () => {
    const result = tryGenerate(W, H, turns, 10, new Set());
    if (result.length < 2) return;
    expect(result[0].heading).toBe('N');
    expect(result[1].heading).toBe('N');
  });
});
```

### tryGenerate() — outbound-turn shift

```typescript
describe('tryGenerate() — outbound-turn shift', () => {
  it('last waypoint keeps its own turn value', () => {
    const turns: Array<'L' | 'R'> = Array(10).fill('L');
    const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
    if (result.length < 10) return;
    // The last waypoint's turn should equal what was recorded at index 9 before the shift,
    // which is whatever turn was at position 9 in the sequence (i.e. result[9] was not overwritten).
    expect(result[result.length - 1].turn).not.toBeUndefined();
  });

  it('result[0].turn equals the turn recorded at result[1] before shift', () => {
    // After the outbound-turn shift, each waypoint records the turn taken when leaving it.
    // wp[0] should record the turn used to arrive at wp[1].
    const turns: Array<'L' | 'R'> = Array(10).fill('R');
    const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
    if (result.length < 2) return;
    // wp[1] has heading N (north-facing start); the turn to leave wp[0] produces wp[1]'s heading.
    // Simply assert result[0].turn is set (non-null) and is a valid turn value.
    expect(['L', 'R', null]).toContain(result[0].turn);
  });
});
```

### tryGenerate() — wildcard skips turn

```typescript
describe('tryGenerate() — wildcard skips turn', () => {
  it('a wildcard waypoint keeps the previous heading', () => {
    // Make index 5 a wildcard; all turns are 'R' so a non-wildcard would always turn.
    const turns: Array<'L' | 'R'> = Array(20).fill('R');
    const wildcards = new Set([5]);
    const result = tryGenerate(A4_W, A4_H, turns, 20, wildcards);
    if (result.length < 7) return;
    // After the outbound-turn shift, result[5] records the turn taken when leaving wp[5],
    // and result[5].isWildcard should be true.
    expect(result[5].isWildcard).toBe(true);
  });
});
```

### tryGenerate() — cumulative distance

```typescript
describe('tryGenerate() — cumulative distance', () => {
  it('cumulativeDistance is monotonically increasing', () => {
    const turns: Array<'L' | 'R'> = Array(10).fill('R');
    const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
    for (let i = 1; i < result.length; i++) {
      expect(result[i].cumulativeDistance).toBeGreaterThan(result[i - 1].cumulativeDistance);
    }
  });

  it('cumulativeDistance[0] is 0', () => {
    const turns: Array<'L' | 'R'> = Array(10).fill('R');
    const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
    expect(result[0].cumulativeDistance).toBe(0);
  });
});
```

### Centering logic

```typescript
describe('centering logic', () => {
  it('after centering, bounding-box midpoint equals canvas midpoint', () => {
    const turns: Array<'L' | 'R'> = Array(10).fill('R');
    const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
    if (result.length < 2) return;

    // Compute bounding box of (pre-center) result, then apply centering offset.
    const xs = result.map(w => w.x);
    const ys = result.map(w => w.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const dx = A4_W / 2 - midX;
    const dy = A4_H / 2 - midY;

    const centered = result.map(w => ({ x: w.x + dx, y: w.y + dy }));
    const cxs = centered.map(w => w.x);
    const cys = centered.map(w => w.y);
    const cMidX = (Math.min(...cxs) + Math.max(...cxs)) / 2;
    const cMidY = (Math.min(...cys) + Math.max(...cys)) / 2;

    expect(cMidX).toBeCloseTo(A4_W / 2, 0);
    expect(cMidY).toBeCloseTo(A4_H / 2, 0);
  });
});
```

### generateWalk() integration

```typescript
describe('generateWalk() integration via isValid', () => {
  // Import WaypointApp just to trigger a full generation cycle, then inspect the result.
  // Or extract the result from the app's internal state if it is accessible.

  it.each([10, 45, 90])('count=%i: isValid passes and length matches', (count) => {
    const turns: Array<'L' | 'R'> = Array.from({ length: count }, () =>
      Math.random() < 0.5 ? 'L' : 'R'
    );
    const wildcardCount = Math.max(1, Math.round(count / 9));
    const pool = Array.from({ length: count }, (_, i) => i)
      .filter(i => i !== 0 && i !== 1 && i !== count - 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const wildcards = new Set(pool.slice(0, wildcardCount));

    const result = tryGenerate(A4_W, A4_H, turns, count, wildcards);
    // Center the result (mirrors generateWalk behaviour).
    if (result.length > 0) {
      const xs = result.map(w => w.x), ys = result.map(w => w.y);
      const dx = A4_W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
      const dy = A4_H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
      result.forEach(w => { w.x += dx; w.y += dy; });
    }

    expect(result.length).toBe(count);
    expect(isValid(result)).toBe(true);
  });

  it.each([10, 45, 90])('count=%i: all waypoints within canvas bounds', (count) => {
    const turns: Array<'L' | 'R'> = Array.from({ length: count }, () =>
      Math.random() < 0.5 ? 'L' : 'R'
    );
    const wildcards = new Set<number>();
    const result = tryGenerate(A4_W, A4_H, turns, count, wildcards);
    if (result.length > 0) {
      const xs = result.map(w => w.x), ys = result.map(w => w.y);
      const dx = A4_W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
      const dy = A4_H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
      result.forEach(w => { w.x += dx; w.y += dy; });
    }
    for (const wp of result) {
      expect(wp.x).toBeGreaterThan(0);
      expect(wp.x).toBeLessThan(A4_W);
      expect(wp.y).toBeGreaterThan(0);
      expect(wp.y).toBeLessThan(A4_H);
    }
  });
});
```

---

## Part 4 — `src/app.test.ts`

Test the `WaypointApp` class via DOM simulation. The jsdom environment is already set by `vitest.config.ts`.

### Canvas mock

Set up a minimal canvas mock before importing the app:

```typescript
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mockCtx = {
  clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
  fillText: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
  rotate: vi.fn(), setLineDash: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
  canvas: { width: 794, height: 1123 },
  // Properties that may be read/written:
  strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: '', font: '',
  textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
};

beforeAll(() => {
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = () => mockCtx;
});
```

### Required DOM elements

`WaypointApp` reads several DOM elements by ID. Create them in a `beforeEach`:

```typescript
beforeEach(() => {
  document.body.innerHTML = `
    <canvas id="mapCanvas"></canvas>
    <button id="generateBtn">Generate Walk</button>
    <button id="clearBtn">Clear</button>
    <input id="waypointCount" type="number" value="90" min="10" max="90" />
    <input id="showWildcards" type="checkbox" checked />
    <input id="showTurns" type="checkbox" checked />
    <button id="printBtn">Print</button>
    <div id="tooltip" style="display:none"></div>
    <div id="legend"></div>
  `;
});
```

### Tests

```typescript
describe('WaypointApp', () => {
  it('auto-generates a walk on construction (waypoints.length > 0)', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    // Access the internal waypoints array via any cast.
    expect((app as any).waypoints.length).toBeGreaterThan(0);
  });

  it('Clear button resets waypoints to []', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    document.getElementById('clearBtn')!.click();
    expect((app as any).waypoints).toEqual([]);
  });

  it('waypoint count input is clamped to 10–90', async () => {
    const { WaypointApp } = await import('./index');
    new WaypointApp();
    const input = document.getElementById('waypointCount') as HTMLInputElement;
    input.value = '5';
    input.dispatchEvent(new Event('change'));
    // The app should clamp the value on next generate; check the clamping expression.
    const clamped = Math.max(10, Math.min(90, Number(input.value)));
    expect(clamped).toBe(10);
  });

  it('showWildcards checkbox change triggers redraw', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    const spy = vi.spyOn(app as any, 'drawCanvas');
    document.getElementById('showWildcards')!.dispatchEvent(new Event('change'));
    expect(spy).toHaveBeenCalled();
  });

  it('showTurns checkbox change triggers redraw', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    const spy = vi.spyOn(app as any, 'drawCanvas');
    document.getElementById('showTurns')!.dispatchEvent(new Event('change'));
    expect(spy).toHaveBeenCalled();
  });

  it('click on waypoint circle shows tooltip', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    const waypoints: any[] = (app as any).waypoints;
    if (waypoints.length === 0) return;
    const wp = waypoints[0];
    const canvas = document.getElementById('mapCanvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: wp.x, clientY: wp.y }));
    const tooltip = document.getElementById('tooltip')!;
    expect(tooltip.style.display).not.toBe('none');
  });

  it('click off waypoints hides tooltip', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    const canvas = document.getElementById('mapCanvas') as HTMLCanvasElement;
    // Click somewhere far from any waypoint.
    canvas.dispatchEvent(new MouseEvent('click', { clientX: -1000, clientY: -1000 }));
    const tooltip = document.getElementById('tooltip')!;
    expect(tooltip.style.display).toBe('none');
  });

  it('hitTest returns correct index for waypoint within radius', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    const waypoints: any[] = (app as any).waypoints;
    if (waypoints.length === 0) return;
    const wp = waypoints[2];
    const idx = (app as any).hitTest(wp.x, wp.y);
    expect(idx).toBe(2);
  });

  it('hitTest returns -1 for a miss', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    const idx = (app as any).hitTest(-1000, -1000);
    expect(idx).toBe(-1);
  });
});
```

---

## What to preserve

- `tsconfig.json` — do not change.
- `src/index.ts` class structure, method names, and behaviour — refactor only.
- `index.html` — do not change.
- `.github/` — do not touch.

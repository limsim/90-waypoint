# Test Implementation Plan

> Updated: 2026-03-14 — based on the corrected `prompt/test-coverage-analysis.md`.

---

## Overview

Current coverage: **~33 / 65 requirements (51%)** across `walk.test.ts`, `app.test.ts`, and `visual-check.spec.ts`.

This plan covers the **32 remaining gaps** organised into four work streams:

| Stream | Target file | Items |
|---|---|---|
| **A** — Unit: walk.ts | `src/walk.test.ts` | A1–A5 |
| **B** — App unit: index.ts | `src/app.test.ts` | B1–B3 |
| **C** — E2E | `tests/e2e.spec.ts` *(new)* | C1–C11 |
| **D** — Visual | `tests/visual-check.spec.ts` | D1–D5 |

---

## Parallelisation

Three streams can start immediately in parallel. Stream A is blocked by a small prerequisite.

```
prerequisites ──► A (walk.test.ts)
(walk.ts exports)
                  B (app.test.ts)       ─── all three start immediately,
                  C (e2e.spec.ts)           no dependencies on each other
                  D (visual-check.spec.ts)  or on Stream A
```

| Person / thread | Work |
|---|---|
| 1 | Prerequisites → Stream A |
| 2 | Stream B |
| 3 | Stream C |
| 4 | Stream D |

**Why A is blocked:** A1–A5 import `SEG_MIN`, `SEG_JITTER`, `MULTIPLIERS`, and `canPlace` which do not exist as exports yet. The prerequisite (adding ~4 exports to `walk.ts`) unblocks A immediately after.

**Why B, C, D are unblocked:**
- Stream B touches only `src/app.test.ts` via jsdom — no dependency on the new walk.ts exports
- Stream C hits the running browser app — zero code dependencies
- Stream D adds tests to an existing file — no code dependencies

**One cross-stream callout:** C5 and C11 copy `INIT_SCRIPT` from `visual-check.spec.ts`, and D4/D5 modify that same file. If C and D are split across people, extract `INIT_SCRIPT` to a shared `tests/helpers.ts` before both streams touch it.

---

## Prerequisites: export from `walk.ts`

Several unit tests require internal values that are currently unexported.
Make these changes to `src/walk.ts` before writing the A-stream tests:

```ts
// Already exported — no change needed:
//   CIRCLE_R, CIRCLE_SEP, LINE_SEP, SEG_CLEAR_R, A4_W, A4_H,
//   TURN_LABEL_OFFSET, TURN_LABEL_CLEARANCE, ATTEMPTS_PER_SIZE, SCALE_STEP

// Add these exports:
export const SEG_MIN    = 60;   // currently inline as `const minDist = 60`
export const SEG_JITTER = 80;   // currently inline as `Math.random() * 80`

export const MULTIPLIERS: readonly number[] = [
    1.0, 1.5, 2.0, 0.75, 2.5, 0.5, 3.0, 4.0, 0.33,
    5.0, 6.0, 7.0, 8.0,
    0.60, 0.65, 0.70,
    1.1, 1.25,
];

// canPlace is currently an unexported inner function — move it to module scope and export:
export function canPlace(
    waypoints: WaypointData[],
    fromX: number, fromY: number,
    toX: number, toY: number,
    W: number, H: number,
    padding: number,
): boolean { ... }
```

---

## Stream A — Unit tests for `walk.ts` (add to `src/walk.test.ts`)

### A1. Base segment length constants

```ts
describe('segment length constants', () => {
    it('SEG_MIN is 60',    () => expect(SEG_MIN).toBe(60));
    it('SEG_JITTER is 80', () => expect(SEG_JITTER).toBe(80));
    it('base segment range is 60–140px (SEG_MIN + SEG_JITTER)',
        () => expect(SEG_MIN + SEG_JITTER).toBe(140));
});
```

### A2. Multipliers array

```ts
describe('MULTIPLIERS', () => {
    it('contains 8.0',           () => expect(MULTIPLIERS).toContain(8.0));
    it('max multiplier is 8.0',  () => expect(Math.max(...MULTIPLIERS)).toBe(8.0));
    it('contains 0.5',           () => expect(MULTIPLIERS).toContain(0.5));
    it('has no value below 0.3', () => expect(Math.min(...MULTIPLIERS)).toBeGreaterThan(0.3));
});
```

### A3. Turns NOT applied at indices 0 and 1

The rule `intendedHeadingFor(idx, arrival)` returns `arrival` unchanged when `idx <= 1`.
After the outbound-turn shift, `result[0]` and `result[1]` must both remain heading `N`.

```ts
describe('turns not applied at waypoint indices 0 and 1', () => {
    it('result[0] and result[1] heading is N even with all-L turn sequence', () => {
        const turns: Array<'L' | 'R'> = Array(20).fill('L');
        const result = tryGenerate(A4_W, A4_H, turns, 20, new Set());
        if (result.length < 2) return;
        expect(result[0].heading).toBe('N');
        expect(result[1].heading).toBe('N');
    });

    it('result[2] heading reflects the first applied turn (all-R → TURN_RIGHT[N] = E)', () => {
        const turns: Array<'L' | 'R'> = Array(20).fill('R');
        const result = tryGenerate(A4_W, A4_H, turns, 20, new Set());
        if (result.length < 3) return;
        // After outbound-turn shift, the turn that was at generation index 2
        // (the first one actually applied) is now at result[2].
        expect(result[2].heading).toBe(TURN_RIGHT[result[1].heading]);
    });
});
```

### A4. `canPlace` enforces SEG_CLEAR_R = 35px

```ts
describe('canPlace() — SEG_CLEAR_R boundary', () => {
    const W = 1000, H = 1000, PAD = 30;

    it('rejects a horizontal segment at 27px from a waypoint centre', () => {
        // Waypoint at (200, 200); segment at y = 200 + 27 = 227
        const existing: WaypointData[] = [wp(200, 200)];
        expect(canPlace(existing, 100, 227, 300, 227, W, H, PAD)).toBe(false);
    });

    it('accepts a horizontal segment at 36px from a waypoint centre', () => {
        const existing: WaypointData[] = [wp(200, 200)];
        expect(canPlace(existing, 100, 236, 300, 236, W, H, PAD)).toBe(true);
    });

    it('rejects a vertical segment at 27px from a waypoint centre', () => {
        const existing: WaypointData[] = [wp(200, 200)];
        expect(canPlace(existing, 200 + 27, 100, 200 + 27, 300, W, H, PAD)).toBe(false);
    });

    it('accepts a vertical segment at 36px from a waypoint centre', () => {
        const existing: WaypointData[] = [wp(200, 200)];
        expect(canPlace(existing, 200 + 36, 100, 200 + 36, 300, W, H, PAD)).toBe(true);
    });
});
```

### A5. `isValid` rejects layout where turn label is <8px from a non-adjacent segment

`turnLabelPos` places the label at `(cx + TURN_LABEL_OFFSET * cos45, cy - TURN_LABEL_OFFSET * sin45)` ≈ `(cx + 32.5, cy - 32.5)`.
Craft a 4-waypoint path where segment 2→3 passes within 8px of waypoint 2's label.

```ts
describe('isValid() — turn label clearance', () => {
    it('rejects layout where a turn label is <8px from a non-adjacent segment', () => {
        // wp[1] at (100, 300); its label is at approximately (132.5, 267.5).
        // Segment wp[2]→wp[3]: horizontal leg at y = 263 (4.5px from label) → violation.
        const labelY = 300 - TURN_LABEL_OFFSET * Math.SQRT1_2; // ≈ 267.5
        const segY = Math.round(labelY - 4); // 4px away = below TURN_LABEL_CLEARANCE (8px)

        const path: WaypointData[] = [
            { x: 100, y: 500, number: 1, turn: 'R',  heading: 'N', isWildcard: false, cumulativeDistance: 0 },
            { x: 100, y: 300, number: 2, turn: 'R',  heading: 'N', isWildcard: false, cumulativeDistance: 200 },
            { x: 400, y: 300, number: 3, turn: 'R',  heading: 'E', isWildcard: false, cumulativeDistance: 500 },
            { x: 400, y: segY, number: 4, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 500 + (300 - segY) },
        ];
        expect(isValid(path)).toBe(false);
    });

    it('accepts layout where all turn labels have ≥8px clearance', () => {
        // Same shape but segment 3→4 far enough away.
        const path: WaypointData[] = [
            { x: 100, y: 500, number: 1, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 0 },
            { x: 100, y: 300, number: 2, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 200 },
            { x: 400, y: 300, number: 3, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 500 },
            { x: 400, y: 100, number: 4, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 700 },
        ];
        expect(isValid(path)).toBe(true);
    });
});
```

> **Note:** Compute `segY` precisely using `turnLabelPos` in the test to avoid fragility — call
> `turnLabelPos(path[1])` and offset by less than `TURN_LABEL_CLEARANCE`.

---

## Stream B — App unit tests (add to `src/app.test.ts`)

### B1. Default waypoint count input is 90

The current `beforeEach` scaffold sets `value="10"`. Add a separate test that sets `value="90"`.

```ts
it('generates 90 waypoints when input value is 90', async () => {
    document.querySelector('#waypointCount')!.setAttribute('value', '90');
    (document.getElementById('waypointCount') as HTMLInputElement).value = '90';
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    expect((app as any).waypoints.length).toBe(90);
});
```

### B2. Generate Walk button produces a new walk

```ts
it('clicking Generate Walk button changes waypoints', async () => {
    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    const firstPositions = (app as any).waypoints.map((w: any) => `${w.x},${w.y}`).join('|');

    document.getElementById('generateBtn')!.click();
    // generateWalk is async; flush microtasks/timers
    await new Promise(r => setTimeout(r, 500));

    const secondPositions = (app as any).waypoints.map((w: any) => `${w.x},${w.y}`).join('|');
    expect(secondPositions).not.toBe(firstPositions);
});
```

### B3. Canvas grows by 10% after 200 failed `tryGenerate` calls

```ts
it('canvas dimensions grow by SCALE_STEP after 200 tryGenerate failures', async () => {
    const walkModule = await import('./walk');
    let callCount = 0;
    const spy = vi.spyOn(walkModule, 'tryGenerate').mockImplementation((...args) => {
        callCount++;
        // Let the first call (the auto-generate on construction) succeed normally,
        // then force 200 failures on the next generate.
        if (callCount > 1 && callCount <= 201) return [];
        return walkModule.tryGenerate.wrappedImplementation!(...args as Parameters<typeof walkModule.tryGenerate>);
    });

    const { WaypointApp } = await import('./index');
    const app = new WaypointApp();
    document.getElementById('generateBtn')!.click();
    await new Promise(r => setTimeout(r, 1000));

    const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
    // After 200 failures at tier 0 (A4_W × A4_H), the canvas should have grown to A4 * 1.1
    expect(canvas.width).toBeGreaterThan(794);
    spy.mockRestore();
});
```

> **Note:** This test depends on whether Vitest can spy on an ES module re-export at runtime.
> If the spy approach is blocked by ESM module sealing, an alternative is to test the
> `_runGeneration` scaling logic directly via a subclassed or duck-typed `WaypointApp`.

---

## Stream C — E2E tests (create `tests/e2e.spec.ts`)

Copy the `waitForLoad`, `BASE_URL`, and `INIT_SCRIPT` helpers from `visual-check.spec.ts`.
The `INIT_SCRIPT` helper is needed only for tests that inspect canvas draw calls (C5, C11).

```ts
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

async function waitForLoad(page: Page): Promise<void> {
    await page.waitForFunction(
        () => !document.getElementById('loading')?.classList.contains('visible'),
        { timeout: 30_000 },
    );
    await page.waitForTimeout(150);
}
```

---

### C1. Walk auto-generated on page load

```ts
test('walk auto-generates on page load', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    const hasContent = await page.evaluate(() => {
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
        return false;
    });
    expect(hasContent).toBe(true);
});
```

### C2. Generate Walk button produces a new walk

```ts
test('Generate Walk button changes canvas content', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);
    const before = await page.evaluate(() =>
        (document.getElementById('waypointCanvas') as HTMLCanvasElement).toDataURL()
    );

    await page.locator('#generateBtn').click();
    await waitForLoad(page);

    const after = await page.evaluate(() =>
        (document.getElementById('waypointCanvas') as HTMLCanvasElement).toDataURL()
    );
    expect(after).not.toBe(before);
});
```

### C3. Clear button empties the canvas

```ts
test('Clear button leaves no dark pixels on canvas', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.locator('#clearBtn').click();
    await page.waitForTimeout(100);

    const hasDarkPixels = await page.evaluate(() => {
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 200 && data[i + 3] > 0) return true; // non-white opaque pixel
        }
        return false;
    });
    expect(hasDarkPixels).toBe(false);
});
```

### C4. Waypoint count input: default 90, min/max attributes

```ts
test('waypoint count input defaults to 90', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#waypointCount')).toHaveValue('90');
});

test('waypoint count input has min=10 and max=90', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#waypointCount')).toHaveAttribute('min', '10');
    await expect(page.locator('#waypointCount')).toHaveAttribute('max', '90');
});
```

### C5. Setting waypoint count to 10 generates exactly 10 waypoints

Uses `INIT_SCRIPT` to count captured waypoint circles.

```ts
test('setting waypoint count to 10 generates exactly 10 waypoints', async ({ page }) => {
    await page.addInitScript(INIT_SCRIPT);
    await page.goto(BASE_URL);
    await waitForLoad(page);

    // Reset captures, update count, regenerate
    await page.evaluate(() => { (window as any).__captures = { circles: [], lines: [], texts: [] }; });
    await page.locator('#waypointCount').fill('10');
    await page.locator('#generateBtn').click();
    await waitForLoad(page);

    const captures = await page.evaluate(() => (window as any).__captures);
    const waypointCircles = captures.circles.filter((c: any) => c.r === 25 && c.op === 'fill+stroke');
    expect(waypointCircles.length).toBe(10);
});
```

### C6. Generate Walk button is disabled during generation; enabled after

```ts
test('Generate Walk button is re-enabled after generation completes', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.locator('#generateBtn').click();
    await waitForLoad(page);

    await expect(page.locator('#generateBtn')).not.toBeDisabled();
});

test('loading overlay is hidden after generation completes', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.locator('#generateBtn').click();
    await waitForLoad(page);

    await expect(page.locator('#loading')).not.toHaveClass(/visible/);
});
```

> **Disabled-during-generation:** This is timing-sensitive. To reliably catch the in-flight state,
> click the button and immediately sample `isDisabled()` before `waitForLoad` resolves:
> ```ts
> const clickPromise = page.locator('#generateBtn').click();
> const isDisabled = await page.locator('#generateBtn').isDisabled();
> expect(isDisabled).toBe(true);
> await clickPromise;
> await waitForLoad(page);
> ```

### C7. Print button calls `window.print()`

```ts
test('Print button calls window.print()', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    let printCalled = false;
    await page.exposeFunction('__onPrint', () => { printCalled = true; });
    await page.evaluate(() => { window.print = () => (window as any).__onPrint(); });

    await page.locator('#printBtn').click();
    await page.waitForTimeout(200);
    expect(printCalled).toBe(true);
});
```

### C8. Legend: present, below canvas, three entries

```ts
// Update the selector to match the actual legend element in index.html.
test('legend is visible and positioned below the canvas', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    const legend = page.locator('#legend');
    await expect(legend).toBeVisible();

    const canvasBox = await page.locator('#waypointCanvas').boundingBox();
    const legendBox = await legend.boundingBox();
    expect(legendBox!.y).toBeGreaterThan(canvasBox!.y + canvasBox!.height - 10);
});

test('legend contains start/end, waypoint, and wildcard entries', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    const text = await page.locator('#legend').innerText();
    expect(text).toMatch(/start|end/i);
    expect(text).toMatch(/waypoint/i);
    expect(text).toMatch(/wildcard/i);
});
```

### C9. Legend not hidden in print media

```ts
test('legend is visible in print media', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#legend')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
});
```

### C10. No horizontal scroll at standard viewport widths

```ts
for (const width of [375, 768, 1280]) {
    test(`no horizontal scroll at ${width}px viewport`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(BASE_URL);
        await waitForLoad(page);

        const hasHScroll = await page.evaluate(() =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(hasHScroll).toBe(false);
    });
}
```

### C11. Click tooltip shows number, turn, and cumulative distance

```ts
test('clicking a waypoint shows tooltip with number, turn, and distance', async ({ page }) => {
    await page.addInitScript(INIT_SCRIPT);
    await page.goto(BASE_URL);
    await waitForLoad(page);

    const captures = await page.evaluate(() => (window as any).__captures);
    const waypointCircles = captures.circles.filter((c: any) => c.r === 25 && c.op === 'fill+stroke');
    expect(waypointCircles.length).toBeGreaterThan(1);

    // Use an intermediate waypoint (index 1) — it has a turn label and a cumulative distance.
    const wp = waypointCircles[1];
    const canvas = page.locator('#waypointCanvas');
    const cssWidth  = await canvas.evaluate(el => parseInt((el as HTMLCanvasElement).style.width));
    const pixWidth  = await canvas.evaluate(el => (el as HTMLCanvasElement).width);
    const scale = cssWidth / pixWidth;

    await canvas.click({ position: { x: wp.x * scale, y: wp.y * scale } });
    await page.waitForTimeout(100);

    const tooltip = page.locator('#tooltip');
    await expect(tooltip).toBeVisible();
    const text = await tooltip.innerText();
    expect(text).toMatch(/\d+/);    // waypoint number
    expect(text).toMatch(/[LRW]/);  // turn direction
    expect(text).toMatch(/\d/);     // cumulative distance (some digits)
});
```

---

## Stream D — Visual tests (add to `tests/visual-check.spec.ts`)

### D1. Grid lines: colour `#e0e0e0`, ~60px spacing

```ts
test('grid lines use colour #e0e0e0 with ~60px spacing', async ({ page }) => {
    const captures = await getCaptures(page);
    const gridLines = captures.lines.filter(l => l.strokeStyle === '#e0e0e0');
    expect(gridLines.length).toBeGreaterThan(0);

    // Collect distinct y-values of horizontal grid lines; check each consecutive gap ≈ 60px.
    const ys = [...new Set(
        gridLines.filter(l => Math.abs(l.y1 - l.y2) < 0.5).map(l => Math.round(l.y1))
    )].sort((a, b) => a - b);

    for (let i = 1; i < ys.length; i++) {
        expect(ys[i] - ys[i - 1]).toBeCloseTo(60, 0);
    }
});
```

### D2. Turn label count equals waypoint count minus 2

```ts
test('turn label count equals waypoint count minus 2', async ({ page }) => {
    const captures = await getCaptures(page);
    const labels = captures.texts.filter(t => ['L', 'R', 'W'].includes(t.text) && t.font.includes('13px'));
    const nums = captures.texts.filter(t => /^\d+$/.test(t.text) && t.font.includes('20px'));
    const waypointCount = Math.max(...nums.map(t => parseInt(t.text)));
    expect(labels.length).toBe(waypointCount - 2);
});
```

### D3. No turn label at waypoint 1 or the last waypoint

```ts
test('no turn label at the NE position of waypoint 1 or the last waypoint', async ({ page }) => {
    const captures = await getCaptures(page);
    const circles = captures.circles.filter(c => c.r === CIRCLE_R && c.op === 'fill+stroke');
    const nums = captures.texts.filter(t => /^\d+$/.test(t.text) && t.font.includes('20px'));
    const labels = captures.texts.filter(t => ['L', 'R', 'W'].includes(t.text) && t.font.includes('13px'));
    const maxNum = Math.max(...nums.map(t => parseInt(t.text)));
    const NE = TURN_LABEL_OFFSET * Math.SQRT1_2;

    for (const n of [1, maxNum]) {
        const numText = nums.find(t => parseInt(t.text) === n)!;
        const expectedLX = numText.x + NE;
        const expectedLY = numText.y - NE;
        const found = labels.find(l => Math.abs(l.x - expectedLX) < 5 && Math.abs(l.y - expectedLY) < 5);
        expect(found, `Unexpected turn label near endpoint waypoint ${n}`).toBeUndefined();
    }
});
```

### D4. Hover: adjacent segments thicken to 4px

This requires resetting the capture buffer, triggering a hover, and re-reading.
Add a `__resetCaptures` helper to `INIT_SCRIPT` (or as a second `addInitScript`):

```ts
test('hovering over a waypoint thickens its adjacent segments to lineWidth 4', async ({ page }) => {
    // Reset captures after initial draw, then hover.
    const captures = await getCaptures(page);
    const circles = captures.circles.filter(c => c.r === CIRCLE_R && c.op === 'fill+stroke');
    expect(circles.length).toBeGreaterThan(1);

    const wp = circles[1]; // intermediate waypoint
    const canvas = page.locator('#waypointCanvas');
    const cssWidth = await canvas.evaluate(el => parseInt((el as HTMLCanvasElement).style.width));
    const pixWidth = await canvas.evaluate(el => (el as HTMLCanvasElement).width);
    const scale = cssWidth / pixWidth;

    // Reset capture buffer before hover so we only see hover-redrawn lines.
    await page.evaluate(() => {
        (window as any).__captures.lines = [];
        (window as any).__captures.circles = [];
    });

    await canvas.hover({ position: { x: wp.x * scale, y: wp.y * scale } });
    await page.waitForTimeout(150);

    const hoverCaptures = await getCaptures(page);
    const thickLines = hoverCaptures.lines.filter(l => l.strokeStyle === '#222222' && l.lineWidth === 4);
    expect(thickLines.length, 'Expected hovered segments to thicken to lineWidth 4').toBeGreaterThan(0);
});
```

### D5. Hover: waypoint gains a drop shadow

```ts
test('hovering over a waypoint renders a shadow', async ({ page }) => {
    // Check shadowBlur is set during the hover-redraw.
    await page.evaluate(() => {
        (window as any).__shadowBlurMax = 0;
        const proto = CanvasRenderingContext2D.prototype;
        const _arc = proto.arc;
        proto.arc = function (...args) {
            if (this.shadowBlur > (window as any).__shadowBlurMax)
                (window as any).__shadowBlurMax = this.shadowBlur;
            return _arc.apply(this, args);
        };
    });

    const captures = await getCaptures(page);
    const circles = captures.circles.filter(c => c.r === CIRCLE_R && c.op === 'fill+stroke');
    const wp = circles[1];
    const canvas = page.locator('#waypointCanvas');
    const cssWidth = await canvas.evaluate(el => parseInt((el as HTMLCanvasElement).style.width));
    const pixWidth = await canvas.evaluate(el => (el as HTMLCanvasElement).width);
    const scale = cssWidth / pixWidth;

    await canvas.hover({ position: { x: wp.x * scale, y: wp.y * scale } });
    await page.waitForTimeout(150);

    const maxShadow = await page.evaluate(() => (window as any).__shadowBlurMax);
    expect(maxShadow, 'Expected shadowBlur > 0 when a waypoint is hovered').toBeGreaterThan(0);
});
```

---

## Implementation Order

1. **`src/walk.ts`** — export `SEG_MIN`, `SEG_JITTER`, `MULTIPLIERS`, and `canPlace`
2. **`src/walk.test.ts`** — add A1–A5; run `npm test` to confirm green
3. **`src/app.test.ts`** — add B1–B3; run `npm test`
4. **`tests/e2e.spec.ts`** — create file; add C1–C11 one at a time, running `npx playwright test tests/e2e.spec.ts` after each
5. **`tests/visual-check.spec.ts`** — add D1–D5; run `npx playwright test tests/visual-check.spec.ts`

---

## Checklist

### Stream A — `src/walk.test.ts`
- [ ] A1 — `SEG_MIN` / `SEG_JITTER` constants
- [ ] A2 — `MULTIPLIERS` array contains 8.0
- [ ] A3 — turns not applied at indices 0 and 1
- [ ] A4 — `canPlace` rejects <35px, accepts ≥35px
- [ ] A5 — `isValid` rejects label <8px clearance

### Stream B — `src/app.test.ts`
- [ ] B1 — generates 90 waypoints when count=90
- [ ] B2 — Generate Walk button changes waypoints
- [ ] B3 — canvas grows by 10% after 200 tryGenerate failures

### Stream C — `tests/e2e.spec.ts`
- [ ] C1 — canvas has content on load
- [ ] C2 — Generate Walk changes canvas data URL
- [ ] C3 — Clear leaves no dark pixels
- [ ] C4 — waypoint count default 90, min/max attributes
- [ ] C5 — count=10 generates exactly 10 circles
- [ ] C6 — button re-enabled and overlay hidden after generation
- [ ] C7 — Print button calls window.print()
- [ ] C8 — legend visible, below canvas, 3 entries
- [ ] C9 — legend visible in print media
- [ ] C10 — no horizontal scroll at 375 / 768 / 1280px
- [ ] C11 — tooltip shows number, turn, distance on click

### Stream D — `tests/visual-check.spec.ts`
- [ ] D1 — grid lines #e0e0e0, ~60px spacing
- [ ] D2 — label count = waypoint count − 2
- [ ] D3 — no label at waypoint 1 or last waypoint
- [ ] D4 — hover thickens adjacent segments to lineWidth 4
- [ ] D5 — hover sets shadowBlur > 0 on waypoint circle

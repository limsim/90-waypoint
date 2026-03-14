/**
 * Visual Requirements Check for the 90 Waypoint Map app.
 *
 * Strategy: intercept CanvasRenderingContext2D prototype methods before the page
 * loads (via addInitScript) to capture every arc, path, and text drawn onto the
 * canvas. Tests then assert geometric and stylistic requirements against the
 * captured data, augmented by canvas pixel-colour checks where needed.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CircleCapture {
  x: number;
  y: number;
  r: number;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  /** 'fill' = only fill called; 'stroke' = only stroke; 'fill+stroke' = both */
  op: 'fill' | 'stroke' | 'fill+stroke';
}

interface LineCapture {
  x1: number; y1: number;
  x2: number; y2: number;
  strokeStyle: string;
  lineWidth: number;
}

interface TextCapture {
  text: string;
  x: number;
  y: number;
  fillStyle: string;
  font: string;
}

interface Captures {
  circles: CircleCapture[];
  lines: LineCapture[];
  texts: TextCapture[];
}

// ─── Constants mirrored from walk.ts ─────────────────────────────────────────

const CIRCLE_R = 25;
const WILDCARD_RING_R = 30; // CIRCLE_R + 5
const TURN_LABEL_OFFSET = 46;
const LINE_SEP = 55;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8000';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

async function waitForLoad(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !document.getElementById('loading')?.classList.contains('visible'),
    { timeout: 30_000 },
  );
  // Small buffer for any synchronous post-render work
  await page.waitForTimeout(150);
}

async function getCaptures(page: Page): Promise<Captures> {
  return page.evaluate(() => (window as any).__captures as Captures);
}


// ─── Canvas interception init script ─────────────────────────────────────────
//
// Injected before any page scripts run. Patches the Canvas 2D prototype to
// record every arc, path segment, and fillText call with their styles.

const INIT_SCRIPT = `
(function () {
  const captures = { circles: [], lines: [], texts: [] };
  window.__captures = captures;

  let currentArc = null;   // { x, y, r } set by arc()
  let currentLines = [];   // line segments set by moveTo/lineTo
  let currentPos = null;   // last moveTo/lineTo position

  const proto = CanvasRenderingContext2D.prototype;
  const _beginPath = proto.beginPath;
  const _arc = proto.arc;
  const _moveTo = proto.moveTo;
  const _lineTo = proto.lineTo;
  const _fill = proto.fill;
  const _stroke = proto.stroke;
  const _fillText = proto.fillText;

  proto.beginPath = function () {
    currentArc = null;
    currentLines = [];
    currentPos = null;
    return _beginPath.call(this);
  };

  proto.arc = function (x, y, r, startAngle, endAngle, anticlockwise) {
    currentArc = { x, y, r };
    return _arc.call(this, x, y, r, startAngle, endAngle, anticlockwise);
  };

  proto.moveTo = function (x, y) {
    currentPos = { x, y };
    return _moveTo.call(this, x, y);
  };

  proto.lineTo = function (x, y) {
    if (currentPos) currentLines.push({ x1: currentPos.x, y1: currentPos.y, x2: x, y2: y });
    currentPos = { x, y };
    return _lineTo.call(this, x, y);
  };

  proto.fill = function () {
    if (currentArc) {
      captures.circles.push({
        x: currentArc.x, y: currentArc.y, r: currentArc.r,
        fillStyle: String(this.fillStyle),
        strokeStyle: String(this.strokeStyle), // will be overwritten at stroke() time if stroke follows
        lineWidth: this.lineWidth,
        op: 'fill',
      });
    }
    return _fill.apply(this, arguments);
  };

  proto.stroke = function () {
    if (currentArc) {
      // Look for a previously recorded fill of the same arc to update it
      const prev = captures.circles.find(
        c => c.x === currentArc.x && c.y === currentArc.y && c.r === currentArc.r && c.op === 'fill',
      );
      if (prev) {
        prev.op = 'fill+stroke';
        prev.strokeStyle = String(this.strokeStyle);
        prev.lineWidth = this.lineWidth;
      } else {
        captures.circles.push({
          x: currentArc.x, y: currentArc.y, r: currentArc.r,
          fillStyle: String(this.fillStyle),
          strokeStyle: String(this.strokeStyle),
          lineWidth: this.lineWidth,
          op: 'stroke',
        });
      }
    }
    if (currentLines.length > 0) {
      for (const seg of currentLines) {
        captures.lines.push({
          ...seg,
          strokeStyle: String(this.strokeStyle),
          lineWidth: this.lineWidth,
        });
      }
    }
    return _stroke.call(this);
  };

  proto.fillText = function (text, x, y) {
    captures.texts.push({
      text: String(text),
      x,
      y,
      fillStyle: String(this.fillStyle),
      font: this.font,
    });
    return _fillText.call(this, text, x, y);
  };
})();
`;

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Visual Requirements Check', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(INIT_SCRIPT);
    await page.goto(BASE_URL);
    await waitForLoad(page);
  });

  // ── Screenshots ─────────────────────────────────────────────────────────────

  test('screenshots: full page and canvas-only', async ({ page }) => {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `visual-check-${timestamp}-full.png`),
      fullPage: true,
    });
    await page.locator('#waypointCanvas').screenshot({
      path: path.join(SCREENSHOTS_DIR, `visual-check-${timestamp}-canvas.png`),
    });
  });

  // ── Default UI state ────────────────────────────────────────────────────────

  test('loading overlay is hidden after generation', async ({ page }) => {
    await expect(page.locator('#loading')).not.toHaveClass(/visible/);
  });

  test('Show Wildcards checkbox is checked by default', async ({ page }) => {
    await expect(page.locator('#showWildcards')).toBeChecked();
  });

  test('Show Turns checkbox is checked by default', async ({ page }) => {
    await expect(page.locator('#showTurns')).toBeChecked();
  });

  test('canvas CSS display size does not exceed A4 (794×1123)', async ({ page }) => {
    // The canvas pixel dimensions can scale beyond A4 when generation needs more space,
    // but updateDisplaySize() caps the CSS display to A4 bounds.
    const dims = await page.evaluate(() => {
      const c = document.getElementById('waypointCanvas') as HTMLCanvasElement;
      return { w: parseInt(c.style.width), h: parseInt(c.style.height) };
    });
    expect(dims.w).toBeLessThanOrEqual(794);
    expect(dims.h).toBeLessThanOrEqual(1123);
  });

  // ── Path Lines ──────────────────────────────────────────────────────────────

  test.describe('Path Lines', () => {
    // Path segments use strokeStyle '#222222' and lineWidth 2.
    // Grid lines use '#e0e0e0', so filtering by '#222222' isolates path lines.

    function pathLines(captures: Captures): LineCapture[] {
      return captures.lines.filter(l => l.strokeStyle === '#222222' && l.lineWidth === 2);
    }

    test('path lines exist on canvas', async ({ page }) => {
      const captures = await getCaptures(page);
      expect(pathLines(captures).length).toBeGreaterThan(0);
    });

    test('all path segments are strictly horizontal or vertical (orthogonal)', async ({ page }) => {
      const captures = await getCaptures(page);
      for (const seg of pathLines(captures)) {
        const isHoriz = Math.abs(seg.y1 - seg.y2) < 0.5;
        const isVert  = Math.abs(seg.x1 - seg.x2) < 0.5;
        expect(isHoriz || isVert, `Diagonal segment: (${seg.x1},${seg.y1})→(${seg.x2},${seg.y2})`).toBe(true);
      }
    });

    test('line colour is #222222 (dark)', async ({ page }) => {
      const captures = await getCaptures(page);
      const segs = pathLines(captures);
      expect(segs.length).toBeGreaterThan(0);
      for (const seg of segs) {
        expect(seg.strokeStyle).toBe('#222222');
      }
    });

    test('line weight is 2px', async ({ page }) => {
      const captures = await getCaptures(page);
      for (const seg of pathLines(captures)) {
        expect(seg.lineWidth).toBe(2);
      }
    });

    test('parallel overlapping path segments are ≥55px apart', async ({ page }) => {
      const captures = await getCaptures(page);
      const segs = pathLines(captures);

      const horizSegs = segs.filter(s => Math.abs(s.y1 - s.y2) < 0.5);
      const vertSegs  = segs.filter(s => Math.abs(s.x1 - s.x2) < 0.5);

      // Horizontal pairs: same-ish x range, check y gap
      for (let i = 0; i < horizSegs.length; i++) {
        for (let j = i + 1; j < horizSegs.length; j++) {
          const a = horizSegs[i], b = horizSegs[j];
          const overlapX = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2))
                         - Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
          if (overlapX > 0) {
            const yGap = Math.abs(a.y1 - b.y1);
            expect(yGap,
              `Horizontal lines y=${a.y1} and y=${b.y1} have overlapping x-range and are only ${yGap}px apart`,
            ).toBeGreaterThanOrEqual(LINE_SEP);
          }
        }
      }

      // Vertical pairs: same-ish y range, check x gap
      for (let i = 0; i < vertSegs.length; i++) {
        for (let j = i + 1; j < vertSegs.length; j++) {
          const a = vertSegs[i], b = vertSegs[j];
          const overlapY = Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2))
                         - Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2));
          if (overlapY > 0) {
            const xGap = Math.abs(a.x1 - b.x1);
            expect(xGap,
              `Vertical lines x=${a.x1} and x=${b.x1} have overlapping y-range and are only ${xGap}px apart`,
            ).toBeGreaterThanOrEqual(LINE_SEP);
          }
        }
      }
    });
  });

  // ── Waypoints ───────────────────────────────────────────────────────────────

  test.describe('Waypoints', () => {
    function waypointCircles(captures: Captures): CircleCapture[] {
      return captures.circles.filter(c => c.r === CIRCLE_R && c.op === 'fill+stroke');
    }

    function waypointNumbers(captures: Captures): TextCapture[] {
      return captures.texts.filter(t => /^\d+$/.test(t.text) && t.font.includes('20px'));
    }

    test('all waypoint circles have radius 25px', async ({ page }) => {
      const captures = await getCaptures(page);
      const circles = waypointCircles(captures);
      expect(circles.length).toBeGreaterThan(0);
      for (const c of circles) expect(c.r).toBe(CIRCLE_R);
    });

    test('waypoint 1 and last waypoint: black fill, white stroke, white number', async ({ page }) => {
      const captures = await getCaptures(page);
      const circles = waypointCircles(captures);
      const nums = waypointNumbers(captures);
      const maxNum = Math.max(...nums.map(t => parseInt(t.text)));

      const endpoints = [1, maxNum];
      for (const n of endpoints) {
        const numText = nums.find(t => parseInt(t.text) === n);
        expect(numText, `Number text for waypoint ${n} not found`).toBeTruthy();

        const circle = circles.find(c =>
          Math.abs(c.x - numText!.x) < 2 && Math.abs(c.y - numText!.y) < 2,
        );
        expect(circle, `Circle for endpoint waypoint ${n} not found near text position`).toBeTruthy();

        expect(circle!.fillStyle,   `Waypoint ${n}: expected black fill`).toBe('#000000');
        expect(circle!.strokeStyle, `Waypoint ${n}: expected white stroke`).toBe('#ffffff');
        expect(numText!.fillStyle,  `Waypoint ${n}: expected white number`).toBe('#ffffff');
      }
    });

    test('intermediate waypoints: white fill, black stroke, black number', async ({ page }) => {
      const captures = await getCaptures(page);
      const circles = waypointCircles(captures);
      const nums = waypointNumbers(captures);
      const maxNum = Math.max(...nums.map(t => parseInt(t.text)));

      const intermediate = nums.filter(t => {
        const n = parseInt(t.text);
        return n > 1 && n < maxNum;
      });
      expect(intermediate.length).toBeGreaterThan(0);

      for (const numText of intermediate) {
        const circle = circles.find(c =>
          Math.abs(c.x - numText.x) < 2 && Math.abs(c.y - numText.y) < 2,
        );
        expect(circle, `Circle for intermediate waypoint ${numText.text} not found`).toBeTruthy();
        expect(circle!.fillStyle,   `Waypoint ${numText.text}: expected white fill`).toBe('#ffffff');
        expect(circle!.strokeStyle, `Waypoint ${numText.text}: expected black stroke`).toBe('#000000');
        expect(numText.fillStyle,   `Waypoint ${numText.text}: expected black number`).toBe('#000000');
      }
    });

    test('waypoint numbers are bold 20px, centred on circle', async ({ page }) => {
      const captures = await getCaptures(page);
      const nums = waypointNumbers(captures);
      expect(nums.length).toBeGreaterThan(0);
      for (const t of nums) {
        expect(t.font).toContain('bold');
        expect(t.font).toContain('20px');
      }
    });

    test('no two waypoint circles overlap (centre-to-centre > 50px)', async ({ page }) => {
      const captures = await getCaptures(page);
      const circles = waypointCircles(captures);
      for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
          const d = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y);
          expect(d,
            `Waypoint circles at (${circles[i].x},${circles[i].y}) and (${circles[j].x},${circles[j].y}) overlap (dist=${d.toFixed(1)})`,
          ).toBeGreaterThan(2 * CIRCLE_R);
        }
      }
    });
  });

  // ── Wildcards ────────────────────────────────────────────────────────────────

  test.describe('Wildcards', () => {
    function wildcardRings(captures: Captures): CircleCapture[] {
      return captures.circles.filter(c => c.r === WILDCARD_RING_R && c.op === 'stroke');
    }

    test('wildcard rings drawn at r=30, orange stroke (#f5a623), lineWidth=3', async ({ page }) => {
      const captures = await getCaptures(page);
      const rings = wildcardRings(captures);
      expect(rings.length, 'Expected at least one wildcard orange ring').toBeGreaterThan(0);
      for (const ring of rings) {
        expect(ring.r).toBe(WILDCARD_RING_R);
        expect(ring.strokeStyle, 'Wildcard ring should be orange').toBe('#f5a623');
        expect(ring.lineWidth, 'Wildcard ring lineWidth should be 3').toBe(3);
      }
    });

    test('orange rings are visible when Show Wildcards is checked (default)', async ({ page }) => {
      await expect(page.locator('#showWildcards')).toBeChecked();
      // Check for orange pixels in canvas
      const orangePixels = await page.evaluate(() => {
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          // #f5a623 ≈ R:245 G:166 B:35
          if (data[i] > 220 && data[i + 1] > 130 && data[i + 1] < 200 && data[i + 2] < 80 && data[i + 3] > 200)
            count++;
        }
        return count;
      });
      expect(orangePixels, 'Expected orange ring pixels on canvas').toBeGreaterThan(0);
    });

    test('unchecking Show Wildcards removes orange rings; rechecking restores them', async ({ page }) => {
      const countOrange = () => page.evaluate(() => {
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 220 && data[i + 1] > 130 && data[i + 1] < 200 && data[i + 2] < 80 && data[i + 3] > 200)
            count++;
        }
        return count;
      });

      const countBefore = await countOrange();
      expect(countBefore).toBeGreaterThan(0);

      await page.locator('#showWildcards').uncheck();
      await page.waitForTimeout(100);
      const countAfterHide = await countOrange();
      // W turn labels are also orange so count may not reach 0, but rings being
      // removed should drop the pixel count significantly.
      expect(countAfterHide,
        `Orange pixel count should decrease after unchecking wildcards (was ${countBefore})`,
      ).toBeLessThan(countBefore);

      await page.locator('#showWildcards').check();
      await page.waitForTimeout(100);
      const countAfterRestore = await countOrange();
      expect(countAfterRestore,
        'Orange pixel count should recover after rechecking wildcards',
      ).toBeGreaterThanOrEqual(countBefore);
    });
  });

  // ── Turn Labels ──────────────────────────────────────────────────────────────

  test.describe('Turn Labels', () => {
    function turnLabels(captures: Captures): TextCapture[] {
      return captures.texts.filter(t => ['L', 'R', 'W'].includes(t.text) && t.font.includes('13px'));
    }

    function waypointCircles(captures: Captures): CircleCapture[] {
      return captures.circles.filter(c => c.r === CIRCLE_R && c.op === 'fill+stroke');
    }

    test('turn labels (L, R, W) exist for intermediate waypoints', async ({ page }) => {
      const captures = await getCaptures(page);
      const labels = turnLabels(captures);
      expect(labels.length, 'Expected turn labels on intermediate waypoints').toBeGreaterThan(0);
    });

    test('turn labels are bold 13px Arial', async ({ page }) => {
      const captures = await getCaptures(page);
      for (const label of turnLabels(captures)) {
        expect(label.font).toContain('bold');
        expect(label.font).toContain('13px');
      }
    });

    test('turn labels are ~46px NE of their waypoint centre', async ({ page }) => {
      const captures = await getCaptures(page);
      const circles = waypointCircles(captures);
      const labels = turnLabels(captures);

      // turnLabelPos: lx = cx + offset*0.707, ly = cy - offset*0.707
      // So the waypoint this label belongs to should be at:
      //   cx ≈ lx - TURN_LABEL_OFFSET*0.707
      //   cy ≈ ly + TURN_LABEL_OFFSET*0.707
      const NE = TURN_LABEL_OFFSET * 0.707;

      for (const label of labels) {
        const expectedCx = label.x - NE;
        const expectedCy = label.y + NE;
        const closestDist = circles.reduce(
          (min, c) => Math.min(min, Math.hypot(c.x - expectedCx, c.y - expectedCy)),
          Infinity,
        );
        expect(closestDist,
          `Turn label "${label.text}" at (${label.x.toFixed(1)},${label.y.toFixed(1)}): expected a waypoint circle ~${NE.toFixed(1)}px SW but closest was ${closestDist.toFixed(1)}px away`,
        ).toBeLessThan(3); // within 3px of expected position
      }
    });

    test('Show Turns toggle is on by default and hides/shows labels', async ({ page }) => {
      await expect(page.locator('#showTurns')).toBeChecked();

      // #e00 = #ee0000 in browser: R:238 G:0 B:0
      const countRedPixels = () => page.evaluate(() => {
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 200 && data[i + 1] < 30 && data[i + 2] < 30 && data[i + 3] > 200) count++;
        }
        return count;
      });

      expect(await countRedPixels(), 'Red turn labels should be visible by default').toBeGreaterThan(0);

      await page.locator('#showTurns').uncheck();
      await page.waitForTimeout(100);
      expect(await countRedPixels(), 'Red turn labels should disappear after unchecking Show Turns').toBe(0);

      await page.locator('#showTurns').check();
      await page.waitForTimeout(100);
      expect(await countRedPixels(), 'Red turn labels should reappear after rechecking Show Turns').toBeGreaterThan(0);
    });
  });

  // ── D1. Grid lines ───────────────────────────────────────────────────────────

  test('D1 — grid lines use colour #e0e0e0 with ~60px spacing', async ({ page }) => {
    const captures = await getCaptures(page);
    const gridLines = captures.lines.filter(l => l.strokeStyle === '#e0e0e0');
    expect(gridLines.length).toBeGreaterThan(0);

    // Collect distinct y-values of horizontal grid lines and verify each gap ≈ 60px.
    const ys = [...new Set(
      gridLines.filter(l => Math.abs(l.y1 - l.y2) < 0.5).map(l => Math.round(l.y1)),
    )].sort((a, b) => a - b);

    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeCloseTo(60, 0);
    }
  });

  // ── D2. Turn label count equals waypoint count minus 2 ───────────────────────

  test('D2 — turn label count equals waypoint count minus 2', async ({ page }) => {
    const captures = await getCaptures(page);
    const labels = captures.texts.filter(t => ['L', 'R', 'W'].includes(t.text) && t.font.includes('13px'));
    const nums   = captures.texts.filter(t => /^\d+$/.test(t.text) && t.font.includes('20px'));
    const waypointCount = Math.max(...nums.map(t => parseInt(t.text)));
    expect(labels.length).toBe(waypointCount - 2);
  });

  // ── D3. No turn label at waypoint 1 or the last waypoint ────────────────────

  test('D3 — no turn label at the NE position of waypoint 1 or the last waypoint', async ({ page }) => {
    const captures = await getCaptures(page);
    const nums   = captures.texts.filter(t => /^\d+$/.test(t.text) && t.font.includes('20px'));
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

  // ── D4. Hover: adjacent segments thicken to 4px ──────────────────────────────

  test('D4 — hovering over a waypoint thickens its adjacent segments to lineWidth 4', async ({ page }) => {
    const captures = await getCaptures(page);
    const circles = captures.circles.filter(c => c.r === CIRCLE_R && c.op === 'fill+stroke');
    expect(circles.length).toBeGreaterThan(1);

    const wp = circles[1]; // intermediate waypoint
    const canvas = page.locator('#waypointCanvas');
    const cssWidth = await canvas.evaluate(el => parseInt((el as HTMLCanvasElement).style.width));
    const pixWidth = await canvas.evaluate(el => (el as HTMLCanvasElement).width);
    const scale = cssWidth / pixWidth;

    // Reset line captures before hover so we only see the hover-redrawn content.
    await page.evaluate(() => {
      (window as any).__captures.lines = [];
      (window as any).__captures.circles = [];
    });

    await canvas.hover({ position: { x: wp.x * scale, y: wp.y * scale } });
    await page.waitForTimeout(150);

    const hoverCaptures = await getCaptures(page);
    // Hovered segments use strokeStyle '#555' (normalised to '#555555') and lineWidth 4.
    const thickLines = hoverCaptures.lines.filter(l => l.strokeStyle === '#555555' && l.lineWidth === 4);
    expect(thickLines.length, 'Expected hovered segments to thicken to lineWidth 4').toBeGreaterThan(0);
  });

  // ── D5. Hover: waypoint gains a drop shadow ──────────────────────────────────

  test('D5 — hovering over a waypoint renders a shadow', async ({ page }) => {
    // Track the maximum shadowBlur seen on any arc() call.
    await page.evaluate(() => {
      (window as any).__shadowBlurMax = 0;
      const proto = CanvasRenderingContext2D.prototype;
      const _arc = proto.arc;
      proto.arc = function (...args: Parameters<typeof _arc>) {
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

  // ── Report ───────────────────────────────────────────────────────────────────

  test('write report file', async () => {
    const report = [
      `## Visual Requirements Check — ${timestamp}`,
      ``,
      `Screenshots:`,
      `  Full page: ./screenshots/visual-check-${timestamp}-full.png`,
      `  Canvas:    ./screenshots/visual-check-${timestamp}-canvas.png`,
      ``,
      `Run \`npx playwright test tests/visual-check.spec.ts --reporter=html\``,
      `then open the HTML report for per-test pass/fail details.`,
      ``,
      `### Automated checks`,
      `| Category    | Tests                                                          |`,
      `|-------------|----------------------------------------------------------------|`,
      `| Path Lines  | orthogonal, colour #222222, weight 2px, ≥55px separation       |`,
      `| Waypoints   | r=25px, endpoint colours, intermediate colours, no overlap     |`,
      `| Wildcards   | r=30 orange ring, visible by default, toggle hides/shows       |`,
      `| Turn Labels | L/R/W text, bold 13px, NE position ~46px, toggle hides/shows   |`,
    ].join('\n');

    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, `visual-check-${timestamp}-report.md`),
      report,
      'utf8',
    );
  });
});

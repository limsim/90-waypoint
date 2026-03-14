import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

async function waitForLoad(page: Page): Promise<void> {
    await page.waitForFunction(
        () => !document.getElementById('loading')?.classList.contains('visible'),
        { timeout: 30_000 },
    );
    await page.waitForTimeout(150);
}

// Canvas interception — records every arc and fillText drawn on the canvas.
// Shared with C5 and C11 which need to count drawn waypoint circles.
const INIT_SCRIPT = `
(function () {
  const captures = { circles: [], lines: [], texts: [] };
  window.__captures = captures;

  let currentArc = null;
  let currentLines = [];
  let currentPos = null;

  const proto = CanvasRenderingContext2D.prototype;
  const _beginPath = proto.beginPath;
  const _arc = proto.arc;
  const _moveTo = proto.moveTo;
  const _lineTo = proto.lineTo;
  const _fill = proto.fill;
  const _stroke = proto.stroke;
  const _fillText = proto.fillText;

  proto.beginPath = function () {
    currentArc = null; currentLines = []; currentPos = null;
    return _beginPath.call(this);
  };
  proto.arc = function (x, y, r, s, e, a) {
    currentArc = { x, y, r };
    return _arc.call(this, x, y, r, s, e, a);
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
        fillStyle: String(this.fillStyle), strokeStyle: String(this.strokeStyle),
        lineWidth: this.lineWidth, op: 'fill',
      });
    }
    return _fill.apply(this, arguments);
  };
  proto.stroke = function () {
    if (currentArc) {
      const prev = captures.circles.find(
        c => c.x === currentArc.x && c.y === currentArc.y && c.r === currentArc.r && c.op === 'fill',
      );
      if (prev) { prev.op = 'fill+stroke'; prev.strokeStyle = String(this.strokeStyle); prev.lineWidth = this.lineWidth; }
      else captures.circles.push({ x: currentArc.x, y: currentArc.y, r: currentArc.r,
        fillStyle: String(this.fillStyle), strokeStyle: String(this.strokeStyle),
        lineWidth: this.lineWidth, op: 'stroke' });
    }
    if (currentLines.length > 0) {
      for (const seg of currentLines)
        captures.lines.push({ ...seg, strokeStyle: String(this.strokeStyle), lineWidth: this.lineWidth });
    }
    return _stroke.call(this);
  };
  proto.fillText = function (text, x, y) {
    captures.texts.push({ text: String(text), x, y, fillStyle: String(this.fillStyle), font: this.font });
    return _fillText.call(this, text, x, y);
  };
})();
`;

// ─── C1. Walk auto-generated on page load ────────────────────────────────────

test('C1 — walk auto-generates on page load', async ({ page }) => {
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

// ─── C2. Generate Walk button produces a new walk ────────────────────────────

test('C2 — Generate Walk button changes canvas content', async ({ page }) => {
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

// ─── C3. Clear button empties the canvas ─────────────────────────────────────

test('C3 — Clear button leaves no dark pixels on canvas', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.locator('#clearBtn').click();
    await page.waitForTimeout(100);

    const hasDarkPixels = await page.evaluate(() => {
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 200 && data[i + 3] > 0) return true;
        }
        return false;
    });
    expect(hasDarkPixels).toBe(false);
});

// ─── C4. Waypoint count input defaults and attributes ────────────────────────

test('C4 — waypoint count input defaults to 90', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#waypointCount')).toHaveValue('90');
});

test('C4 — waypoint count input has min=10 and max=90', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#waypointCount')).toHaveAttribute('min', '10');
    await expect(page.locator('#waypointCount')).toHaveAttribute('max', '90');
});

// ─── C5. Setting waypoint count to 10 generates exactly 10 waypoints ─────────

test('C5 — setting waypoint count to 10 generates exactly 10 waypoints', async ({ page }) => {
    await page.addInitScript(INIT_SCRIPT);
    await page.goto(BASE_URL);
    await waitForLoad(page);

    // Reset captures, then regenerate with count=10.
    await page.evaluate(() => { (window as any).__captures = { circles: [], lines: [], texts: [] }; });
    await page.locator('#waypointCount').fill('10');
    await page.locator('#generateBtn').click();
    await waitForLoad(page);

    const captures = await page.evaluate(() => (window as any).__captures);
    const waypointCircles = captures.circles.filter((c: any) => c.r === 25 && c.op === 'fill+stroke');
    expect(waypointCircles.length).toBe(10);
});

// ─── C6. Generate Walk button disabled during generation; re-enabled after ───

test('C6 — Generate Walk button is re-enabled after generation completes', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.locator('#generateBtn').click();
    await waitForLoad(page);

    await expect(page.locator('#generateBtn')).not.toBeDisabled();
});

test('C6 — loading overlay is hidden after generation completes', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.locator('#generateBtn').click();
    await waitForLoad(page);

    await expect(page.locator('#loading')).not.toHaveClass(/visible/);
});

// ─── C7. Print button calls window.print() ───────────────────────────────────

test('C7 — Print button calls window.print()', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    let printCalled = false;
    await page.exposeFunction('__onPrint', () => { printCalled = true; });
    await page.evaluate(() => { window.print = () => (window as any).__onPrint(); });

    await page.locator('#printBtn').click();
    await page.waitForTimeout(200);
    expect(printCalled).toBe(true);
});

// ─── C8. Legend present, below canvas, three entries ─────────────────────────

test('C8 — legend is visible and positioned below the canvas', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    const legend = page.locator('#legend');
    await expect(legend).toBeVisible();

    const canvasBox = await page.locator('#waypointCanvas').boundingBox();
    const legendBox = await legend.boundingBox();
    expect(legendBox!.y).toBeGreaterThan(canvasBox!.y + canvasBox!.height - 10);
});

test('C8 — legend contains start/end, waypoint, and wildcard entries', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    const text = await page.locator('#legend').innerText();
    expect(text).toMatch(/start|end/i);
    expect(text).toMatch(/waypoint/i);
    expect(text).toMatch(/wildcard/i);
});

// ─── C9. Legend not hidden in print media ────────────────────────────────────

test('C9 — legend is visible in print media', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForLoad(page);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#legend')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
});

// ─── C10. No horizontal scroll at standard viewport widths ───────────────────

for (const width of [375, 768, 1280]) {
    test(`C10 — no horizontal scroll at ${width}px viewport`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(BASE_URL);
        await waitForLoad(page);

        const hasHScroll = await page.evaluate(() =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(hasHScroll).toBe(false);
    });
}

// ─── C11. Click tooltip shows number, turn, and cumulative distance ───────────

test('C11 — clicking a waypoint shows tooltip with number, turn, and distance', async ({ page }) => {
    await page.addInitScript(INIT_SCRIPT);
    await page.goto(BASE_URL);
    await waitForLoad(page);

    const captures = await page.evaluate(() => (window as any).__captures);
    const waypointCircles = captures.circles.filter((c: any) => c.r === 25 && c.op === 'fill+stroke');
    expect(waypointCircles.length).toBeGreaterThan(1);

    // Use an intermediate waypoint (index 1) — it has a turn label and cumulative distance.
    const wp = waypointCircles[1];
    const canvas = page.locator('#waypointCanvas');
    const cssWidth = await canvas.evaluate(el => parseInt((el as HTMLCanvasElement).style.width));
    const pixWidth = await canvas.evaluate(el => (el as HTMLCanvasElement).width);
    const scale = cssWidth / pixWidth;

    await canvas.click({ position: { x: wp.x * scale, y: wp.y * scale } });
    await page.waitForTimeout(100);

    const tooltip = page.locator('#tooltip');
    await expect(tooltip).toBeVisible();
    const text = await tooltip.innerText();
    expect(text).toMatch(/\d+/);   // waypoint number
    expect(text).toMatch(/[LRW]/); // turn direction
    expect(text).toMatch(/\d/);    // cumulative distance (some digits)
});

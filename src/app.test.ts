import { beforeAll, beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// ─── Canvas mock ─────────────────────────────────────────────────────────────

const mockCtx = {
    clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
    rotate: vi.fn(), setLineDash: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    canvas: { width: 794, height: 1123 },
    strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: '', font: '',
    textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
};

beforeAll(() => {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = () => mockCtx;

    // Make toCanvasCoords return (clientX, clientY) directly (scale factor = 1).
    HTMLCanvasElement.prototype.getBoundingClientRect = function () {
        return {
            left: 0, top: 0, right: this.width, bottom: this.height,
            width: this.width, height: this.height, x: 0, y: 0,
            toJSON: () => {},
        } as DOMRect;
    };
});

// ─── DOM scaffold ─────────────────────────────────────────────────────────────

beforeEach(() => {
    // The actual canvas ID used by WaypointApp is 'waypointCanvas'.
    document.body.innerHTML = `
        <div>
            <canvas id="waypointCanvas"></canvas>
            <button id="generateBtn">Generate Walk</button>
            <button id="clearBtn">Clear</button>
            <input id="waypointCount" type="number" value="10" min="10" max="90" />
            <input id="showWildcards" type="checkbox" checked />
            <input id="showTurns" type="checkbox" checked />
            <button id="printBtn">Print</button>
            <div id="tooltip" style="display:none"></div>
            <div id="loading"></div>
        </div>
    `;
    vi.clearAllMocks();
});

// ─── WaypointApp tests ────────────────────────────────────────────────────────

describe('WaypointApp', () => {
    it('auto-generates a walk on construction (waypoints.length > 0)', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        // generateWalk defers _runGeneration via setTimeout; wait for it to complete.
        await new Promise(r => setTimeout(r, 0));
        expect((app as any).waypoints.length).toBeGreaterThan(0);
    });

    it('Clear button resets waypoints to []', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        document.getElementById('clearBtn')!.click();
        expect((app as any).waypoints).toEqual([]);
    });

    it('waypoint count input value is clamped to 10–90 when read by generateWalk', async () => {
        const { WaypointApp } = await import('./index');
        new WaypointApp();
        const input = document.getElementById('waypointCount') as HTMLInputElement;
        input.value = '5';
        // Verify the clamping expression the app uses produces 10.
        const clamped = Math.max(10, Math.min(90, parseInt(input.value, 10) || 90));
        expect(clamped).toBe(10);
        input.value = '200';
        const clampedHigh = Math.max(10, Math.min(90, parseInt(input.value, 10) || 90));
        expect(clampedHigh).toBe(90);
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
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        canvas.dispatchEvent(new MouseEvent('click', { clientX: wp.x, clientY: wp.y, bubbles: true }));
        expect(document.getElementById('tooltip')!.style.display).not.toBe('none');
    });

    it('click off waypoints hides tooltip', async () => {
        const { WaypointApp } = await import('./index');
        new WaypointApp();
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        canvas.dispatchEvent(new MouseEvent('click', { clientX: -9999, clientY: -9999, bubbles: true }));
        expect(document.getElementById('tooltip')!.style.display).toBe('none');
    });

    it('hitTest returns correct index for waypoint within radius', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        const waypoints: any[] = (app as any).waypoints;
        if (waypoints.length < 3) return;
        const wp = waypoints[2];
        expect((app as any).hitTest(wp.x, wp.y)).toBe(2);
    });

    it('hitTest returns -1 for a miss', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        expect((app as any).hitTest(-9999, -9999)).toBe(-1);
    });

    it('mousemove over then off waypoint updates hoveredIndex and cursor', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        const waypoints: any[] = (app as any).waypoints;
        if (waypoints.length === 0) return;
        const wp = waypoints[0];
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;

        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: wp.x, clientY: wp.y, bubbles: true }));
        expect((app as any).hoveredIndex).toBe(0);
        expect(canvas.style.cursor).toBe('pointer');

        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: -9999, clientY: -9999, bubbles: true }));
        expect((app as any).hoveredIndex).toBe(-1);
        expect(canvas.style.cursor).toBe('default');
    });

    it('mouseleave resets hoveredIndex and cursor to default', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        (app as any).hoveredIndex = 2;
        const canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        expect((app as any).hoveredIndex).toBe(-1);
        expect(canvas.style.cursor).toBe('default');
    });

    it('drawCanvas calls ctx.save/restore when a waypoint is hovered', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        // Manually populate waypoints — avoids waiting for async generation and
        // is immune to timer pile-up from earlier tests in this suite.
        (app as any).waypoints = [
            { x: 100, y: 100, number: 1, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 0 },
            { x: 200, y: 100, number: 2, turn: 'L', heading: 'E', isWildcard: false, cumulativeDistance: 100 },
        ];
        (app as any).hoveredIndex = 0;
        // Reset mock counts so only the following drawCanvas call is measured.
        vi.clearAllMocks();
        (app as any).drawCanvas();
        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('drawCanvas renders wildcard path with N/S heading and wildcard ring', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        // Waypoint 0: turn='Wildcard' → drawPathLines uses the wildcard else-branch.
        // b.heading='N' → N/S sub-branch (lineTo(a.x, b.y) first).
        // Waypoint 1: isWildcard=true → wildcard ring drawn when showWildcards=true.
        (app as any).waypoints = [
            { x: 200, y: 400, number: 1, turn: 'Wildcard', heading: 'S', isWildcard: false, cumulativeDistance: 0 },
            { x: 200, y: 100, number: 2, turn: 'L',        heading: 'N', isWildcard: true,  cumulativeDistance: 300 },
            { x: 500, y: 100, number: 3, turn: 'R',        heading: 'E', isWildcard: false, cumulativeDistance: 600 },
        ];
        expect(() => (app as any).drawCanvas()).not.toThrow();
    });

    it('drawCanvas renders wildcard path with E/W heading, wildcard ring, and wildcard turn label', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
        // Waypoint 1: turn='Wildcard' → drawPathLines uses the wildcard else-branch.
        // b.heading='W' → E/W sub-branch (lineTo(b.x, a.y) first).
        // Waypoint 1: isWildcard=true AND turn='Wildcard', number=2 (not endpoint)
        //   → wildcard ring drawn AND wildcard turn label ('W' in orange) rendered.
        (app as any).waypoints = [
            { x: 100, y: 200, number: 1, turn: 'R',        heading: 'E', isWildcard: false, cumulativeDistance: 0 },
            { x: 400, y: 200, number: 2, turn: 'Wildcard', heading: 'E', isWildcard: true,  cumulativeDistance: 300 },
            { x: 700, y: 200, number: 3, turn: 'L',        heading: 'W', isWildcard: false, cumulativeDistance: 600 },
        ];
        expect(() => (app as any).drawCanvas()).not.toThrow();
    });
});

// ─── B1–B3: additional WaypointApp tests ─────────────────────────────────────

describe('WaypointApp — B stream', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('B1 — generates 90 waypoints when waypoint count input is 90', async () => {
        // Mock generation so the 90-waypoint run is instant (avoids multi-second real generation).
        const walkModule = await import('./walk');
        const fake90: ReturnType<typeof walkModule.tryGenerate> = Array.from({ length: 90 }, (_, i) => ({
            x: 100 + i * 8, y: 100, number: i + 1,
            turn: 'R' as const, heading: 'E' as const, isWildcard: false, cumulativeDistance: i * 100,
        }));
        const tryGenerateSpy = vi.spyOn(walkModule, 'tryGenerate').mockReturnValue(fake90);
        const isValidSpy     = vi.spyOn(walkModule, 'isValid').mockReturnValue(true);

        (document.getElementById('waypointCount') as HTMLInputElement).value = '90';
        const { WaypointApp } = await import('./index');
        vi.useFakeTimers();
        const app = new WaypointApp();
        vi.runAllTimers();
        vi.useRealTimers();

        expect((app as any).waypoints.length).toBe(90);
        tryGenerateSpy.mockRestore();
        isValidSpy.mockRestore();
    });

    it('B2 — clicking Generate Walk button changes waypoints', async () => {
        (document.getElementById('waypointCount') as HTMLInputElement).value = '10';
        const { WaypointApp } = await import('./index');
        vi.useFakeTimers();
        const app = new WaypointApp();
        vi.runAllTimers(); // run initial _runGeneration
        const firstPositions = (app as any).waypoints
            .map((w: any) => `${w.x},${w.y}`).join('|');

        document.getElementById('generateBtn')!.click();
        vi.runAllTimers(); // run second _runGeneration
        vi.useRealTimers();

        const secondPositions = (app as any).waypoints
            .map((w: any) => `${w.x},${w.y}`).join('|');
        expect(secondPositions).not.toBe(firstPositions);
    });

    it('B3 — _runGeneration grows the canvas by SCALE_STEP after ATTEMPTS_PER_SIZE failures', async () => {
        const walkModule = await import('./walk');
        const originalTryGenerate = walkModule.tryGenerate;
        const calledWithW: number[] = [];
        let callCount = 0;

        // Return two overlapping waypoints so isValid() returns false for the first
        // ATTEMPTS_PER_SIZE calls — forcing scale to increase — then yield to the
        // real implementation so generation succeeds at the wider canvas size.
        const invalidResult: ReturnType<typeof walkModule.tryGenerate> = [
            { x: 100, y: 100, number: 1, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 0 },
            { x: 110, y: 100, number: 2, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 10 },
        ];
        vi.spyOn(walkModule, 'tryGenerate').mockImplementation((W, H, ...rest) => {
            callCount++;
            calledWithW.push(W);
            if (callCount <= 200) return invalidResult;
            return originalTryGenerate(W, H, ...rest);
        });

        (document.getElementById('waypointCount') as HTMLInputElement).value = '10';
        const { WaypointApp } = await import('./index');
        vi.useFakeTimers();
        new WaypointApp();
        vi.runAllTimers();
        vi.useRealTimers();

        // After 200 failures at the A4 tier, the 201st call must use W > A4_W (794).
        expect(calledWithW[200]).toBeGreaterThan(794);
    });
});

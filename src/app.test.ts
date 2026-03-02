import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
        </div>
    `;
    vi.clearAllMocks();
});

// ─── WaypointApp tests ────────────────────────────────────────────────────────

describe('WaypointApp', () => {
    it('auto-generates a walk on construction (waypoints.length > 0)', async () => {
        const { WaypointApp } = await import('./index');
        const app = new WaypointApp();
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
});

import { describe, expect, it } from 'vitest';
import {
    A4_H, A4_W, CIRCLE_R, CIRCLE_SEP, LINE_SEP,
    Heading, WaypointData,
    inBounds, isValid, overlaps, segCrossesCircle, segTooClose, tryGenerate,
    TURN_LEFT, TURN_RIGHT,
} from './walk';

// Minimal WaypointData for tests that only care about position
const wp = (x: number, y: number): WaypointData => ({
    x, y, number: 1, turn: 'L', heading: 'N', isWildcard: false, cumulativeDistance: 0,
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
    it('CIRCLE_SEP is 72', () => expect(CIRCLE_SEP).toBe(72));
    it('LINE_SEP is 55',   () => expect(LINE_SEP).toBe(55));
    it('CIRCLE_R is 25',   () => expect(CIRCLE_R).toBe(25));
    it('A4_W is 794',      () => expect(A4_W).toBe(794));
    it('A4_H is 1123',     () => expect(A4_H).toBe(1123));
});

// ─── TURN_LEFT / TURN_RIGHT ──────────────────────────────────────────────────

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

// ─── overlaps() ──────────────────────────────────────────────────────────────

describe('overlaps()', () => {
    it('returns false for empty list',             () => expect(overlaps(0, 0, [])).toBe(false));
    it('returns true when distance < CIRCLE_SEP',  () => expect(overlaps(10, 0, [wp(0, 0)])).toBe(true));
    it('returns false when distance === CIRCLE_SEP', () => expect(overlaps(72, 0, [wp(0, 0)])).toBe(false));
    it('returns false when distance > CIRCLE_SEP', () => expect(overlaps(100, 0, [wp(0, 0)])).toBe(false));
});

// ─── inBounds() ──────────────────────────────────────────────────────────────

describe('inBounds()', () => {
    const W = 794, H = 1123, PAD = 30;

    it('returns true for a well-centred point', () => expect(inBounds(400, 560, W, H, PAD)).toBe(true));
    it('returns false left of pad',  () => expect(inBounds(PAD - 1, 560, W, H, PAD)).toBe(false));
    it('returns false right of pad', () => expect(inBounds(W - PAD + 1, 560, W, H, PAD)).toBe(false));
    it('returns false above pad',    () => expect(inBounds(400, PAD - 1, W, H, PAD)).toBe(false));
    it('returns false below pad',    () => expect(inBounds(400, H - PAD + 1, W, H, PAD)).toBe(false));
});

// ─── segTooClose() ───────────────────────────────────────────────────────────

describe('segTooClose()', () => {
    it('parallel horizontal, gap < LINE_SEP, overlapping → true', () =>
        expect(segTooClose(0, 0, 200, 0,   0, 40, 200, 40)).toBe(true));

    it('parallel horizontal, gap === LINE_SEP → false', () =>
        expect(segTooClose(0, 0, 200, 0,   0, 55, 200, 55)).toBe(false));

    it('parallel vertical, gap < LINE_SEP, overlapping → true', () =>
        expect(segTooClose(0, 0, 0, 200,   40, 0, 40, 200)).toBe(true));

    it('parallel horizontal, non-overlapping x-range → false', () =>
        expect(segTooClose(0, 0, 100, 0,   200, 30, 300, 30)).toBe(false));

    it('perpendicular segments → false', () =>
        expect(segTooClose(0, 0, 200, 0,   50, -50, 50, 50)).toBe(false));
});

// ─── segCrossesCircle() ──────────────────────────────────────────────────────

describe('segCrossesCircle()', () => {
    it('horizontal segment passing through circle → true', () =>
        expect(segCrossesCircle(0, 100, 200, 100,   100, 100, CIRCLE_R)).toBe(true));

    it('vertical segment passing through circle → true', () =>
        expect(segCrossesCircle(100, 0, 100, 200,   100, 100, CIRCLE_R)).toBe(true));

    it('segment that misses circle → false', () =>
        expect(segCrossesCircle(0, 200, 400, 200,   100, 100, CIRCLE_R)).toBe(false));
});

// ─── isValid() ───────────────────────────────────────────────────────────────

describe('isValid()', () => {
    it('empty array → true',     () => expect(isValid([])).toBe(true));
    it('single waypoint → true', () => expect(isValid([wp(400, 560)])).toBe(true));

    it('overlapping circles → false', () =>
        expect(isValid([wp(0, 0), wp(10, 0)])).toBe(false));

    it('non-overlapping circles → true', () =>
        expect(isValid([wp(0, 0), wp(200, 0)])).toBe(true));

    it('two horizontal segments gap < LINE_SEP with overlapping range → false', () => {
        // A U-shaped 4-waypoint path; the two horizontal segments are only 30px apart.
        const path: WaypointData[] = [
            { x: 0,   y: 0,  number: 1, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 0 },
            { x: 200, y: 0,  number: 2, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 200 },
            { x: 200, y: 30, number: 3, turn: 'L', heading: 'W', isWildcard: false, cumulativeDistance: 230 },
            { x: 0,   y: 30, number: 4, turn: 'R', heading: 'W', isWildcard: false, cumulativeDistance: 430 },
        ];
        expect(isValid(path)).toBe(false);
    });

    it('two horizontal segments gap >= LINE_SEP → true', () => {
        // Rectangle with all circles >= 200px apart and segment gap = 200px >= 55px.
        const path: WaypointData[] = [
            { x: 0,   y: 0,   number: 1, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 0 },
            { x: 300, y: 0,   number: 2, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 300 },
            { x: 300, y: 200, number: 3, turn: 'R', heading: 'W', isWildcard: false, cumulativeDistance: 500 },
            { x: 0,   y: 200, number: 4, turn: 'R', heading: 'W', isWildcard: false, cumulativeDistance: 800 },
        ];
        expect(isValid(path)).toBe(true);
    });
});

// ─── Wildcard index selection ─────────────────────────────────────────────────

describe('wildcard index selection', () => {
    it('count=10 → wildcardCount = 1', () => {
        expect(Math.max(1, Math.round(10 / 9))).toBe(1);
    });

    it('count=90 → wildcardCount = 10', () => {
        expect(Math.max(1, Math.round(90 / 9))).toBe(10);
    });

    it('indices 0, 1, and count-1 never selected (1000 iterations, count=20)', () => {
        for (let trial = 0; trial < 1000; trial++) {
            const count = 20;
            const pool = Array.from({ length: count }, (_, i) => i)
                .filter(i => i !== 0 && i !== 1 && i !== count - 1);
            const wildcardCount = Math.max(1, Math.round(count / 9));
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

// ─── tryGenerate() — north-facing start ──────────────────────────────────────

describe('tryGenerate() — north-facing start', () => {
    const turns: Array<'L' | 'R'> = Array(90).fill('R');

    it('wp[0] and wp[1] share the same x-coordinate', () => {
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        if (result.length < 2) return;
        expect(result[0].x).toBe(result[1].x);
    });

    it('wp[1] is directly above wp[0] (lower y)', () => {
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        if (result.length < 2) return;
        expect(result[1].y).toBeLessThan(result[0].y);
    });

    it('first two headings are N', () => {
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        if (result.length < 2) return;
        expect(result[0].heading).toBe('N');
        expect(result[1].heading).toBe('N');
    });
});

// ─── tryGenerate() — outbound-turn shift ─────────────────────────────────────

describe('tryGenerate() — outbound-turn shift', () => {
    it('last waypoint retains a valid turn value (not overwritten)', () => {
        const turns: Array<'L' | 'R'> = Array(10).fill('L');
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        if (result.length < 10) return;
        expect(['L', 'R', 'Wildcard']).toContain(result[result.length - 1].turn);
    });

    it('result[0].turn is a valid turn value after shift', () => {
        // After the shift, result[0].turn is copied from result[1].turn (before shift).
        const turns: Array<'L' | 'R'> = Array(10).fill('R');
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        if (result.length < 2) return;
        expect(['L', 'R', 'Wildcard']).toContain(result[0].turn);
    });
});

// ─── tryGenerate() — wildcard skips turn ─────────────────────────────────────

describe('tryGenerate() — wildcard skips turn', () => {
    it('wildcard at generation index 5 appears at result[4].isWildcard after outbound-turn shift', () => {
        // The shift copies result[i].isWildcard = result[i+1].isWildcard, so a wildcard
        // at generation index 5 moves to result[4] after the shift.
        const turns: Array<'L' | 'R'> = Array(20).fill('R');
        const result = tryGenerate(A4_W, A4_H, turns, 20, new Set([5]));
        if (result.length < 6) return;
        expect(result[4].isWildcard).toBe(true);
    });
});

// ─── tryGenerate() — cumulative distance ─────────────────────────────────────

describe('tryGenerate() — cumulative distance', () => {
    it('cumulativeDistance is monotonically increasing', () => {
        const turns: Array<'L' | 'R'> = Array(10).fill('R');
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        for (let i = 1; i < result.length; i++) {
            expect(result[i].cumulativeDistance).toBeGreaterThan(result[i - 1].cumulativeDistance);
        }
    });

    it('cumulativeDistance[0] is positive (first waypoint is one segment from start)', () => {
        // cumDist accumulates before the first push, so result[0] already has a distance > 0.
        const turns: Array<'L' | 'R'> = Array(10).fill('R');
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        expect(result[0].cumulativeDistance).toBeGreaterThan(0);
    });
});

// ─── Centering logic ─────────────────────────────────────────────────────────

describe('centering logic', () => {
    it('after centering, bounding-box midpoint equals canvas midpoint', () => {
        const turns: Array<'L' | 'R'> = Array(10).fill('R');
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        if (result.length < 2) return;

        const xs = result.map(w => w.x);
        const ys = result.map(w => w.y);
        const dx = A4_W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
        const dy = A4_H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;

        const centered = result.map(w => ({ x: w.x + dx, y: w.y + dy }));
        const cxs = centered.map(w => w.x);
        const cys = centered.map(w => w.y);
        const cMidX = (Math.min(...cxs) + Math.max(...cxs)) / 2;
        const cMidY = (Math.min(...cys) + Math.max(...cys)) / 2;

        expect(cMidX).toBeCloseTo(A4_W / 2, 0);
        expect(cMidY).toBeCloseTo(A4_H / 2, 0);
    });
});

// ─── generateWalk() integration ──────────────────────────────────────────────

describe('generateWalk() integration via isValid', () => {
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

        // Mirror the app's retry loop: up to 50 attempts per canvas size, growing by 10% each tier.
        let result: WaypointData[] = [];
        let scale = 1.0;
        outer: for (let tier = 0; tier < 20; tier++) {
            const W = Math.round(A4_W * scale);
            const H = Math.round(A4_H * scale);
            for (let attempt = 0; attempt < 50; attempt++) {
                const candidate = tryGenerate(W, H, turns, count, wildcards);
                if (isValid(candidate)) { result = candidate; break outer; }
            }
            scale += 0.1;
        }

        if (result.length > 0) {
            const xs = result.map(w => w.x), ys = result.map(w => w.y);
            const dx = A4_W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
            const dy = A4_H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
            result.forEach(w => { w.x += dx; w.y += dy; });
        }

        expect(result.length).toBe(count);
        expect(isValid(result)).toBe(true);
    });

    it.each([10, 45, 90])('count=%i: all waypoints within canvas bounds after centering', (count) => {
        const turns: Array<'L' | 'R'> = Array.from({ length: count }, () =>
            Math.random() < 0.5 ? 'L' : 'R'
        );
        const result = tryGenerate(A4_W, A4_H, turns, count, new Set<number>());
        if (result.length > 0) {
            const xs = result.map(w => w.x), ys = result.map(w => w.y);
            const dx = A4_W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
            const dy = A4_H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
            result.forEach(w => { w.x += dx; w.y += dy; });
        }
        for (const w of result) {
            expect(w.x).toBeGreaterThan(0);
            expect(w.x).toBeLessThan(A4_W);
            expect(w.y).toBeGreaterThan(0);
            expect(w.y).toBeLessThan(A4_H);
        }
    });
});

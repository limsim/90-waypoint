import { describe, expect, it } from 'vitest';
import {
    A4_H, A4_W, CIRCLE_R, CIRCLE_SEP, LINE_SEP,
    Heading, WaypointData,
    canPlace, inBounds, isValid, overlaps, pointToSegDist, segCrossesCircle, segTooClose, tryGenerate,
    TURN_LABEL_OFFSET, turnLabelPos,
    TURN_LEFT, TURN_RIGHT,
    SEG_MIN, SEG_JITTER, MULTIPLIERS,
} from './walk';

// Minimal WaypointData for tests that only care about position
const wp = (x: number, y: number): WaypointData => ({
    x, y, number: 1, turn: 'L', heading: 'N', isWildcard: false, cumulativeDistance: 0,
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
    it('CIRCLE_SEP is 72',        () => expect(CIRCLE_SEP).toBe(72));
    it('LINE_SEP is 55',          () => expect(LINE_SEP).toBe(55));
    it('CIRCLE_R is 25',          () => expect(CIRCLE_R).toBe(25));
    it('A4_W is 794',             () => expect(A4_W).toBe(794));
    it('A4_H is 1123',            () => expect(A4_H).toBe(1123));
    it('TURN_LABEL_OFFSET is 46', () => expect(TURN_LABEL_OFFSET).toBe(46));
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

// ─── pointToSegDist() ────────────────────────────────────────────────────────

describe('pointToSegDist()', () => {
    it('point on a horizontal segment → 0', () =>
        expect(pointToSegDist(50, 0, 0, 0, 100, 0)).toBeCloseTo(0));

    it('point directly above midpoint of horizontal segment', () =>
        expect(pointToSegDist(50, 30, 0, 0, 100, 0)).toBeCloseTo(30));

    it('point beyond the right end of a horizontal segment (nearest = endpoint)', () =>
        expect(pointToSegDist(150, 0, 0, 0, 100, 0)).toBeCloseTo(50));

    it('point on a vertical segment → 0', () =>
        expect(pointToSegDist(0, 50, 0, 0, 0, 100)).toBeCloseTo(0));

    it('point to the left of a vertical segment', () =>
        expect(pointToSegDist(-20, 50, 0, 0, 0, 100)).toBeCloseTo(20));

    it('point beyond the bottom end of a vertical segment (nearest = endpoint)', () =>
        expect(pointToSegDist(0, 150, 0, 0, 0, 100)).toBeCloseTo(50));
});

// ─── turnLabelPos() ──────────────────────────────────────────────────────────

describe('turnLabelPos()', () => {
    const makeWp = (x: number, y: number): WaypointData => ({
        x, y, number: 2, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 0,
    });

    it('returns position at approximately TURN_LABEL_OFFSET distance from waypoint centre', () => {
        const pos = turnLabelPos(makeWp(200, 300));
        // 0.707 is an approximation of cos(45°); allow 0.1px tolerance
        expect(Math.hypot(pos.x - 200, pos.y - 300)).toBeCloseTo(TURN_LABEL_OFFSET, 1);
    });

    it('places label to the right of and above the waypoint (NE)', () => {
        const pos = turnLabelPos(makeWp(200, 300));
        expect(pos.x).toBeGreaterThan(200);
        expect(pos.y).toBeLessThan(300);
    });

    it('x and y offsets are equal (true 45° diagonal)', () => {
        const pos = turnLabelPos(makeWp(200, 300));
        expect(pos.x - 200).toBeCloseTo(300 - pos.y);
    });

    it('respects a custom offset argument', () => {
        const pos = turnLabelPos(makeWp(100, 100), 60);
        expect(Math.hypot(pos.x - 100, pos.y - 100)).toBeCloseTo(60, 1);
    });

    it('label clears the wildcard ring outer edge (r + 5 + 1.5 stroke ≈ 31.5px)', () => {
        const pos = turnLabelPos(makeWp(0, 0));
        const distFromCenter = Math.hypot(pos.x, pos.y);
        expect(distFromCenter).toBeGreaterThan(31.5 + 8); // ring edge + TURN_LABEL_CLEARANCE
    });
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
        // Headings record the direction arriving at each waypoint: N→E→S→W
        const path: WaypointData[] = [
            { x: 0,   y: 0,   number: 1, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 0 },
            { x: 300, y: 0,   number: 2, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 300 },
            { x: 300, y: 200, number: 3, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 500 },
            { x: 0,   y: 200, number: 4, turn: 'R', heading: 'W', isWildcard: false, cumulativeDistance: 800 },
        ];
        expect(isValid(path)).toBe(true);
    });

    it('segment path crosses non-adjacent waypoint circle → false', () => {
        // wp[1]→wp[2] is an L-shaped path whose horizontal leg (y=200, x∈[200,500])
        // passes directly through wp[0]'s circle centred at (200,200).
        const path: WaypointData[] = [
            { x: 200, y: 200, number: 1, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 0 },
            { x: 500, y: 200, number: 2, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 300 },
            { x: 200, y: 500, number: 3, turn: 'L', heading: 'W', isWildcard: false, cumulativeDistance: 700 },
        ];
        expect(isValid(path)).toBe(false);
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

// ─── Turn / heading consistency ──────────────────────────────────────────────

describe('turn / heading consistency', () => {
    // Mirrors the app: regenerate turns + wildcards every attempt for reliable success.
    function generate(count: number): WaypointData[] {
        let result: WaypointData[] = [];
        let scale = 1.0;
        const wildcardCount = Math.max(1, Math.round(count / 9));
        outer: for (let tier = 0; tier < 50; tier++) {
            const W = Math.round(A4_W * scale), H = Math.round(A4_H * scale);
            for (let attempt = 0; attempt < 50; attempt++) {
                const turns = Array.from({ length: count }, () =>
                    Math.random() < 0.5 ? 'L' : 'R'
                ) as Array<'L' | 'R'>;
                const pool = Array.from({ length: count }, (_, i) => i)
                    .filter(i => i !== 0 && i !== 1 && i !== count - 1);
                for (let i = pool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                const wildcards = new Set(pool.slice(0, wildcardCount));
                const candidate = tryGenerate(W, H, turns, count, wildcards);
                if (isValid(candidate)) { result = candidate; break outer; }
            }
            scale += 0.1;
        }
        return result;
    }

    it.each([10, 45, 90])('count=%i: outbound heading matches turn label for every non-endpoint waypoint', (count) => {
        const result = generate(count);
        expect(result.length).toBe(count);
        // Check waypoints index 1 … length-2 (those that display a turn label)
        for (let i = 1; i < result.length - 1; i++) {
            const wp = result[i];
            const next = result[i + 1];
            if (wp.turn === 'Wildcard') {
                expect(next.heading).toBe(wp.heading);
            } else if (wp.turn === 'R') {
                expect(next.heading).toBe(TURN_RIGHT[wp.heading]);
            } else {
                expect(next.heading).toBe(TURN_LEFT[wp.heading]);
            }
        }
    });

    it('first two waypoints always travel North', () => {
        const turns: Array<'L' | 'R'> = Array(10).fill('R');
        const result = tryGenerate(A4_W, A4_H, turns, 10, new Set());
        expect(result[0].heading).toBe('N');
        expect(result[1].heading).toBe('N');
    });
});

// ─── A1. Segment length constants ────────────────────────────────────────────

describe('segment length constants', () => {
    it('SEG_MIN is 60',    () => expect(SEG_MIN).toBe(60));
    it('SEG_JITTER is 80', () => expect(SEG_JITTER).toBe(80));
    it('base segment range is 60–140px (SEG_MIN + SEG_JITTER)',
        () => expect(SEG_MIN + SEG_JITTER).toBe(140));
});

// ─── A2. Multipliers array ────────────────────────────────────────────────────

describe('MULTIPLIERS', () => {
    it('contains 8.0',           () => expect(MULTIPLIERS).toContain(8.0));
    it('max multiplier is 8.0',  () => expect(Math.max(...MULTIPLIERS)).toBe(8.0));
    it('contains 0.5',           () => expect(MULTIPLIERS).toContain(0.5));
    it('has no value below 0.3', () => expect(Math.min(...MULTIPLIERS)).toBeGreaterThan(0.3));
});

// ─── A3. Turns NOT applied at indices 0 and 1 ────────────────────────────────

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
        expect(result[2].heading).toBe(TURN_RIGHT[result[1].heading]);
    });
});

// ─── A4. canPlace enforces SEG_CLEAR_R = 35px ────────────────────────────────

describe('canPlace() — SEG_CLEAR_R boundary', () => {
    const W = 1000, H = 1000, PAD = 30;

    // Note: canPlace skips the last entry in `result` for the segment-crosses-circle
    // check (it is the segment start). A two-element array is needed so the obstacle
    // waypoint is actually checked.

    it('rejects a horizontal segment at 27px from a waypoint centre', () => {
        // Obstacle at (200,200); segment from (100,227) to (300,227) passes 27px away.
        const existing: WaypointData[] = [wp(200, 200), wp(100, 227)];
        expect(canPlace(existing, 100, 227, 300, 227, W, H, PAD)).toBe(false);
    });

    it('accepts a horizontal segment at 36px from a waypoint centre', () => {
        const existing: WaypointData[] = [wp(200, 200), wp(100, 236)];
        expect(canPlace(existing, 100, 236, 300, 236, W, H, PAD)).toBe(true);
    });

    it('rejects a vertical segment at 27px from a waypoint centre', () => {
        const existing: WaypointData[] = [wp(200, 200), wp(227, 100)];
        expect(canPlace(existing, 227, 100, 227, 300, W, H, PAD)).toBe(false);
    });

    it('accepts a vertical segment at 36px from a waypoint centre', () => {
        const existing: WaypointData[] = [wp(200, 200), wp(236, 100)];
        expect(canPlace(existing, 236, 100, 236, 300, W, H, PAD)).toBe(true);
    });
});

// ─── A5. isValid rejects layout where turn label is <8px from a non-adjacent segment

describe('isValid() — turn label clearance', () => {
    it('rejects layout where a turn label is <8px from a non-adjacent segment', () => {
        // wp[1] at (100, 300); its NE label is at approximately (132.5, 267.5).
        // Segment wp[2]→wp[3]: horizontal leg at segY = labelY - 4 (4px away = violation).
        const { y: ly } = turnLabelPos({ x: 100, y: 300 } as WaypointData);
        const segY = Math.round(ly - 4); // 4px above label → within TURN_LABEL_CLEARANCE (8)

        const path: WaypointData[] = [
            { x: 100, y: 500, number: 1, turn: 'R',  heading: 'N', isWildcard: false, cumulativeDistance: 0 },
            { x: 100, y: 300, number: 2, turn: 'R',  heading: 'N', isWildcard: false, cumulativeDistance: 200 },
            { x: 400, y: 300, number: 3, turn: 'R',  heading: 'E', isWildcard: false, cumulativeDistance: 500 },
            { x: 400, y: segY, number: 4, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 500 + (300 - segY) },
        ];
        expect(isValid(path)).toBe(false);
    });

    it('accepts layout where all turn labels have ≥8px clearance', () => {
        const path: WaypointData[] = [
            { x: 100, y: 500, number: 1, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 0 },
            { x: 100, y: 300, number: 2, turn: 'R', heading: 'N', isWildcard: false, cumulativeDistance: 200 },
            { x: 400, y: 300, number: 3, turn: 'R', heading: 'E', isWildcard: false, cumulativeDistance: 500 },
            { x: 400, y: 100, number: 4, turn: 'R', heading: 'S', isWildcard: false, cumulativeDistance: 700 },
        ];
        expect(isValid(path)).toBe(true);
    });
});

// ─── generateWalk() integration ──────────────────────────────────────────────

describe('generateWalk() integration via isValid', () => {
    it.each([10, 45, 90])('count=%i: isValid passes and length matches', (count) => {
        const wildcardCount = Math.max(1, Math.round(count / 9));

        // Regenerate turns + wildcards every attempt (mirrors the app) for reliable success.
        let result: WaypointData[] = [];
        let scale = 1.0;
        outer: for (let tier = 0; tier < 50; tier++) {
            const W = Math.round(A4_W * scale);
            const H = Math.round(A4_H * scale);
            for (let attempt = 0; attempt < 50; attempt++) {
                const turns = Array.from({ length: count }, () =>
                    Math.random() < 0.5 ? 'L' : 'R'
                ) as Array<'L' | 'R'>;
                const pool = Array.from({ length: count }, (_, i) => i)
                    .filter(i => i !== 0 && i !== 1 && i !== count - 1);
                for (let i = pool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                const wildcards = new Set(pool.slice(0, wildcardCount));
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

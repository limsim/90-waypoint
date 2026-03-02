export interface WaypointData {
    x: number;
    y: number;
    number: number;
    turn: 'L' | 'R' | 'Wildcard';
    heading: Heading;
    cumulativeDistance: number;
    isWildcard: boolean;
}

export type Heading = 'N' | 'E' | 'S' | 'W';

export const HEADING_DELTA: Record<Heading, { dx: number; dy: number }> = {
    N: { dx: 0, dy: -1 },
    E: { dx: 1, dy: 0 },
    S: { dx: 0, dy: 1 },
    W: { dx: -1, dy: 0 },
};

export const TURN_LEFT: Record<Heading, Heading>  = { N: 'W', W: 'S', S: 'E', E: 'N' };
export const TURN_RIGHT: Record<Heading, Heading> = { N: 'E', E: 'S', S: 'W', W: 'N' };

// Minimum centre-to-centre distance before two circles visually overlap (diameter + 22px gap)
export const CIRCLE_SEP = 72;
// Waypoint circle radius
export const CIRCLE_R = 25;
// Minimum separation between parallel path lines (just above circle diameter)
export const LINE_SEP = 55;
// A4 portrait at 96 PPI
export const A4_W = 794;
export const A4_H = 1123;
// Attempts per canvas size tier before growing the canvas
export const ATTEMPTS_PER_SIZE = 50;
// How much to grow the canvas each tier (10% of A4 per step)
export const SCALE_STEP = 0.1;

// ─── Pure helper functions ────────────────────────────────────────────────────

export function overlaps(x: number, y: number, waypoints: WaypointData[]): boolean {
    return waypoints.some(w => Math.hypot(x - w.x, y - w.y) < CIRCLE_SEP);
}

export function inBounds(x: number, y: number, W: number, H: number, pad: number): boolean {
    return x >= pad && x <= W - pad && y >= pad && y <= H - pad;
}

/** Returns true if two axis-aligned segments are parallel, have overlapping range, and gap < LINE_SEP. */
export function segTooClose(
    ax1: number, ay1: number, ax2: number, ay2: number,
    bx1: number, by1: number, bx2: number, by2: number,
): boolean {
    if (ay1 === ay2 && by1 === by2) {
        const gap = Math.abs(ay1 - by1);
        if (gap > 0 && gap < LINE_SEP &&
            Math.min(ax1, ax2) <= Math.max(bx1, bx2) &&
            Math.max(ax1, ax2) >= Math.min(bx1, bx2)) return true;
    }
    if (ax1 === ax2 && bx1 === bx2) {
        const gap = Math.abs(ax1 - bx1);
        if (gap > 0 && gap < LINE_SEP &&
            Math.min(ay1, ay2) <= Math.max(by1, by2) &&
            Math.max(ay1, ay2) >= Math.min(by1, by2)) return true;
    }
    return false;
}

/**
 * Returns true if the L-shaped path from (ax1,ay1) to (ax2,ay2)
 * (horizontal leg first, then vertical) passes through the circle at (cx,cy) with radius r.
 */
export function segCrossesCircle(
    ax1: number, ay1: number, ax2: number, ay2: number,
    cx: number, cy: number, r: number,
): boolean {
    const hlo = Math.min(ax1, ax2), hhi = Math.max(ax1, ax2);
    const vlo = Math.min(ay1, ay2), vhi = Math.max(ay1, ay2);
    // Horizontal leg: y = ay1, x ∈ [hlo, hhi]
    if (Math.abs(cy - ay1) < r && cx >= hlo && cx <= hhi) return true;
    // Vertical leg: x = ax2, y ∈ [vlo, vhi]
    if (Math.abs(cx - ax2) < r && cy >= vlo && cy <= vhi) return true;
    return false;
}

// ─── Generation ──────────────────────────────────────────────────────────────

export function tryGenerate(
    W: number, H: number,
    turnSequence: ('L' | 'R')[],
    count: number,
    wildcardIndices: Set<number>,
): WaypointData[] {
    const padding = 30;
    const minDist = 60;

    let x = W / 2;
    let y = H / 2;
    let heading: Heading = 'N';
    let cumDist = 0;
    const result: WaypointData[] = [];

    // Local wrappers that check new segment/position against result built so far
    const checkTooClose = (sx: number, sy: number, ex: number, ey: number): boolean => {
        for (let j = 0; j < result.length - 1; j++) {
            if (segTooClose(sx, sy, ex, ey, result[j].x, result[j].y, result[j + 1].x, result[j + 1].y)) return true;
        }
        return false;
    };

    const checkCrossesCircle = (sx: number, sy: number, ex: number, ey: number): boolean => {
        const lastIdx = result.length - 1; // segment start — skip this one
        for (let k = 0; k < lastIdx; k++) {
            if (segCrossesCircle(sx, sy, ex, ey, result[k].x, result[k].y, CIRCLE_R)) return true;
        }
        return false;
    };

    for (let i = 0; i < count; i++) {
        const isWildcard = wildcardIndices.has(i);
        let turn: 'L' | 'R' | 'Wildcard';

        if (isWildcard) {
            turn = 'Wildcard';
        } else {
            const t = turnSequence[i];
            if (i > 1) heading = t === 'L' ? TURN_LEFT[heading] : TURN_RIGHT[heading];
            turn = t;
        }

        const segLen = minDist + Math.random() * 80;

        // Prescribed heading first, then the other three. For each heading try a range
        // of segment length multipliers — path lines can be any length to satisfy spacing.
        const candidates: Heading[] = [
            heading,
            ...(['N', 'E', 'S', 'W'] as Heading[]).filter(h => h !== heading),
        ];
        const multipliers = [1.0, 1.5, 2.0, 0.75, 2.5, 0.5, 3.0, 4.0, 0.33, 5.0, 6.0, 7.0, 8.0];

        let placed = false;
        outer: for (const h of candidates) {
            for (const mult of multipliers) {
                const { dx, dy } = HEADING_DELTA[h];
                const len = segLen * mult;
                if (len < CIRCLE_SEP) continue; // segment too short — circles would overlap
                const nx = x + dx * len;
                const ny = y + dy * len;
                if (inBounds(nx, ny, W, H, padding) &&
                    !overlaps(nx, ny, result) &&
                    !checkTooClose(x, y, nx, ny) &&
                    !checkCrossesCircle(x, y, nx, ny)) {
                    x = nx;
                    y = ny;
                    heading = h;
                    placed = true;
                    break outer;
                }
            }
        }

        if (!placed) {
            // Last resort: pick the heading that maximises clearance from existing waypoints
            let bestClearance = -1;
            for (const h of candidates) {
                const { dx, dy } = HEADING_DELTA[h];
                const nx = Math.max(padding, Math.min(W - padding, x + dx * segLen));
                const ny = Math.max(padding, Math.min(H - padding, y + dy * segLen));
                const clearance = result.length > 0
                    ? Math.min(...result.map(w => Math.hypot(nx - w.x, ny - w.y)))
                    : Infinity;
                if (clearance > bestClearance) {
                    bestClearance = clearance;
                    x = nx;
                    y = ny;
                    heading = h;
                }
            }
        }

        cumDist += segLen;
        result.push({ x, y, number: i + 1, turn, heading, cumulativeDistance: Math.round(cumDist), isWildcard });
    }

    // Shift turns so each waypoint records the outbound turn (the turn made when
    // leaving that waypoint to reach the next), not the inbound turn used to arrive.
    for (let i = 0; i < result.length - 1; i++) {
        result[i].turn = result[i + 1].turn;
        result[i].isWildcard = result[i + 1].isWildcard;
    }
    // Last waypoint has no outbound turn — keep the field but it won't be displayed.

    return result;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function isValid(waypoints: WaypointData[]): boolean {
    // No two waypoint circles may overlap
    for (let i = 0; i < waypoints.length; i++) {
        for (let j = i + 1; j < waypoints.length; j++) {
            if (Math.hypot(waypoints[i].x - waypoints[j].x, waypoints[i].y - waypoints[j].y) < CIRCLE_SEP) {
                return false;
            }
        }
    }

    // No two parallel segments with overlapping range may be closer than LINE_SEP
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i], b = waypoints[i + 1];
        for (let j = 0; j < i - 1; j++) {
            const c = waypoints[j], d = waypoints[j + 1];
            if (segTooClose(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) return false;
        }
    }

    // No L-shaped segment may pass through the circle of a non-adjacent waypoint
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i], b = waypoints[i + 1];
        for (let k = 0; k < waypoints.length; k++) {
            if (k === i || k === i + 1) continue;
            if (segCrossesCircle(a.x, a.y, b.x, b.y, waypoints[k].x, waypoints[k].y, CIRCLE_R)) return false;
        }
    }

    return true;
}

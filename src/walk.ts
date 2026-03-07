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
export const ATTEMPTS_PER_SIZE = 200;
// How much to grow the canvas each tier (10% of A4 per step)
export const SCALE_STEP = 0.1;
// Distance from waypoint centre to the fixed NE turn label position.
// Must clear the wildcard ring outer edge (r + 5 + 1.5px stroke = ~31.5px) with comfortable gap.
export const TURN_LABEL_OFFSET = 46;
// Minimum clearance from the turn label to any non-adjacent path segment
export const TURN_LABEL_CLEARANCE = 8;

// ─── Pure helper functions ────────────────────────────────────────────────────

/** Minimum distance from point (px,py) to an axis-aligned segment (ax,ay)-(bx,by). */
export function pointToSegDist(
    px: number, py: number,
    ax: number, ay: number, bx: number, by: number,
): number {
    if (ax === bx) {
        const lo = Math.min(ay, by), hi = Math.max(ay, by);
        return Math.hypot(px - ax, py - Math.max(lo, Math.min(hi, py)));
    }
    const lo = Math.min(ax, bx), hi = Math.max(ax, bx);
    return Math.hypot(px - Math.max(lo, Math.min(hi, px)), py - ay);
}

/** Returns the two axis-aligned legs of the L-shaped path between waypoints a and b. */
function segLegs(
    a: WaypointData,
    b: WaypointData,
): [[number, number, number, number], [number, number, number, number]] {
    const horizFirst = a.turn === 'R' ||
        (a.turn === 'Wildcard' && (b.heading === 'E' || b.heading === 'W'));
    return horizFirst
        ? [[a.x, a.y, b.x, a.y], [b.x, a.y, b.x, b.y]]
        : [[a.x, a.y, a.x, b.y], [a.x, b.y, b.x, b.y]];
}

/** Minimum distance from (lx,ly) to all path segments except those adjacent to wpIdx. */
function labelDistToPath(lx: number, ly: number, wpIdx: number, waypoints: WaypointData[]): number {
    let min = Infinity;
    for (let i = 0; i < waypoints.length - 1; i++) {
        if (i === wpIdx - 1 || i === wpIdx) continue;
        const [[ax1, ay1, ax2, ay2], [bx1, by1, bx2, by2]] = segLegs(waypoints[i], waypoints[i + 1]);
        min = Math.min(min,
            pointToSegDist(lx, ly, ax1, ay1, ax2, ay2),
            pointToSegDist(lx, ly, bx1, by1, bx2, by2),
        );
    }
    return min;
}

/** Returns the fixed NE turn label position for a waypoint. */
export function turnLabelPos(
    wp: WaypointData,
    offset: number = TURN_LABEL_OFFSET,
): { x: number; y: number } {
    return { x: wp.x + offset * 0.707, y: wp.y - offset * 0.707 };
}

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

    // Check that old segments don't pass through the circle at the new waypoint position.
    const checkOldSegsAtNewCircle = (px: number, py: number): boolean => {
        for (let j = 0; j < result.length - 1; j++) {
            if (pointToSegDist(px, py, result[j].x, result[j].y, result[j + 1].x, result[j + 1].y) < CIRCLE_R) return true;
        }
        return false;
    };

    // Check new straight segment against all existing waypoints' label zones.
    const checkLabelZones = (sx: number, sy: number, ex: number, ey: number): boolean => {
        for (let k = 1; k < result.length; k++) { // skip k=0 (waypoint 1 has no label)
            const { x: lx, y: ly } = turnLabelPos(result[k]);
            if (pointToSegDist(lx, ly, sx, sy, ex, ey) < TURN_LABEL_CLEARANCE) return true;
        }
        return false;
    };

    // Check that the new waypoint's own label has clearance from all existing (non-adjacent) segments.
    // Adjacent segments (the new segment itself) are not yet in result, so all result segments qualify.
    const checkNewLabelVsOldSegs = (px: number, py: number): boolean => {
        const { x: lx, y: ly } = turnLabelPos({ x: px, y: py } as WaypointData);
        for (let j = 0; j < result.length - 1; j++) {
            if (pointToSegDist(lx, ly, result[j].x, result[j].y, result[j + 1].x, result[j + 1].y) < TURN_LABEL_CLEARANCE) return true;
        }
        return false;
    };

    for (let i = 0; i < count; i++) {
        const isWildcard = wildcardIndices.has(i);
        let turn: 'L' | 'R' | 'Wildcard';

        // Candidate headings: for non-wildcard steps (i > 1), try the intended turn first,
        // then the opposite turn as fallback. The label is updated to match whichever
        // heading actually succeeds, so it always matches the path direction.
        const origHeading = heading; // heading arriving at this step (before any turn)
        const candidateHeadings: Heading[] = [];
        if (isWildcard) {
            turn = 'Wildcard';
            candidateHeadings.push(heading); // wildcards always go straight
        } else {
            const t = turnSequence[i];
            turn = t;
            if (i > 1) {
                candidateHeadings.push(t === 'L' ? TURN_LEFT[heading] : TURN_RIGHT[heading]); // intended
                candidateHeadings.push(t === 'L' ? TURN_RIGHT[heading] : TURN_LEFT[heading]); // fallback
            } else {
                candidateHeadings.push(heading); // i=0,1: no turn applied
            }
        }

        const segLen = minDist + Math.random() * 80;
        const multipliers = [1.0, 1.5, 2.0, 0.75, 2.5, 0.5, 3.0, 4.0, 0.33, 5.0, 6.0, 7.0, 8.0];

        for (const candidateHeading of candidateHeadings) {
            const { dx, dy } = HEADING_DELTA[candidateHeading];
            let placed = false;
            for (const mult of multipliers) {
                const len = segLen * mult;
                if (len < CIRCLE_SEP) continue; // segment too short — circles would overlap
                const nx = x + dx * len;
                const ny = y + dy * len;
                if (inBounds(nx, ny, W, H, padding) &&
                    !overlaps(nx, ny, result) &&
                    !checkTooClose(x, y, nx, ny) &&
                    !checkCrossesCircle(x, y, nx, ny) &&
                    !checkOldSegsAtNewCircle(nx, ny) &&
                    !checkLabelZones(x, y, nx, ny) &&
                    !checkNewLabelVsOldSegs(nx, ny)) {
                    x = nx;
                    y = ny;
                    heading = candidateHeading;
                    // Update turn label to reflect the actual heading taken
                    if (!isWildcard && i > 1) {
                        turn = candidateHeading === TURN_LEFT[origHeading] ? 'L' : 'R';
                    }
                    placed = true;
                    break;
                }
            }
            if (placed) break;
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

    // Fixed NE turn labels must have comfortable clearance from non-adjacent path segments
    for (let i = 1; i < waypoints.length - 1; i++) {
        const { x, y } = turnLabelPos(waypoints[i]);
        if (labelDistToPath(x, y, i, waypoints) < TURN_LABEL_CLEARANCE) return false;
    }

    // Each waypoint's outbound turn label must match the actual heading to the next waypoint.
    // Waypoint 1 (index 0) has no displayed turn label — skip it.
    for (let i = 1; i < waypoints.length - 1; i++) {
        const wp = waypoints[i];
        const next = waypoints[i + 1];
        if (wp.turn === 'Wildcard') {
            if (next.heading !== wp.heading) return false;
        } else if (wp.turn === 'R') {
            if (next.heading !== TURN_RIGHT[wp.heading]) return false;
        } else {
            if (next.heading !== TURN_LEFT[wp.heading]) return false;
        }
    }

    return true;
}

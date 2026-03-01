interface WaypointData {
    x: number;
    y: number;
    number: number;
    turn: 'L' | 'R' | 'Wildcard';
    cumulativeDistance: number;
    isWildcard: boolean;
}

type Heading = 'N' | 'E' | 'S' | 'W';

// Fixed 90-turn sequence from the original Munich walk
const TURN_SEQUENCE: ReadonlyArray<'L' | 'R'> = [
    'R','L','R','R','L','R','L','L','R','L',
    'R','R','L','L','R','L','R','L','R','R',
    'L','R','L','R','L','L','R','R','L','R',
    'L','L','R','L','R','R','L','R','L','L',
    'R','L','R','L','R','R','L','L','R','R',
    'L','R','R','L','R','L','L','R','L','R',
    'R','L','L','R','R','L','R','L','R','L',
    'L','R','L','R','R','L','L','R','L','R',
    'R','L','R','L','L','R','R','L','R','L',
];

// Wildcard positions (0-based): walker goes straight instead of turning
const WILDCARD_INDICES = new Set<number>([8, 17, 26, 35, 44, 53, 62, 71, 80, 89]);

const HEADING_DELTA: Record<Heading, { dx: number; dy: number }> = {
    N: { dx: 0, dy: -1 },
    E: { dx: 1, dy: 0 },
    S: { dx: 0, dy: 1 },
    W: { dx: -1, dy: 0 },
};

const TURN_LEFT: Record<Heading, Heading>  = { N: 'W', W: 'S', S: 'E', E: 'N' };
const TURN_RIGHT: Record<Heading, Heading> = { N: 'E', E: 'S', S: 'W', W: 'N' };

// Minimum centre-to-centre distance before two circles visually overlap (diameter + 2px buffer)
const CIRCLE_SEP = 52;
// Minimum separation between parallel path lines (just above circle diameter)
const LINE_SEP = 55;
// Padding around the bounding box when fitting canvas to path
const CANVAS_PAD = 100;
// Large virtual workspace used during generation so the path isn't constrained to screen size
const VIRTUAL_SIZE = 4000;
// How many generation attempts to make before declaring failure
const MAX_ATTEMPTS = 300;

export class WaypointApp {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private waypoints: WaypointData[] = [];
    private minDistanceSlider: HTMLInputElement;
    private distanceValueSpan: HTMLSpanElement;
    private showWildcardsCheckbox: HTMLInputElement;
    private tooltip: HTMLDivElement;
    private hoveredIndex: number = -1;

    constructor() {
        this.canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.minDistanceSlider = document.getElementById('minDistanceSlider') as HTMLInputElement;
        this.distanceValueSpan = document.getElementById('distanceValue') as HTMLSpanElement;
        this.showWildcardsCheckbox = document.getElementById('showWildcards') as HTMLInputElement;
        this.tooltip = document.getElementById('tooltip') as HTMLDivElement;
        this.setupEventListeners();
        this.generateWalk();
    }

    // ─── Public entry point ──────────────────────────────────────────────────

    generateWalk(): void {
        let waypoints: WaypointData[] | null = null;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const candidate = this.tryGenerate();
            if (this.isValid(candidate)) {
                waypoints = candidate;
                break;
            }
        }

        if (!waypoints) {
            // All attempts exhausted without meeting the criteria.
            // Per requirements: only render when criteria are met — show an error instead.
            this.waypoints = [];
            this.hoveredIndex = -1;
            this.hideTooltip();
            this.drawGenerationError();
            return;
        }

        this.fitCanvasToPath(waypoints);
        this.waypoints = waypoints;
        this.hoveredIndex = -1;
        this.hideTooltip();
        this.drawCanvas();
    }

    // ─── Generation ──────────────────────────────────────────────────────────

    private tryGenerate(): WaypointData[] {
        const padding = 30;
        const minDist = this.getMinDistance();
        const W = VIRTUAL_SIZE;
        const H = VIRTUAL_SIZE;

        let x = W / 2;
        let y = H / 2;
        let heading: Heading = 'N';
        let cumDist = 0;
        const result: WaypointData[] = [];

        for (let i = 0; i < 90; i++) {
            const isWildcard = WILDCARD_INDICES.has(i);
            let turn: 'L' | 'R' | 'Wildcard';

            if (isWildcard) {
                turn = 'Wildcard';
            } else {
                const t = TURN_SEQUENCE[i];
                heading = t === 'L' ? TURN_LEFT[heading] : TURN_RIGHT[heading];
                turn = t;
            }

            const segLen = minDist + Math.random() * 80;

            const overlaps = (nx: number, ny: number): boolean =>
                result.some(w => Math.hypot(nx - w.x, ny - w.y) < CIRCLE_SEP);

            const inBounds = (nx: number, ny: number): boolean =>
                nx >= padding && nx <= W - padding && ny >= padding && ny <= H - padding;

            const segTooClose = (sx: number, sy: number, ex: number, ey: number): boolean => {
                const isH = sy === ey;
                const isV = sx === ex;
                for (let j = 0; j < result.length - 1; j++) {
                    const a = result[j];
                    const b = result[j + 1];
                    if (isH && a.y === b.y) {
                        const gap = Math.abs(sy - a.y);
                        if (gap > 0 && gap < LINE_SEP) {
                            if (Math.min(sx, ex) <= Math.max(a.x, b.x) &&
                                Math.max(sx, ex) >= Math.min(a.x, b.x)) return true;
                        }
                    }
                    if (isV && a.x === b.x) {
                        const gap = Math.abs(sx - a.x);
                        if (gap > 0 && gap < LINE_SEP) {
                            if (Math.min(sy, ey) <= Math.max(a.y, b.y) &&
                                Math.max(sy, ey) >= Math.min(a.y, b.y)) return true;
                        }
                    }
                }
                return false;
            };

            // Prescribed heading first, then the other three. For each heading try a range
            // of segment length multipliers — path lines can be any length to satisfy spacing.
            const candidates: Heading[] = [
                heading,
                ...(['N', 'E', 'S', 'W'] as Heading[]).filter(h => h !== heading),
            ];
            const multipliers = [1.0, 1.5, 2.0, 0.75, 2.5, 0.5, 3.0, 4.0, 0.33, 5.0];

            let placed = false;
            outer: for (const h of candidates) {
                for (const mult of multipliers) {
                    const { dx, dy } = HEADING_DELTA[h];
                    const len = segLen * mult;
                    if (len < CIRCLE_SEP) continue; // segment too short — circles would overlap
                    const nx = x + dx * len;
                    const ny = y + dy * len;
                    if (inBounds(nx, ny) && !overlaps(nx, ny) && !segTooClose(x, y, nx, ny)) {
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
            result.push({ x, y, number: i + 1, turn, cumulativeDistance: Math.round(cumDist), isWildcard });
        }

        return result;
    }

    // ─── Validation ──────────────────────────────────────────────────────────

    private isValid(waypoints: WaypointData[]): boolean {
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
            const a = waypoints[i];
            const b = waypoints[i + 1];
            for (let j = 0; j < i - 1; j++) {
                const c = waypoints[j];
                const d = waypoints[j + 1];
                if (a.y === b.y && c.y === d.y) {
                    const gap = Math.abs(a.y - c.y);
                    if (gap > 0 && gap < LINE_SEP &&
                        Math.min(a.x, b.x) <= Math.max(c.x, d.x) &&
                        Math.max(a.x, b.x) >= Math.min(c.x, d.x)) return false;
                }
                if (a.x === b.x && c.x === d.x) {
                    const gap = Math.abs(a.x - c.x);
                    if (gap > 0 && gap < LINE_SEP &&
                        Math.min(a.y, b.y) <= Math.max(c.y, d.y) &&
                        Math.max(a.y, b.y) >= Math.min(c.y, d.y)) return false;
                }
            }
        }

        return true;
    }

    // ─── Canvas sizing ───────────────────────────────────────────────────────

    private fitCanvasToPath(waypoints: WaypointData[]): void {
        const xs = waypoints.map(w => w.x);
        const ys = waypoints.map(w => w.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        // Translate all waypoints so the path sits inside CANVAS_PAD on each side
        const ox = CANVAS_PAD - minX;
        const oy = CANVAS_PAD - minY;
        for (const w of waypoints) { w.x += ox; w.y += oy; }

        // Resize the canvas logical resolution to fit the path exactly
        this.canvas.width  = Math.round(maxX - minX + CANVAS_PAD * 2);
        this.canvas.height = Math.round(maxY - minY + CANVAS_PAD * 2);

        this.updateDisplaySize();
    }

    private updateDisplaySize(): void {
        const maxW = window.innerWidth - 40;
        if (this.canvas.width > maxW) {
            const scale = maxW / this.canvas.width;
            this.canvas.style.width  = `${maxW}px`;
            this.canvas.style.height = `${Math.round(this.canvas.height * scale)}px`;
        } else {
            this.canvas.style.width  = `${this.canvas.width}px`;
            this.canvas.style.height = `${this.canvas.height}px`;
        }
    }

    // ─── Rendering ───────────────────────────────────────────────────────────

    private drawGenerationError(): void {
        this.canvas.width  = 500;
        this.canvas.height = 160;
        this.updateDisplaySize();
        const ctx = this.ctx;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#555';
        ctx.font = '15px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Could not generate a valid walk after ' + MAX_ATTEMPTS + ' attempts.', 250, 65);
        ctx.fillText('Try again, or reduce the minimum distance.', 250, 95);
    }

    drawCanvas(): void {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (this.waypoints.length === 0) return;
        this.drawGrid();
        this.drawPathLines();
        this.drawWaypoints();
    }

    private drawGrid(): void {
        const wps = this.waypoints;
        const pad = 100;
        const cell = this.getMinDistance();
        const minX = Math.max(0, Math.min(...wps.map(w => w.x)) - pad);
        const maxX = Math.min(this.canvas.width,  Math.max(...wps.map(w => w.x)) + pad);
        const minY = Math.max(0, Math.min(...wps.map(w => w.y)) - pad);
        const maxY = Math.min(this.canvas.height, Math.max(...wps.map(w => w.y)) + pad);

        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;

        for (let x = Math.floor(minX / cell) * cell; x <= maxX; x += cell) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, minY);
            this.ctx.lineTo(x, maxY);
            this.ctx.stroke();
        }
        for (let y = Math.floor(minY / cell) * cell; y <= maxY; y += cell) {
            this.ctx.beginPath();
            this.ctx.moveTo(minX, y);
            this.ctx.lineTo(maxX, y);
            this.ctx.stroke();
        }
    }

    private drawPathLines(): void {
        if (this.waypoints.length < 2) return;
        const ctx = this.ctx;

        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const a = this.waypoints[i];
            const b = this.waypoints[i + 1];
            const hovered = i === this.hoveredIndex || i + 1 === this.hoveredIndex;

            ctx.strokeStyle = hovered ? '#555' : '#222';
            ctx.lineWidth = hovered ? 4 : 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, a.y); // horizontal first
            ctx.lineTo(b.x, b.y); // then vertical
            ctx.stroke();
        }
    }

    private drawWaypoints(): void {
        const showWildcards = this.showWildcardsCheckbox.checked;
        this.waypoints.forEach((wp, i) => this.drawWaypoint(wp, i === this.hoveredIndex, showWildcards));
    }

    private drawWaypoint(wp: WaypointData, isHovered: boolean, showWildcards: boolean): void {
        const ctx = this.ctx;
        const r = 25;
        const isEndpoint = wp.number === 1 || wp.number === 90;

        if (isHovered) {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 10;
        }

        ctx.beginPath();
        ctx.arc(wp.x, wp.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isEndpoint ? '#000' : '#fff';
        ctx.fill();
        ctx.strokeStyle = isEndpoint ? '#fff' : '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isHovered) ctx.restore();

        if (wp.isWildcard && showWildcards) {
            ctx.beginPath();
            ctx.arc(wp.x, wp.y, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#f5a623';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.fillStyle = isEndpoint ? '#fff' : '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(wp.number), wp.x, wp.y);
    }

    // ─── Event handling ───────────────────────────────────────────────────────

    setupEventListeners(): void {
        document.getElementById('generateBtn')!.addEventListener('click', () => this.generateWalk());

        document.getElementById('clearBtn')!.addEventListener('click', () => {
            this.waypoints = [];
            this.hoveredIndex = -1;
            this.hideTooltip();
            this.drawCanvas();
        });

        this.minDistanceSlider.addEventListener('input', () => {
            this.distanceValueSpan.textContent = `${this.minDistanceSlider.value}px`;
        });

        this.showWildcardsCheckbox.addEventListener('change', () => this.drawCanvas());

        window.addEventListener('resize', () => this.updateDisplaySize());

        this.canvas.addEventListener('mousemove', (e) => {
            const { x, y } = this.toCanvasCoords(e);
            const idx = this.hitTest(x, y);
            if (idx !== this.hoveredIndex) {
                this.hoveredIndex = idx;
                this.canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
                this.drawCanvas();
            }
        });

        this.canvas.addEventListener('click', (e) => {
            const { x, y } = this.toCanvasCoords(e);
            const idx = this.hitTest(x, y);
            if (idx >= 0) {
                this.showTooltip(e, this.waypoints[idx]);
            } else {
                this.hideTooltip();
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredIndex = -1;
            this.canvas.style.cursor = 'default';
            this.drawCanvas();
        });
    }

    private toCanvasCoords(e: MouseEvent): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
        };
    }

    private hitTest(x: number, y: number): number {
        for (let i = this.waypoints.length - 1; i >= 0; i--) {
            const w = this.waypoints[i];
            if (Math.hypot(x - w.x, y - w.y) <= 25) return i;
        }
        return -1;
    }

    private showTooltip(e: MouseEvent, wp: WaypointData): void {
        const wRect = this.canvas.parentElement!.getBoundingClientRect();
        this.tooltip.innerHTML =
            `<strong>Waypoint #${wp.number}</strong><br>Turn: ${wp.turn}<br>Distance from start: ${wp.cumulativeDistance}px`;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${e.clientX - wRect.left + 14}px`;
        this.tooltip.style.top = `${e.clientY - wRect.top - 14}px`;
    }

    private hideTooltip(): void {
        this.tooltip.style.display = 'none';
    }

    private getMinDistance(): number {
        return parseInt(this.minDistanceSlider.value, 10);
    }
}

new WaypointApp();

import {
    WaypointData, Heading,
    HEADING_DELTA, TURN_LEFT, TURN_RIGHT,
    CIRCLE_R, A4_W, A4_H, ATTEMPTS_PER_SIZE, SCALE_STEP,
    tryGenerate, isValid, turnLabelPos,
} from './walk.js';

export class WaypointApp {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private waypoints: WaypointData[] = [];
    private waypointCountInput: HTMLInputElement;
    private showWildcardsCheckbox: HTMLInputElement;
    private showTurnsCheckbox: HTMLInputElement;
    private tooltip: HTMLDivElement;
    private hoveredIndex: number = -1;

    constructor() {
        this.canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.waypointCountInput = document.getElementById('waypointCount') as HTMLInputElement;
        this.showWildcardsCheckbox = document.getElementById('showWildcards') as HTMLInputElement;
        this.showTurnsCheckbox = document.getElementById('showTurns') as HTMLInputElement;
        this.tooltip = document.getElementById('tooltip') as HTMLDivElement;
        this.updateDisplaySize();
        this.setupEventListeners();
        this.generateWalk();
    }

    // ─── Public entry point ──────────────────────────────────────────────────

    generateWalk(): void {
        let waypoints: WaypointData[] | null = null;
        let scale = 1.0;
        const count = Math.min(90, Math.max(10, parseInt(this.waypointCountInput.value, 10) || 90));
        const turnSequence = Array.from({ length: count }, () => Math.random() < 0.5 ? 'L' : 'R') as ('L' | 'R')[];
        const wildcardCount = Math.max(1, Math.round(count / 9));
        const shuffled = Array.from({ length: count - 3 }, (_, i) => i + 2);
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const wildcardIndices = new Set(shuffled.slice(0, wildcardCount));

        while (!waypoints) {
            const W = Math.round(A4_W * scale);
            const H = Math.round(A4_H * scale);

            for (let attempt = 0; attempt < ATTEMPTS_PER_SIZE; attempt++) {
                const candidate = tryGenerate(W, H, turnSequence, count, wildcardIndices);
                if (isValid(candidate)) {
                    waypoints = candidate;
                    break;
                }
            }

            if (!waypoints) {
                scale += SCALE_STEP;
            }
        }

        // Resize canvas to tightly fit the walk (100px padding matches grid padding)
        const pad = 100;
        const xs = waypoints.map(w => w.x);
        const ys = waypoints.map(w => w.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        this.canvas.width  = Math.round(maxX - minX + 2 * pad);
        this.canvas.height = Math.round(maxY - minY + 2 * pad);
        this.updateDisplaySize();

        // Offset waypoints to sit within the padded bounds
        const ox = pad - minX;
        const oy = pad - minY;
        for (const w of waypoints) { w.x += ox; w.y += oy; }

        this.waypoints = waypoints;
        this.hoveredIndex = -1;
        this.hideTooltip();
        this.drawCanvas();
    }

    // ─── Canvas sizing ───────────────────────────────────────────────────────

    private updateDisplaySize(): void {
        const maxW = window.innerWidth - 40;
        if (this.canvas.width > maxW) {
            this.canvas.style.width  = `${maxW}px`;
            this.canvas.style.height = `${Math.round(this.canvas.height * maxW / this.canvas.width)}px`;
        } else {
            this.canvas.style.width  = `${this.canvas.width}px`;
            this.canvas.style.height = `${this.canvas.height}px`;
        }
    }

    // ─── Rendering ───────────────────────────────────────────────────────────

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
        const cell = 60;
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
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    }

    private drawWaypoints(): void {
        const showWildcards = this.showWildcardsCheckbox.checked;
        const showTurns = this.showTurnsCheckbox.checked;
        this.waypoints.forEach((wp, i) => this.drawWaypoint(wp, i, i === this.hoveredIndex, showWildcards, showTurns));
    }

    private drawWaypoint(wp: WaypointData, index: number, isHovered: boolean, showWildcards: boolean, showTurns: boolean): void {
        const ctx = this.ctx;
        const r = 25;
        const isEndpoint = wp.number === 1 || wp.number === this.waypoints.length;

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

        if (showTurns && wp.number !== 1 && wp.number !== this.waypoints.length) {
            const label = wp.turn === 'Wildcard' ? 'W' : wp.turn;
            const { x: lx, y: ly } = turnLabelPos(wp);
            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = wp.turn === 'Wildcard' ? '#f5a623' : '#e00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, lx, ly);
        }
    }

    // ─── Event handling ───────────────────────────────────────────────────────

    setupEventListeners(): void {
        document.getElementById('generateBtn')!.addEventListener('click', () => this.generateWalk());
        document.getElementById('printBtn')!.addEventListener('click', () => window.print());

        document.getElementById('clearBtn')!.addEventListener('click', () => {
            this.waypoints = [];
            this.hoveredIndex = -1;
            this.hideTooltip();
            this.canvas.width  = A4_W;
            this.canvas.height = A4_H;
            this.updateDisplaySize();
            this.drawCanvas();
        });

        this.showWildcardsCheckbox.addEventListener('change', () => this.drawCanvas());
        this.showTurnsCheckbox.addEventListener('change', () => this.drawCanvas());

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

}

new WaypointApp();

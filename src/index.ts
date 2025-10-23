interface Waypoint {
    x: number;
    y: number;
    number: number;
}

class WaypointApp {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private waypoints: Waypoint[] = [];
    private waypointCounter: number = 1;
    private minDistanceSlider: HTMLInputElement;
    private distanceValueSpan: HTMLSpanElement;

    constructor() {
        this.canvas = document.getElementById('waypointCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.minDistanceSlider = document.getElementById('minDistanceSlider') as HTMLInputElement;
        this.distanceValueSpan = document.getElementById('distanceValue') as HTMLSpanElement;
        this.setupEventListeners();
        this.autoGenerateWaypoints(); // Auto-generate 20 waypoints on startup
    }

    private setupEventListeners(): void {
        const addButton = document.getElementById('addWaypoint') as HTMLButtonElement;
        const regenerateButton = document.getElementById('regenerateWaypoints') as HTMLButtonElement;
        const clearButton = document.getElementById('clearWaypoints') as HTMLButtonElement;
        
        addButton.addEventListener('click', () => this.addWaypoint());
        regenerateButton.addEventListener('click', () => this.autoGenerateWaypoints());
        clearButton.addEventListener('click', () => this.clearWaypoints());
        
        // Add click listener to canvas for interactive waypoint placement
        this.canvas.addEventListener('click', (event: MouseEvent) => this.handleCanvasClick(event));
        
        // Add slider event listener for minimum distance
        this.minDistanceSlider.addEventListener('input', () => this.updateDistanceValue());
    }

    private handleCanvasClick(event: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.addWaypointAtCardinal(x, y);
    }

    private updateDistanceValue(): void {
        const value = this.minDistanceSlider.value;
        this.distanceValueSpan.textContent = `${value}px`;
    }

    private getMinDistance(): number {
        return parseInt(this.minDistanceSlider.value);
    }

    private addWaypoint(): void {
        if (this.waypoints.length === 0) {
            // First waypoint can be placed anywhere
            const x = Math.random() * (this.canvas.width - 60) + 30;
            const y = Math.random() * (this.canvas.height - 60) + 30;
            this.addWaypointAt(x, y);
        } else {
            // Subsequent waypoints must be in cardinal directions
            this.addRandomCardinalWaypoint();
        }
    }

    private addWaypointAt(x: number, y: number): void {
        // Check if this position would overlap with any existing waypoint
        if (this.wouldOverlap(x, y)) {
            return; // Don't add waypoint if it would overlap
        }

        const waypoint: Waypoint = {
            x: x,
            y: y,
            number: this.waypointCounter++
        };
        this.waypoints.push(waypoint);
        this.drawCanvas();
    }

    private wouldOverlap(x: number, y: number): boolean {
        const minDistance = this.getMinDistance(); // Use configurable minimum distance
        
        return this.waypoints.some(waypoint => {
            const distance = Math.sqrt(Math.pow(x - waypoint.x, 2) + Math.pow(y - waypoint.y, 2));
            return distance < minDistance;
        });
    }

    private addWaypointAtCardinal(clickX: number, clickY: number): void {
        if (this.waypoints.length === 0) {
            // First waypoint can be placed anywhere
            this.addWaypointAt(clickX, clickY);
            return;
        }

        const lastWaypoint = this.waypoints[this.waypoints.length - 1];
        const minDistance = this.getMinDistance();
        const maxDistance = minDistance + 80; // Keep max distance relative to min distance
        const distance = Math.random() * (maxDistance - minDistance) + minDistance;
        
        // Calculate which cardinal direction the click is closest to
        const deltaX = clickX - lastWaypoint.x;
        const deltaY = clickY - lastWaypoint.y;
        
        // Determine the closest cardinal direction
        let preferredDirection: { x: number, y: number };
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal movement (East or West)
            const newX = deltaX > 0 ? lastWaypoint.x + distance : lastWaypoint.x - distance;
            preferredDirection = { x: newX, y: lastWaypoint.y };
        } else {
            // Vertical movement (North or South)
            const newY = deltaY > 0 ? lastWaypoint.y + distance : lastWaypoint.y - distance;
            preferredDirection = { x: lastWaypoint.x, y: newY };
        }
        
        // Ensure the preferred direction stays within canvas bounds
        preferredDirection.x = Math.max(30, Math.min(this.canvas.width - 30, preferredDirection.x));
        preferredDirection.y = Math.max(30, Math.min(this.canvas.height - 30, preferredDirection.y));
        
        // Try the preferred direction first
        if (!this.wouldOverlap(preferredDirection.x, preferredDirection.y)) {
            this.addWaypointAt(preferredDirection.x, preferredDirection.y);
            return;
        }
        
        // If preferred direction would overlap, try other cardinal directions
        const allDirections = [
            { x: lastWaypoint.x, y: lastWaypoint.y - distance }, // North
            { x: lastWaypoint.x, y: lastWaypoint.y + distance }, // South
            { x: lastWaypoint.x + distance, y: lastWaypoint.y }, // East
            { x: lastWaypoint.x - distance, y: lastWaypoint.y }  // West
        ];
        
        // Filter valid directions (within bounds and no overlap)
        const validDirections = allDirections.filter(dir => {
            const boundedX = Math.max(30, Math.min(this.canvas.width - 30, dir.x));
            const boundedY = Math.max(30, Math.min(this.canvas.height - 30, dir.y));
            return !this.wouldOverlap(boundedX, boundedY);
        });
        
        if (validDirections.length > 0) {
            // Use the first valid direction found
            const chosenDirection = validDirections[0];
            const boundedX = Math.max(30, Math.min(this.canvas.width - 30, chosenDirection.x));
            const boundedY = Math.max(30, Math.min(this.canvas.height - 30, chosenDirection.y));
            this.addWaypointAt(boundedX, boundedY);
        }
        // If no valid directions exist, don't add a waypoint
    }

    private addRandomCardinalWaypoint(): void {
        if (this.waypoints.length === 0) return;
        
        const lastWaypoint = this.waypoints[this.waypoints.length - 1];
        const minDistance = this.getMinDistance();
        const maxDistance = minDistance + 80; // Keep max distance relative to min distance
        const distance = Math.random() * (maxDistance - minDistance) + minDistance;
        
        // Randomly choose a cardinal direction
        const directions = [
            { x: lastWaypoint.x, y: lastWaypoint.y - distance }, // North
            { x: lastWaypoint.x, y: lastWaypoint.y + distance }, // South
            { x: lastWaypoint.x + distance, y: lastWaypoint.y }, // East
            { x: lastWaypoint.x - distance, y: lastWaypoint.y }  // West
        ];
        
        // Filter out directions that would go outside canvas bounds AND avoid overlaps
        const validDirections = directions.filter(dir => {
            const boundedX = Math.max(30, Math.min(this.canvas.width - 30, dir.x));
            const boundedY = Math.max(30, Math.min(this.canvas.height - 30, dir.y));
            return !this.wouldOverlap(boundedX, boundedY);
        });
        
        if (validDirections.length > 0) {
            const randomDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
            const boundedX = Math.max(30, Math.min(this.canvas.width - 30, randomDirection.x));
            const boundedY = Math.max(30, Math.min(this.canvas.height - 30, randomDirection.y));
            this.addWaypointAt(boundedX, boundedY);
        }
    }

    private clearWaypoints(): void {
        this.waypoints = [];
        this.waypointCounter = 1;
        this.drawCanvas();
    }

    private autoGenerateWaypoints(): void {
        // Clear any existing waypoints
        this.waypoints = [];
        this.waypointCounter = 1;
        
        // Generate 20 waypoints following all rules
        for (let i = 0; i < 20; i++) {
            if (i === 0) {
                // First waypoint can be placed anywhere
                const x = Math.random() * (this.canvas.width - 60) + 30;
                const y = Math.random() * (this.canvas.height - 60) + 30;
                this.addWaypointAt(x, y);
            } else {
                // Subsequent waypoints must be in cardinal directions
                this.addRandomCardinalWaypoint();
            }
        }
        
        this.drawCanvas();
    }

    private drawCanvas(): void {
        // Clear canvas
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid lines for better visual reference
        this.drawGrid();
        
        // Draw lines between waypoints
        this.drawWaypointLines();
        
        // Draw all waypoints
        this.waypoints.forEach(waypoint => this.drawWaypoint(waypoint));
    }

    private drawGrid(): void {
        if (this.waypoints.length === 0) {
            // If no waypoints, draw grid for entire canvas
            this.drawGridForBounds(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        // Calculate bounding box of all waypoints
        let minX = Math.min(...this.waypoints.map(w => w.x));
        let maxX = Math.max(...this.waypoints.map(w => w.x));
        let minY = Math.min(...this.waypoints.map(w => w.y));
        let maxY = Math.max(...this.waypoints.map(w => w.y));

        // Add padding around the waypoints
        const padding = 100;
        minX = Math.max(0, minX - padding);
        maxX = Math.min(this.canvas.width, maxX + padding);
        minY = Math.max(0, minY - padding);
        maxY = Math.min(this.canvas.height, maxY + padding);

        // Draw grid only within the bounding box
        this.drawGridForBounds(minX, minY, maxX, maxY);
    }

    private drawGridForBounds(minX: number, minY: number, maxX: number, maxY: number): void {
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        // Draw vertical lines
        const startX = Math.floor(minX / 20) * 20;
        for (let x = startX; x <= maxX; x += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, minY);
            this.ctx.lineTo(x, maxY);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        const startY = Math.floor(minY / 20) * 20;
        for (let y = startY; y <= maxY; y += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(minX, y);
            this.ctx.lineTo(maxX, y);
            this.ctx.stroke();
        }
    }

    private drawWaypointLines(): void {
        if (this.waypoints.length < 2) return;
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const current = this.waypoints[i];
            const next = this.waypoints[i + 1];
            
            this.ctx.beginPath();
            this.ctx.moveTo(current.x, current.y);
            
            // Draw orthogonal lines (horizontal first, then vertical)
            // First draw horizontal line
            this.ctx.lineTo(next.x, current.y);
            // Then draw vertical line
            this.ctx.lineTo(next.x, next.y);
            this.ctx.stroke();
        }
    }

    private drawWaypoint(waypoint: Waypoint): void {
        const radius = 25;
        const isFirstOrLast = waypoint.number === 1 || waypoint.number === this.waypoints.length;
        
        // Draw circle with appropriate background color
        this.ctx.fillStyle = isFirstOrLast ? 'black' : 'white';
        this.ctx.beginPath();
        this.ctx.arc(waypoint.x, waypoint.y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw border
        this.ctx.strokeStyle = isFirstOrLast ? 'white' : 'black';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw number with appropriate text color
        this.ctx.fillStyle = isFirstOrLast ? 'white' : 'black';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(waypoint.number.toString(), waypoint.x, waypoint.y);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WaypointApp();
});

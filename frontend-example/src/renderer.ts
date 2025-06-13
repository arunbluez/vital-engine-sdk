export class Renderer {
    private ctx: CanvasRenderingContext2D
    private canvas: HTMLCanvasElement

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx
        this.canvas = ctx.canvas
    }

    clear(): void {
        this.ctx.fillStyle = '#1a1a1a'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }

    drawCircle(
        x: number, 
        y: number, 
        radius: number, 
        color: string, 
        filled: boolean = true
    ): void {
        this.ctx.beginPath()
        this.ctx.arc(x, y, radius, 0, Math.PI * 2)
        
        if (filled) {
            this.ctx.fillStyle = color
            this.ctx.fill()
        } else {
            this.ctx.strokeStyle = color
            this.ctx.stroke()
        }
    }

    drawHealthBar(
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        healthPercent: number
    ): void {
        // Background
        this.ctx.fillStyle = '#333'
        this.ctx.fillRect(x - width/2, y, width, height)
        
        // Health fill
        const fillWidth = width * healthPercent
        const gradient = this.ctx.createLinearGradient(x - width/2, 0, x + width/2, 0)
        gradient.addColorStop(0, '#f00')
        gradient.addColorStop(0.5, '#ff0')
        gradient.addColorStop(1, '#0f0')
        
        this.ctx.fillStyle = gradient
        this.ctx.fillRect(x - width/2, y, fillWidth, height)
        
        // Border
        this.ctx.strokeStyle = '#666'
        this.ctx.strokeRect(x - width/2, y, width, height)
    }

    drawText(
        text: string, 
        x: number, 
        y: number, 
        color: string = '#fff', 
        font: string = '14px Arial'
    ): void {
        this.ctx.font = font
        this.ctx.fillStyle = color
        this.ctx.fillText(text, x, y)
    }

    drawCrosshair(x: number, y: number, size: number, color: string): void {
        this.ctx.strokeStyle = color
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        
        // Horizontal line
        this.ctx.moveTo(x - size, y)
        this.ctx.lineTo(x + size, y)
        
        // Vertical line  
        this.ctx.moveTo(x, y - size)
        this.ctx.lineTo(x, y + size)
        
        this.ctx.stroke()
        
        // Center dot
        this.ctx.fillStyle = color
        this.ctx.beginPath()
        this.ctx.arc(x, y, 2, 0, Math.PI * 2)
        this.ctx.fill()
    }

    drawLine(
        x1: number, 
        y1: number, 
        x2: number, 
        y2: number, 
        color: string, 
        width: number = 1
    ): void {
        this.ctx.strokeStyle = color
        this.ctx.lineWidth = width
        this.ctx.beginPath()
        this.ctx.moveTo(x1, y1)
        this.ctx.lineTo(x2, y2)
        this.ctx.stroke()
    }
}
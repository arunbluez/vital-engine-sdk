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

    drawRectangle(
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
        filled: boolean = true
    ): void {
        if (filled) {
            this.ctx.fillStyle = color
            this.ctx.fillRect(x, y, width, height)
        } else {
            this.ctx.strokeStyle = color
            this.ctx.strokeRect(x, y, width, height)
        }
    }

    drawPolygon(
        points: { x: number; y: number }[],
        color: string,
        filled: boolean = true
    ): void {
        if (points.length < 3) return
        
        this.ctx.beginPath()
        this.ctx.moveTo(points[0].x, points[0].y)
        
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y)
        }
        
        this.ctx.closePath()
        
        if (filled) {
            this.ctx.fillStyle = color
            this.ctx.fill()
        } else {
            this.ctx.strokeStyle = color
            this.ctx.stroke()
        }
    }

    drawSkillIcon(
        x: number,
        y: number,
        size: number,
        skillType: string,
        cooldownPercent: number = 0
    ): void {
        // Background
        this.ctx.fillStyle = '#222'
        this.ctx.fillRect(x - size/2, y - size/2, size, size)
        
        // Icon based on skill type
        this.ctx.fillStyle = '#fff'
        this.ctx.font = `${size * 0.6}px Arial`
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'middle'
        
        const icons: Record<string, string> = {
            'area_blast': '💥',
            'damage_boost': '⚔️',
            'health_regeneration': '❤️',
            'movement_speed': '🏃'
        }
        
        this.ctx.fillText(icons[skillType] || '✨', x, y)
        
        // Cooldown overlay
        if (cooldownPercent > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
            const cooldownHeight = size * cooldownPercent
            this.ctx.fillRect(x - size/2, y - size/2, size, cooldownHeight)
        }
        
        // Border
        this.ctx.strokeStyle = '#666'
        this.ctx.strokeRect(x - size/2, y - size/2, size, size)
    }

    drawWaveIndicator(
        x: number,
        y: number,
        waveNumber: number,
        progress: number
    ): void {
        this.ctx.font = 'bold 16px Arial'
        this.ctx.fillStyle = '#ff0'
        this.ctx.fillText(`Wave ${waveNumber}`, x, y)
        
        // Progress bar
        const barWidth = 100
        const barHeight = 6
        const barY = y + 10
        
        this.ctx.fillStyle = '#333'
        this.ctx.fillRect(x - barWidth/2, barY, barWidth, barHeight)
        
        this.ctx.fillStyle = '#ff0'
        this.ctx.fillRect(x - barWidth/2, barY, barWidth * progress, barHeight)
        
        this.ctx.strokeStyle = '#666'
        this.ctx.strokeRect(x - barWidth/2, barY, barWidth, barHeight)
    }

    drawParticle(
        x: number,
        y: number,
        size: number,
        color: string,
        alpha: number = 1
    ): void {
        this.ctx.globalAlpha = alpha
        this.drawCircle(x, y, size, color, true)
        this.ctx.globalAlpha = 1
    }
}
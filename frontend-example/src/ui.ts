export class UIManager {
    private healthFill: HTMLElement
    private levelElement: HTMLElement
    private xpElement: HTMLElement
    private entityCountElement: HTMLElement
    private fpsElement: HTMLElement

    constructor() {
        const healthFill = document.getElementById('healthFill')
        const levelElement = document.getElementById('level')
        const xpElement = document.getElementById('xp')
        const entityCountElement = document.getElementById('entityCount')
        const fpsElement = document.getElementById('fps')

        if (!healthFill || !levelElement || !xpElement || !entityCountElement || !fpsElement) {
            throw new Error('Required UI elements not found')
        }

        this.healthFill = healthFill
        this.levelElement = levelElement
        this.xpElement = xpElement
        this.entityCountElement = entityCountElement
        this.fpsElement = fpsElement
    }

    updateHealth(current: number, maximum: number): void {
        const percent = Math.max(0, Math.min(100, (current / maximum) * 100))
        this.healthFill.style.width = `${percent}%`
    }

    updateLevel(level: number): void {
        this.levelElement.textContent = level.toString()
    }

    updateXP(xp: number): void {
        this.xpElement.textContent = xp.toString()
    }

    updateEntityCount(count: number): void {
        this.entityCountElement.textContent = count.toString()
    }

    updateFPS(fps: number): void {
        this.fpsElement.textContent = fps.toString()
    }
}
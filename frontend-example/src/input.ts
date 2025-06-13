import type { InputDirection, MousePosition, InputEventMap, InputEventType } from './types'

export class InputHandler {
    private canvas: HTMLCanvasElement
    private keys: Set<string>
    private mousePos: MousePosition
    private listeners: Map<InputEventType, Array<(...args: any[]) => void>>

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.keys = new Set()
        this.mousePos = { x: 0, y: 0 }
        this.listeners = new Map()
        
        this.setupEventListeners()
    }

    private setupEventListeners(): void {
        // Keyboard events
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            this.keys.add(e.code)
        })
        
        window.addEventListener('keyup', (e: KeyboardEvent) => {
            this.keys.delete(e.code)
            
            // Handle single-key actions
            switch (e.code) {
                case 'KeyR':
                    this.emit('restart')
                    break
                case 'Digit1':
                    this.emit('skill', 1)
                    break
                case 'Digit2':
                    this.emit('skill', 2)
                    break
                case 'Digit3':
                    this.emit('skill', 3)
                    break
                case 'KeyQ':
                    this.emit('test_phase3')
                    break
                case 'Space':
                    this.emit('use_skill', 'area_blast')
                    break
            }
        })
        
        // Mouse events
        this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
            const rect = this.canvas.getBoundingClientRect()
            this.mousePos.x = e.clientX - rect.left
            this.mousePos.y = e.clientY - rect.top
        })
        
        this.canvas.addEventListener('click', (e: MouseEvent) => {
            const rect = this.canvas.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            this.emit('attack', { x, y })
        })
    }

    update(): void {
        // Handle continuous movement
        const direction: InputDirection = { x: 0, y: 0 }
        
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) direction.y -= 1
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) direction.y += 1
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) direction.x -= 1
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) direction.x += 1
        
        // Normalize diagonal movement
        if (direction.x !== 0 && direction.y !== 0) {
            const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
            direction.x /= length
            direction.y /= length
        }
        
        this.emit('move', direction)
    }

    on<K extends keyof InputEventMap>(event: K, callback: InputEventMap[K]): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, [])
        }
        this.listeners.get(event)?.push(callback)
    }

    private emit<K extends keyof InputEventMap>(
        event: K, 
        ...args: Parameters<InputEventMap[K]>
    ): void {
        const callbacks = this.listeners.get(event)
        if (callbacks) {
            callbacks.forEach(callback => callback(...args))
        }
    }

    getMousePosition(): MousePosition {
        return { ...this.mousePos }
    }
}
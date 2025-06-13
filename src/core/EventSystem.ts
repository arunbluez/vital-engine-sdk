import type {
  GameEvent,
  EventListener,
  EventSubscription,
  EventFilter,
  EventHistory,
} from '../types/Events'

/**
 * Event system for inter-system communication.
 * Provides a centralized event bus for decoupled communication between systems.
 */
export class EventSystem {
  private listeners = new Map<string, Set<EventListener>>()
  private globalListeners = new Set<EventListener>()
  private eventHistory: GameEvent[] = []
  private historyEnabled: boolean = false
  private maxHistorySize: number = 1000
  private eventCount: number = 0

  /**
   * Subscribes to a specific event type
   */
  on<T = unknown>(
    eventType: string,
    listener: EventListener<T>
  ): EventSubscription {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }

    const listeners = this.listeners.get(eventType)!
    listeners.add(listener as EventListener)

    return {
      unsubscribe: () => {
        listeners.delete(listener as EventListener)
        if (listeners.size === 0) {
          this.listeners.delete(eventType)
        }
      },
    }
  }

  /**
   * Subscribes to a specific event type (one-time listener)
   */
  once<T = unknown>(
    eventType: string,
    listener: EventListener<T>
  ): EventSubscription {
    const subscription = this.on(eventType, (event) => {
      subscription.unsubscribe()
      listener(event as GameEvent & { data: T })
    })
    return subscription
  }

  /**
   * Subscribes to all events
   */
  onAll(listener: EventListener): EventSubscription {
    this.globalListeners.add(listener)

    return {
      unsubscribe: () => {
        this.globalListeners.delete(listener)
      },
    }
  }

  /**
   * Emits an event
   */
  emit(
    eventType: string,
    data: unknown,
    source?: string,
    entityId?: number
  ): void {
    const event: GameEvent = {
      type: eventType,
      timestamp: Date.now(),
      data,
      source,
      entityId,
    }

    this.eventCount++

    // Add to history if enabled
    if (this.historyEnabled) {
      this.addToHistory(event)
    }

    // Notify specific listeners
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event)
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error)
        }
      })
    }

    // Notify global listeners
    this.globalListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in global event listener:', error)
      }
    })
  }

  /**
   * Removes all listeners for a specific event type
   */
  off(eventType: string): void {
    this.listeners.delete(eventType)
  }

  /**
   * Removes all event listeners
   */
  clear(): void {
    this.listeners.clear()
    this.globalListeners.clear()
  }

  /**
   * Enables or disables event history
   */
  setHistoryEnabled(enabled: boolean, maxSize: number = 1000): void {
    this.historyEnabled = enabled
    this.maxHistorySize = maxSize

    if (!enabled) {
      this.eventHistory = []
    }
  }

  /**
   * Gets the event history
   */
  getHistory(filter?: EventFilter): EventHistory {
    const events = filter
      ? this.eventHistory.filter(filter)
      : [...this.eventHistory]

    return {
      events,
      maxSize: this.maxHistorySize,
      startTime: events[0]?.timestamp ?? 0,
      endTime: events[events.length - 1]?.timestamp ?? 0,
    }
  }

  /**
   * Clears the event history
   */
  clearHistory(): void {
    this.eventHistory = []
  }

  /**
   * Gets events of a specific type from history
   */
  getEventsByType(eventType: string): GameEvent[] {
    return this.eventHistory.filter((event) => event.type === eventType)
  }

  /**
   * Gets events for a specific entity from history
   */
  getEventsByEntity(entityId: number): GameEvent[] {
    return this.eventHistory.filter((event) => event.entityId === entityId)
  }

  /**
   * Replays events from history
   */
  replay(
    events: GameEvent[],
    speed: number = 1,
    onComplete?: () => void
  ): void {
    if (events.length === 0) {
      onComplete?.()
      return
    }

    let index = 0
    const startTime = events[0].timestamp
    const replayStartTime = Date.now()

    const replayNext = (): void => {
      if (index >= events.length) {
        onComplete?.()
        return
      }

      const event = events[index]
      const eventDelay = (event.timestamp - startTime) / speed
      const actualDelay = replayStartTime + eventDelay - Date.now()

      if (actualDelay <= 0) {
        // Emit the event
        this.emit(event.type, event.data, event.source, event.entityId)
        index++
        setImmediate(replayNext)
      } else {
        setTimeout(() => {
          this.emit(event.type, event.data, event.source, event.entityId)
          index++
          replayNext()
        }, actualDelay)
      }
    }

    replayNext()
  }

  /**
   * Gets statistics about the event system
   */
  getStats(): {
    listenerCount: number
    globalListenerCount: number
    eventTypeCount: number
    historySize: number
    totalEventsEmitted: number
  } {
    let listenerCount = 0
    this.listeners.forEach((listeners) => {
      listenerCount += listeners.size
    })

    return {
      listenerCount,
      globalListenerCount: this.globalListeners.size,
      eventTypeCount: this.listeners.size,
      historySize: this.eventHistory.length,
      totalEventsEmitted: this.eventCount,
    }
  }

  /**
   * Adds an event to history
   */
  private addToHistory(event: GameEvent): void {
    this.eventHistory.push(event)

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }
  }
}

/**
 * Spatial partitioning utilities for efficient proximity queries
 */

import type { Vector2 } from '../types/GameTypes'
import type { EntityId } from '../types/CoreTypes'

export interface SpatialEntity {
  id: EntityId
  position: Vector2
  radius?: number
}

export interface SpatialQuery {
  position: Vector2
  radius: number
}

export interface SpatialPartitionConfig {
  cellSize: number
  worldBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  maxEntitiesPerCell?: number
}

/**
 * Spatial hash grid for efficient proximity queries
 */
export class SpatialHashGrid {
  private grid: Map<string, Set<EntityId>> = new Map()
  private entities: Map<EntityId, SpatialEntity> = new Map()
  private cellSize: number
  private worldBounds: SpatialPartitionConfig['worldBounds']

  constructor(config: SpatialPartitionConfig) {
    this.cellSize = config.cellSize
    this.worldBounds = config.worldBounds
  }

  /**
   * Gets the grid key for a position
   */
  private getGridKey(x: number, y: number): string {
    const gridX = Math.floor(x / this.cellSize)
    const gridY = Math.floor(y / this.cellSize)
    return `${gridX},${gridY}`
  }

  /**
   * Gets all grid keys that an entity overlaps
   */
  private getEntityGridKeys(entity: SpatialEntity): string[] {
    const keys: string[] = []
    const radius = entity.radius ?? 0

    const minX = entity.position.x - radius
    const maxX = entity.position.x + radius
    const minY = entity.position.y - radius
    const maxY = entity.position.y + radius

    const startGridX = Math.floor(minX / this.cellSize)
    const endGridX = Math.floor(maxX / this.cellSize)
    const startGridY = Math.floor(minY / this.cellSize)
    const endGridY = Math.floor(maxY / this.cellSize)

    for (let x = startGridX; x <= endGridX; x++) {
      for (let y = startGridY; y <= endGridY; y++) {
        keys.push(`${x},${y}`)
      }
    }

    return keys
  }

  /**
   * Inserts an entity into the spatial grid
   */
  insert(entity: SpatialEntity): void {
    // Remove existing if updating position
    if (this.entities.has(entity.id)) {
      this.remove(entity.id)
    }

    this.entities.set(entity.id, entity)

    const keys = this.getEntityGridKeys(entity)
    keys.forEach((key) => {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set())
      }
      this.grid.get(key)!.add(entity.id)
    })
  }

  /**
   * Updates an entity's position
   */
  update(entityId: EntityId, newPosition: Vector2): void {
    const entity = this.entities.get(entityId)
    if (!entity) return

    // Remove from old cells
    const oldKeys = this.getEntityGridKeys(entity)
    oldKeys.forEach((key) => {
      this.grid.get(key)?.delete(entityId)
    })

    // Update position
    entity.position = newPosition

    // Add to new cells
    const newKeys = this.getEntityGridKeys(entity)
    newKeys.forEach((key) => {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set())
      }
      this.grid.get(key)!.add(entityId)
    })
  }

  /**
   * Removes an entity from the spatial grid
   */
  remove(entityId: EntityId): void {
    const entity = this.entities.get(entityId)
    if (!entity) return

    const keys = this.getEntityGridKeys(entity)
    keys.forEach((key) => {
      this.grid.get(key)?.delete(entityId)
      if (this.grid.get(key)?.size === 0) {
        this.grid.delete(key)
      }
    })

    this.entities.delete(entityId)
  }

  /**
   * Queries entities within a radius of a position
   */
  query(query: SpatialQuery): EntityId[] {
    const results = new Set<EntityId>()

    // Get all cells that the query radius overlaps
    const minX = query.position.x - query.radius
    const maxX = query.position.x + query.radius
    const minY = query.position.y - query.radius
    const maxY = query.position.y + query.radius

    const startGridX = Math.floor(minX / this.cellSize)
    const endGridX = Math.floor(maxX / this.cellSize)
    const startGridY = Math.floor(minY / this.cellSize)
    const endGridY = Math.floor(maxY / this.cellSize)

    // Check all overlapping cells
    for (let x = startGridX; x <= endGridX; x++) {
      for (let y = startGridY; y <= endGridY; y++) {
        const key = `${x},${y}`
        const cellEntities = this.grid.get(key)

        if (cellEntities) {
          cellEntities.forEach((entityId) => {
            const entity = this.entities.get(entityId)
            if (entity) {
              // Fine-grained distance check
              const dx = entity.position.x - query.position.x
              const dy = entity.position.y - query.position.y
              const distSq = dx * dx + dy * dy
              const totalRadius = query.radius + (entity.radius ?? 0)

              if (distSq <= totalRadius * totalRadius) {
                results.add(entityId)
              }
            }
          })
        }
      }
    }

    return Array.from(results)
  }

  /**
   * Gets the k nearest neighbors to a position
   */
  queryKNearest(
    position: Vector2,
    k: number,
    maxRadius: number = Infinity
  ): EntityId[] {
    const candidates: Array<{ id: EntityId; distSq: number }> = []

    // Start with a small radius and expand if needed
    let searchRadius = this.cellSize
    while (candidates.length < k && searchRadius < maxRadius) {
      const query = { position, radius: searchRadius }
      const nearbyIds = this.query(query)

      nearbyIds.forEach((id) => {
        const entity = this.entities.get(id)
        if (entity) {
          const dx = entity.position.x - position.x
          const dy = entity.position.y - position.y
          const distSq = dx * dx + dy * dy

          if (!candidates.some((c) => c.id === id)) {
            candidates.push({ id, distSq })
          }
        }
      })

      searchRadius *= 2
    }

    // Sort by distance and return top k
    candidates.sort((a, b) => a.distSq - b.distSq)
    return candidates.slice(0, k).map((c) => c.id)
  }

  /**
   * Clears the spatial grid
   */
  clear(): void {
    this.grid.clear()
    this.entities.clear()
  }

  /**
   * Gets statistics about the spatial grid
   */
  getStats(): {
    entityCount: number
    cellCount: number
    averageEntitiesPerCell: number
    maxEntitiesInCell: number
  } {
    let maxEntities = 0
    let totalEntities = 0

    this.grid.forEach((cell) => {
      const size = cell.size
      totalEntities += size
      maxEntities = Math.max(maxEntities, size)
    })

    return {
      entityCount: this.entities.size,
      cellCount: this.grid.size,
      averageEntitiesPerCell:
        this.grid.size > 0 ? totalEntities / this.grid.size : 0,
      maxEntitiesInCell: maxEntities,
    }
  }
}

/**
 * Quadtree for hierarchical spatial partitioning
 */
export class QuadTree {
  private root: QuadTreeNode
  private entities: Map<EntityId, SpatialEntity> = new Map()
  private maxDepth: number
  private maxEntitiesPerNode: number

  constructor(
    bounds: SpatialPartitionConfig['worldBounds'],
    maxDepth: number = 5,
    maxEntitiesPerNode: number = 10
  ) {
    this.root = new QuadTreeNode(bounds, 0)
    this.maxDepth = maxDepth
    this.maxEntitiesPerNode = maxEntitiesPerNode
  }

  insert(entity: SpatialEntity): void {
    this.entities.set(entity.id, entity)
    this.root.insert(entity, this.maxDepth, this.maxEntitiesPerNode)
  }

  remove(entityId: EntityId): void {
    const entity = this.entities.get(entityId)
    if (entity) {
      this.root.remove(entityId)
      this.entities.delete(entityId)
    }
  }

  query(query: SpatialQuery): EntityId[] {
    const results: EntityId[] = []
    this.root.query(query, results, this.entities)
    return results
  }

  clear(): void {
    this.root.clear()
    this.entities.clear()
  }

  update(entityId: EntityId, newPosition: Vector2): void {
    const entity = this.entities.get(entityId)
    if (entity) {
      this.remove(entityId)
      entity.position = newPosition
      this.insert(entity)
    }
  }
}

class QuadTreeNode {
  private bounds: SpatialPartitionConfig['worldBounds']
  private depth: number
  private entities: Set<EntityId> = new Set()
  private children: QuadTreeNode[] | null = null
  private divided: boolean = false

  constructor(bounds: SpatialPartitionConfig['worldBounds'], depth: number) {
    this.bounds = bounds
    this.depth = depth
  }

  private subdivide(): void {
    const { minX, minY, maxX, maxY } = this.bounds
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    this.children = [
      new QuadTreeNode({ minX, minY, maxX: midX, maxY: midY }, this.depth + 1), // NW
      new QuadTreeNode({ minX: midX, minY, maxX, maxY: midY }, this.depth + 1), // NE
      new QuadTreeNode({ minX, minY: midY, maxX: midX, maxY }, this.depth + 1), // SW
      new QuadTreeNode({ minX: midX, minY: midY, maxX, maxY }, this.depth + 1), // SE
    ]

    this.divided = true
  }

  insert(
    entity: SpatialEntity,
    maxDepth: number,
    maxEntities: number
  ): boolean {
    // Check if entity is within bounds
    if (!this.containsPoint(entity.position)) {
      return false
    }

    // If we have space or reached max depth, add here
    if (this.entities.size < maxEntities || this.depth >= maxDepth) {
      this.entities.add(entity.id)
      return true
    }

    // Otherwise, subdivide if needed and insert into children
    if (!this.divided) {
      this.subdivide()
    }

    // Move existing entities to children
    const existingEntities = Array.from(this.entities)
    this.entities.clear()

    // Try to insert into children
    let inserted = false
    for (const child of this.children!) {
      if (child.insert(entity, maxDepth, maxEntities)) {
        inserted = true
        break
      }
    }

    return inserted
  }

  remove(entityId: EntityId): boolean {
    if (this.entities.has(entityId)) {
      this.entities.delete(entityId)
      return true
    }

    if (this.divided && this.children) {
      for (const child of this.children) {
        if (child.remove(entityId)) {
          return true
        }
      }
    }

    return false
  }

  query(
    query: SpatialQuery,
    results: EntityId[],
    allEntities: Map<EntityId, SpatialEntity>
  ): void {
    // Check if query intersects this node
    if (!this.intersectsCircle(query.position, query.radius)) {
      return
    }

    // Check entities in this node
    this.entities.forEach((entityId) => {
      const entity = allEntities.get(entityId)
      if (entity) {
        const dx = entity.position.x - query.position.x
        const dy = entity.position.y - query.position.y
        const distSq = dx * dx + dy * dy
        const totalRadius = query.radius + (entity.radius ?? 0)

        if (distSq <= totalRadius * totalRadius) {
          results.push(entityId)
        }
      }
    })

    // Recursively check children
    if (this.divided && this.children) {
      for (const child of this.children) {
        child.query(query, results, allEntities)
      }
    }
  }

  private containsPoint(point: Vector2): boolean {
    return (
      point.x >= this.bounds.minX &&
      point.x <= this.bounds.maxX &&
      point.y >= this.bounds.minY &&
      point.y <= this.bounds.maxY
    )
  }

  private intersectsCircle(center: Vector2, radius: number): boolean {
    // Find closest point on rectangle to circle center
    const closestX = Math.max(
      this.bounds.minX,
      Math.min(center.x, this.bounds.maxX)
    )
    const closestY = Math.max(
      this.bounds.minY,
      Math.min(center.y, this.bounds.maxY)
    )

    // Check if closest point is within circle
    const dx = center.x - closestX
    const dy = center.y - closestY
    return dx * dx + dy * dy <= radius * radius
  }

  clear(): void {
    this.entities.clear()
    if (this.children) {
      for (const child of this.children) {
        child.clear()
      }
      this.children = null
    }
    this.divided = false
  }
}

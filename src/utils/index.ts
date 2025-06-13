export { Vector2Math, CollisionDetection, MathUtils } from './Math'
export { 
  ObjectPool, 
  PoolManager, 
  globalPoolManager,
  CommonPools,
  initializeCommonPools,
  type Poolable, 
  type PoolFactory,
  type PoolStatistics,
  type PoolConfig
} from './Pooling'
export {
  BatchProcessor,
  CacheFriendlyBatchProcessor,
  globalBatchProcessor,
  type BatchConfig,
  type BatchMetrics
} from './BatchProcessor'
export {
  SpatialHashGrid,
  QuadTree,
  type SpatialEntity,
  type SpatialQuery,
  type SpatialPartitionConfig
} from './SpatialPartitioning'
export {
  MemoryManager,
  ObjectRecycler,
  ArrayPool,
  globalMemoryManager,
  CommonRecyclers,
  type MemoryStats,
  type GCConfig
} from './MemoryManagement'
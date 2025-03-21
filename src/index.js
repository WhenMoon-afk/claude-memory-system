/**
 * Claude Memory System
 * A persistent memory system for Claude AI using knowledge graph and file storage
 */

import { MemoryManager } from './memory-manager.js';
import { KnowledgeGraphHandler } from './knowledge-graph.js';
import { PersistenceLayer } from './persistence-layer.js';
import { CompressionEngine } from './compression-engine.js';
import { RetrievalService } from './retrieval-service.js';
import { TokenAnalyzer } from './token-analyzer.js';

/**
 * Initialize the memory system
 * @param {Object} config - Configuration options
 * @returns {Promise<MemoryManager>} - Initialized memory manager
 */
async function initializeMemorySystem(config = {}) {
  try {
    // Create memory manager with configuration
    const memoryManager = new MemoryManager(config);
    
    // Initialize all components
    await memoryManager.initialize();
    
    // Start memory session
    await memoryManager.startSession();
    
    return memoryManager;
  } catch (error) {
    console.error("Failed to initialize memory system:", error);
    throw error;
  }
}

/**
 * Quick access to record an observation
 * @param {MemoryManager} memoryManager - Memory manager instance
 * @param {string} entityName - Entity name
 * @param {string} entityType - Entity type
 * @param {string} observation - Observation content
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Result of operation
 */
async function recordObservation(memoryManager, entityName, entityType, observation, options = {}) {
  return await memoryManager.recordObservation(entityName, entityType, observation, options);
}

/**
 * Quick access to create a relation
 * @param {MemoryManager} memoryManager - Memory manager instance
 * @param {string} fromEntity - Source entity
 * @param {string} relationType - Relation type
 * @param {string} toEntity - Target entity
 * @param {Object} attributes - Additional attributes
 * @returns {Promise<Object>} - Result of operation
 */
async function createRelation(memoryManager, fromEntity, relationType, toEntity, attributes = {}) {
  return await memoryManager.createRelation(fromEntity, relationType, toEntity, attributes);
}

/**
 * Save all memory and end session
 * @param {MemoryManager} memoryManager - Memory manager instance
 * @returns {Promise<Object>} - Result of operation
 */
async function saveMemory(memoryManager) {
  return await memoryManager.endSession();
}

/**
 * Create a new memory system from scratch
 * @param {string} memoryFilePath - Path for new memory file
 * @param {Object} config - Memory system configuration
 * @returns {Promise<MemoryManager>} - Initialized memory manager
 */
async function createNewMemorySystem(memoryFilePath, config = {}) {
  try {
    // Create persistence layer
    const persistenceLayer = new PersistenceLayer(memoryFilePath);
    
    // Initialize new memory file
    await persistenceLayer.initializeNewMemoryFile();
    
    // Create and initialize memory manager
    const memoryManager = new MemoryManager({
      memoryFilePath,
      ...config
    });
    
    await memoryManager.initialize();
    
    return memoryManager;
  } catch (error) {
    console.error("Failed to create new memory system:", error);
    throw error;
  }
}

// Export all components and utility functions
export {
  MemoryManager,
  KnowledgeGraphHandler,
  PersistenceLayer,
  CompressionEngine,
  RetrievalService,
  TokenAnalyzer,
  initializeMemorySystem,
  recordObservation,
  createRelation,
  saveMemory,
  createNewMemorySystem
};

// Export version information
export const VERSION = '1.0.0';
export const BUILD_DATE = '2025-03-21';

// Log initialization
console.log(`Claude Memory System v${VERSION} loaded`);

/**
 * Claude Memory System - Main Entry Point
 */

const MemoryManager = require('./memory-manager');
const KnowledgeGraph = require('./knowledge-graph');
const MemoryCompression = require('./memory-compression');

/**
 * Initialize the memory system
 * @param {string} memoryPath - Path to the memory file
 * @returns {Promise<Object>} - Initialized memory system
 */
async function initializeMemorySystem(memoryPath) {
  const manager = new MemoryManager(memoryPath);
  const initialized = await manager.initialize();
  
  if (!initialized) {
    console.error('Failed to initialize memory system');
    return null;
  }
  
  return {
    manager,
    addObservation: (entityName, observation, category, confidence, isCritical) => {
      return manager.addObservation(entityName, observation, category, confidence, isCritical);
    },
    createRelation: (fromEntity, toEntity, relationType, attributes) => {
      return manager.createRelation(fromEntity, toEntity, relationType, attributes);
    },
    saveMemory: () => {
      return manager.updateMemoryFile();
    },
    compressMemories: () => {
      return manager.compressMemories();
    }
  };
}

module.exports = {
  initializeMemorySystem,
  MemoryManager,
  KnowledgeGraph,
  MemoryCompression
};
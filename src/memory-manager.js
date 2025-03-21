/**
 * Memory Manager - Core orchestration component for Claude Memory System
 * Coordinates all memory operations across components
 */

class MemoryManager {
  constructor(config = {}) {
    this.config = {
      memoryFilePath: 'C:\\Users\\Aurora\\Desktop\\Claude\\memory\\memory.json',
      compressionThreshold: 10, // Number of related observations before compression
      tokenBudget: 8000, // Maximum tokens to use for memory operations
      ...config
    };
    
    this.knowledgeGraph = null;
    this.persistenceLayer = null;
    this.compressionEngine = null;
    this.retrievalService = null;
    this.tokenAnalyzer = null;
    
    this.sessionStartTime = new Date().toISOString();
    this.sessionActive = false;
    this.pendingObservations = [];
  }
  
  /**
   * Initialize all memory system components
   */
  async initialize() {
    try {
      // Import and initialize components
      const { KnowledgeGraphHandler } = await import('./knowledge-graph.js');
      const { PersistenceLayer } = await import('./persistence-layer.js');
      const { CompressionEngine } = await import('./compression-engine.js');
      const { RetrievalService } = await import('./retrieval-service.js');
      const { TokenAnalyzer } = await import('./token-analyzer.js');
      
      this.knowledgeGraph = new KnowledgeGraphHandler();
      this.persistenceLayer = new PersistenceLayer(this.config.memoryFilePath);
      this.compressionEngine = new CompressionEngine(this.config.compressionThreshold);
      this.retrievalService = new RetrievalService();
      this.tokenAnalyzer = new TokenAnalyzer(this.config.tokenBudget);
      
      console.log("Memory Manager initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize Memory Manager:", error);
      return false;
    }
  }
  
  /**
   * Start a new memory session
   */
  async startSession() {
    if (this.sessionActive) {
      return { success: false, message: "Session already active" };
    }
    
    try {
      // Start token tracking
      this.tokenAnalyzer.startTracking();
      
      // Load existing memory from file
      const memoryData = await this.persistenceLayer.readMemoryFile();
      
      // Apply memory instructions
      const instructions = memoryData.memory_instructions || {};
      console.log("Applied memory instructions");
      
      // Load entities and relations into knowledge graph
      await this.loadMemoryIntoKnowledgeGraph(memoryData);
      
      this.sessionActive = true;
      console.log("Memory session started successfully");
      
      return { 
        success: true, 
        message: "Memory session started",
        userProfile: memoryData.user_profile || {} 
      };
    } catch (error) {
      console.error("Failed to start memory session:", error);
      return { 
        success: false, 
        message: `Failed to start memory session: ${error.message}` 
      };
    }
  }
  
  /**
   * Load memory data into knowledge graph
   * @param {Object} memoryData - The memory data from the file
   */
  async loadMemoryIntoKnowledgeGraph(memoryData) {
    try {
      // Load short-term memory entities
      if (memoryData.short_term_memory && memoryData.short_term_memory.entities) {
        for (const entity of memoryData.short_term_memory.entities) {
          await this.knowledgeGraph.createEntity(entity);
        }
      }
      
      // Load short-term memory relations
      if (memoryData.short_term_memory && memoryData.short_term_memory.relations) {
        for (const relation of memoryData.short_term_memory.relations) {
          await this.knowledgeGraph.createRelation(relation);
        }
      }
      
      // Load long-term memory entities
      if (memoryData.long_term_memory && memoryData.long_term_memory.entities) {
        for (const entity of memoryData.long_term_memory.entities) {
          await this.knowledgeGraph.createEntity(entity);
        }
      }
      
      // Load long-term memory relations
      if (memoryData.long_term_memory && memoryData.long_term_memory.relations) {
        for (const relation of memoryData.long_term_memory.relations) {
          await this.knowledgeGraph.createRelation(relation);
        }
      }
      
      console.log("Successfully loaded memory into knowledge graph");
      return true;
    } catch (error) {
      console.error("Failed to load memory into knowledge graph:", error);
      return false;
    }
  }
  
  /**
   * Record a new observation about an entity
   * @param {string} entityName - The name of the entity
   * @param {string} entityType - The type of the entity
   * @param {string} observation - The observation content
   * @param {Object} options - Additional options (category, confidence, etc.)
   */
  async recordObservation(entityName, entityType, observation, options = {}) {
    if (!this.sessionActive) {
      await this.startSession();
    }
    
    try {
      // Prepare observation with metadata
      const observationData = {
        content: observation,
        timestamp: new Date().toISOString(),
        confidence: options.confidence || 3,
        category: options.category || 'behavior',
        is_critical: options.is_critical || false
      };
      
      // Track pending observation for end-of-session processing
      this.pendingObservations.push({
        entityName,
        entityType,
        observation: observationData
      });
      
      // Check if entity exists, create if not
      const entityExists = await this.knowledgeGraph.entityExists(entityName);
      
      if (!entityExists) {
        await this.knowledgeGraph.createEntity({
          name: entityName,
          entityType: entityType,
          observations: [observationData]
        });
      } else {
        // Add observation to existing entity
        await this.knowledgeGraph.addObservation(entityName, observationData);
      }
      
      // Track token usage
      this.tokenAnalyzer.trackOperation('recordObservation', {
        entityName,
        observation
      });
      
      return { success: true, message: "Observation recorded" };
    } catch (error) {
      console.error("Failed to record observation:", error);
      return { success: false, message: `Failed to record observation: ${error.message}` };
    }
  }
  
  /**
   * Create a relation between entities
   * @param {string} fromEntity - The source entity name
   * @param {string} relationType - The type of relation
   * @param {string} toEntity - The target entity name
   * @param {Object} attributes - Additional relation attributes
   */
  async createRelation(fromEntity, relationType, toEntity, attributes = {}) {
    if (!this.sessionActive) {
      await this.startSession();
    }
    
    try {
      // Add timestamp if not provided
      if (!attributes.time) {
        attributes.time = new Date().toISOString();
      }
      
      // Create relation in knowledge graph
      await this.knowledgeGraph.createRelation({
        from: fromEntity,
        relationType,
        to: toEntity,
        attributes
      });
      
      // Track token usage
      this.tokenAnalyzer.trackOperation('createRelation', {
        fromEntity,
        relationType,
        toEntity
      });
      
      return { success: true, message: "Relation created" };
    } catch (error) {
      console.error("Failed to create relation:", error);
      return { success: false, message: `Failed to create relation: ${error.message}` };
    }
  }
  
  /**
   * Retrieve memories relevant to the current context
   * @param {Object} context - The current conversation context
   * @param {Array} entities - Specific entities to focus on (optional)
   * @param {Object} options - Additional retrieval options
   */
  async retrieveMemories(context, entities = [], options = {}) {
    if (!this.sessionActive) {
      await this.startSession();
    }
    
    try {
      // Use retrieval service to get relevant memories
      const memories = await this.retrievalService.retrieveRelevantMemories(
        this.knowledgeGraph,
        context,
        entities,
        options
      );
      
      // Track token usage
      this.tokenAnalyzer.trackOperation('retrieveMemories', {
        contextLength: JSON.stringify(context).length,
        entitiesCount: entities.length,
        retrievedMemoriesCount: memories.length
      });
      
      return { 
        success: true, 
        memories 
      };
    } catch (error) {
      console.error("Failed to retrieve memories:", error);
      return { 
        success: false, 
        message: `Failed to retrieve memories: ${error.message}`,
        memories: [] 
      };
    }
  }
  
  /**
   * End the current memory session and persist changes
   */
  async endSession() {
    if (!this.sessionActive) {
      return { success: false, message: "No active session to end" };
    }
    
    try {
      // Get current state of memory file
      const currentMemory = await this.persistenceLayer.readMemoryFile();
      
      // Get current state of knowledge graph
      const graphData = await this.knowledgeGraph.exportGraph();
      
      // Apply compression to new observations
      const compressedObservations = await this.compressionEngine.compressObservations(
        this.pendingObservations
      );
      
      // Update memory file with new data
      const updatedMemory = this.prepareMemoryUpdate(
        currentMemory,
        graphData,
        compressedObservations
      );
      
      // Write updated memory to file
      await this.persistenceLayer.writeMemoryFile(updatedMemory);
      
      // Finalize token tracking
      const tokenStats = this.tokenAnalyzer.finalizeTracking();
      
      this.sessionActive = false;
      this.pendingObservations = [];
      
      console.log("Memory session ended successfully");
      console.log("Token usage statistics:", tokenStats);
      
      return { 
        success: true, 
        message: "Memory session ended and changes persisted",
        tokenStats 
      };
    } catch (error) {
      console.error("Failed to end memory session:", error);
      return { 
        success: false, 
        message: `Failed to end memory session: ${error.message}` 
      };
    }
  }
  
  /**
   * Prepare memory update by merging current state with new data
   * @param {Object} currentMemory - Current memory file contents
   * @param {Object} graphData - Current knowledge graph data
   * @param {Array} compressedObservations - Newly compressed observations
   */
  prepareMemoryUpdate(currentMemory, graphData, compressedObservations) {
    // Create a deep copy of current memory
    const updatedMemory = JSON.parse(JSON.stringify(currentMemory));
    
    // Update metadata
    updatedMemory.metadata.last_updated = new Date().toISOString();
    
    // Update short-term memory with latest graph data
    updatedMemory.short_term_memory.entities = graphData.entities;
    updatedMemory.short_term_memory.relations = graphData.relations;
    
    // Update session metadata
    updatedMemory.short_term_memory.session_metadata = {
      session_id: `session_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      start_time: this.sessionStartTime,
      end_time: new Date().toISOString(),
      platform: "Claude Web Interface",
      interaction_count: this.tokenAnalyzer.getOperationCount()
    };
    
    // Add compressed observations to long-term memory
    if (compressedObservations && compressedObservations.length > 0) {
      if (!updatedMemory.long_term_memory.compressed_observations) {
        updatedMemory.long_term_memory.compressed_observations = [];
      }
      
      updatedMemory.long_term_memory.compressed_observations = [
        ...compressedObservations,
        ...updatedMemory.long_term_memory.compressed_observations
      ];
    }
    
    // Update memory evolution
    if (!updatedMemory.long_term_memory.memory_evolution) {
      updatedMemory.long_term_memory.memory_evolution = [];
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have an entry for today
    const todayEvolutionIndex = updatedMemory.long_term_memory.memory_evolution.findIndex(
      entry => entry.date === today
    );
    
    const sessionSummary = `Conversation focused on memory system implementation architecture and core components.`;
    
    if (todayEvolutionIndex >= 0) {
      // Update existing entry
      updatedMemory.long_term_memory.memory_evolution[todayEvolutionIndex].summary = sessionSummary;
    } else {
      // Add new entry
      updatedMemory.long_term_memory.memory_evolution.unshift({
        date: today,
        summary: sessionSummary
      });
    }
    
    return updatedMemory;
  }
}

export { MemoryManager };

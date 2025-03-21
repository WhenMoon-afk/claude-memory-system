/**
 * Knowledge Graph Handler - Manages in-session entity and relation operations
 * Provides interface to the MCP server-memory functionality
 */

class KnowledgeGraphHandler {
  constructor() {
    this.initialized = false;
    this.entityCache = new Map(); // Cache for faster entity lookups
    this.relationCache = new Map(); // Cache for faster relation lookups
  }
  
  /**
   * Initialize the knowledge graph
   */
  async initialize() {
    try {
      // Check if server-memory MCP is available
      const graph = await this._readGraph();
      
      if (graph) {
        console.log("Knowledge Graph initialized successfully");
        this.initialized = true;
        return true;
      } else {
        throw new Error("Failed to read graph from server-memory MCP");
      }
    } catch (error) {
      console.error("Failed to initialize Knowledge Graph:", error);
      return false;
    }
  }
  
  /**
   * Check if the handler is initialized
   * @returns {Promise<boolean>} - True if initialized, initializes if not
   */
  async ensureInitialized() {
    if (!this.initialized) {
      return await this.initialize();
    }
    return true;
  }
  
  /**
   * Create a new entity in the knowledge graph
   * @param {Object} entity - The entity to create
   * @returns {Promise<Object>} - Result of operation
   */
  async createEntity(entity) {
    await this.ensureInitialized();
    
    try {
      // Validate entity structure
      if (!entity.name || !entity.entityType) {
        throw new Error("Entity must have name and entityType properties");
      }
      
      // Ensure observations is an array
      if (!entity.observations) {
        entity.observations = [];
      }
      
      // Call server-memory MCP to create entity
      await this._createEntities({ entities: [entity] });
      
      // Update cache
      this.entityCache.set(entity.name, entity);
      
      return { success: true, entity };
    } catch (error) {
      console.error(`Failed to create entity ${entity.name}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if an entity exists in the knowledge graph
   * @param {string} entityName - The name of the entity
   * @returns {Promise<boolean>} - True if entity exists
   */
  async entityExists(entityName) {
    await this.ensureInitialized();
    
    // Check cache first
    if (this.entityCache.has(entityName)) {
      return true;
    }
    
    try {
      // Search for entity in knowledge graph
      const results = await this._searchNodes(entityName);
      
      if (results && results.entities && results.entities.length > 0) {
        // Update cache with found entities
        for (const entity of results.entities) {
          this.entityCache.set(entity.name, entity);
        }
        
        // Return true if entity with exact name exists
        return results.entities.some(entity => entity.name === entityName);
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to check if entity ${entityName} exists:`, error);
      return false;
    }
  }
  
  /**
   * Get an entity by name
   * @param {string} entityName - The name of the entity
   * @returns {Promise<Object>} - The entity object
   */
  async getEntity(entityName) {
    await this.ensureInitialized();
    
    // Check cache first
    if (this.entityCache.has(entityName)) {
      return this.entityCache.get(entityName);
    }
    
    try {
      // Open specific node by name
      const results = await this._openNodes([entityName]);
      
      if (results && results.entities && results.entities.length > 0) {
        const entity = results.entities[0];
        // Update cache
        this.entityCache.set(entityName, entity);
        return entity;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get entity ${entityName}:`, error);
      return null;
    }
  }
  
  /**
   * Add observation to an existing entity
   * @param {string} entityName - The name of the entity
   * @param {Object} observation - The observation to add
   * @returns {Promise<Object>} - Result of operation
   */
  async addObservation(entityName, observation) {
    await this.ensureInitialized();
    
    try {
      // Validate observation
      if (!observation.content) {
        throw new Error("Observation must have content property");
      }
      
      // Add timestamp if not provided
      if (!observation.timestamp) {
        observation.timestamp = new Date().toISOString();
      }
      
      // Call server-memory MCP to add observation
      await this._addObservations({
        observations: [
          {
            entityName,
            contents: [observation]
          }
        ]
      });
      
      // Update cache if entity exists in cache
      if (this.entityCache.has(entityName)) {
        const entity = this.entityCache.get(entityName);
        if (!entity.observations) {
          entity.observations = [];
        }
        entity.observations.push(observation);
        this.entityCache.set(entityName, entity);
      }
      
      return { success: true, entityName, observation };
    } catch (error) {
      console.error(`Failed to add observation to entity ${entityName}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a relation between entities
   * @param {Object} relation - The relation to create
   * @returns {Promise<Object>} - Result of operation
   */
  async createRelation(relation) {
    await this.ensureInitialized();
    
    try {
      // Validate relation
      if (!relation.from || !relation.relationType || !relation.to) {
        throw new Error("Relation must have from, relationType, and to properties");
      }
      
      // Check if entities exist
      const fromExists = await this.entityExists(relation.from);
      const toExists = await this.entityExists(relation.to);
      
      if (!fromExists) {
        await this.createEntity({
          name: relation.from,
          entityType: 'Unknown',
          observations: []
        });
      }
      
      if (!toExists) {
        await this.createEntity({
          name: relation.to,
          entityType: 'Unknown',
          observations: []
        });
      }
      
      // Call server-memory MCP to create relation
      await this._createRelations({
        relations: [relation]
      });
      
      // Update cache
      const cacheKey = `${relation.from}:${relation.relationType}:${relation.to}`;
      this.relationCache.set(cacheKey, relation);
      
      return { success: true, relation };
    } catch (error) {
      console.error(`Failed to create relation:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get relations involving an entity
   * @param {string} entityName - The name of the entity
   * @returns {Promise<Array>} - List of relations
   */
  async getEntityRelations(entityName) {
    await this.ensureInitialized();
    
    try {
      // Get full graph to find relations
      const graph = await this._readGraph();
      
      if (graph && graph.relations) {
        // Filter relations involving the entity
        const relations = graph.relations.filter(
          relation => relation.from === entityName || relation.to === entityName
        );
        
        // Update relation cache
        for (const relation of relations) {
          const cacheKey = `${relation.from}:${relation.relationType}:${relation.to}`;
          this.relationCache.set(cacheKey, relation);
        }
        
        return relations;
      }
      
      return [];
    } catch (error) {
      console.error(`Failed to get relations for entity ${entityName}:`, error);
      return [];
    }
  }
  
  /**
   * Delete an entity and its relations
   * @param {string} entityName - The name of the entity to delete
   * @returns {Promise<Object>} - Result of operation
   */
  async deleteEntity(entityName) {
    await this.ensureInitialized();
    
    try {
      // Call server-memory MCP to delete entity
      await this._deleteEntities({
        entityNames: [entityName]
      });
      
      // Remove from cache
      this.entityCache.delete(entityName);
      
      // Clean up relation cache (slower operation)
      for (const [key, relation] of this.relationCache.entries()) {
        if (relation.from === entityName || relation.to === entityName) {
          this.relationCache.delete(key);
        }
      }
      
      return { success: true, entityName };
    } catch (error) {
      console.error(`Failed to delete entity ${entityName}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a specific relation
   * @param {Object} relation - The relation to delete
   * @returns {Promise<Object>} - Result of operation
   */
  async deleteRelation(relation) {
    await this.ensureInitialized();
    
    try {
      // Validate relation
      if (!relation.from || !relation.relationType || !relation.to) {
        throw new Error("Relation must have from, relationType, and to properties");
      }
      
      // Call server-memory MCP to delete relation
      await this._deleteRelations({
        relations: [relation]
      });
      
      // Remove from cache
      const cacheKey = `${relation.from}:${relation.relationType}:${relation.to}`;
      this.relationCache.delete(cacheKey);
      
      return { success: true, relation };
    } catch (error) {
      console.error(`Failed to delete relation:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Search for entities and observations
   * @param {string} query - The search query
   * @returns {Promise<Object>} - Search results
   */
  async search(query) {
    await this.ensureInitialized();
    
    try {
      // Call server-memory MCP to search nodes
      const results = await this._searchNodes(query);
      
      // Update cache with search results
      if (results && results.entities) {
        for (const entity of results.entities) {
          this.entityCache.set(entity.name, entity);
        }
      }
      
      return results || { entities: [] };
    } catch (error) {
      console.error(`Failed to search for ${query}:`, error);
      return { entities: [] };
    }
  }
  
  /**
   * Export the current knowledge graph state
   * @returns {Promise<Object>} - Full graph data
   */
  async exportGraph() {
    await this.ensureInitialized();
    
    try {
      // Get complete graph from server-memory MCP
      const graph = await this._readGraph();
      
      // Update caches with full graph data
      if (graph && graph.entities) {
        for (const entity of graph.entities) {
          this.entityCache.set(entity.name, entity);
        }
      }
      
      if (graph && graph.relations) {
        for (const relation of graph.relations) {
          const cacheKey = `${relation.from}:${relation.relationType}:${relation.to}`;
          this.relationCache.set(cacheKey, relation);
        }
      }
      
      return graph || { entities: [], relations: [] };
    } catch (error) {
      console.error("Failed to export graph:", error);
      return { entities: [], relations: [] };
    }
  }
  
  /**
   * Clear the knowledge graph
   * @returns {Promise<Object>} - Result of operation
   */
  async clearGraph() {
    await this.ensureInitialized();
    
    try {
      // Get all entities
      const graph = await this._readGraph();
      
      if (graph && graph.entities && graph.entities.length > 0) {
        // Delete all entities (relations will be deleted automatically)
        await this._deleteEntities({
          entityNames: graph.entities.map(entity => entity.name)
        });
      }
      
      // Clear caches
      this.entityCache.clear();
      this.relationCache.clear();
      
      return { success: true, message: "Knowledge graph cleared" };
    } catch (error) {
      console.error("Failed to clear graph:", error);
      return { success: false, error: error.message };
    }
  }
  
  // MCP server-memory wrapper methods
  
  /**
   * Wrapper for create_entities MCP function
   * @private
   */
  async _createEntities(params) {
    return new Promise((resolve, reject) => {
      try {
        create_entities(params, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("create_entities MCP function not available, simulating result");
        console.warn("Would have called with:", params);
        resolve({ success: true, message: "Entity creation simulated" });
      }
    });
  }
  
  /**
   * Wrapper for create_relations MCP function
   * @private
   */
  async _createRelations(params) {
    return new Promise((resolve, reject) => {
      try {
        create_relations(params, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("create_relations MCP function not available, simulating result");
        console.warn("Would have called with:", params);
        resolve({ success: true, message: "Relation creation simulated" });
      }
    });
  }
  
  /**
   * Wrapper for add_observations MCP function
   * @private
   */
  async _addObservations(params) {
    return new Promise((resolve, reject) => {
      try {
        add_observations(params, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("add_observations MCP function not available, simulating result");
        console.warn("Would have called with:", params);
        resolve({ success: true, message: "Observation addition simulated" });
      }
    });
  }
  
  /**
   * Wrapper for delete_entities MCP function
   * @private
   */
  async _deleteEntities(params) {
    return new Promise((resolve, reject) => {
      try {
        delete_entities(params, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("delete_entities MCP function not available, simulating result");
        console.warn("Would have called with:", params);
        resolve({ success: true, message: "Entity deletion simulated" });
      }
    });
  }
  
  /**
   * Wrapper for delete_relations MCP function
   * @private
   */
  async _deleteRelations(params) {
    return new Promise((resolve, reject) => {
      try {
        delete_relations(params, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("delete_relations MCP function not available, simulating result");
        console.warn("Would have called with:", params);
        resolve({ success: true, message: "Relation deletion simulated" });
      }
    });
  }
  
  /**
   * Wrapper for read_graph MCP function
   * @private
   */
  async _readGraph() {
    return new Promise((resolve, reject) => {
      try {
        read_graph({}, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("read_graph MCP function not available, simulating result");
        console.warn("Would have called with: {}");
        resolve({ entities: [], relations: [] });
      }
    });
  }
  
  /**
   * Wrapper for search_nodes MCP function
   * @private
   */
  async _searchNodes(query) {
    return new Promise((resolve, reject) => {
      try {
        search_nodes({ query }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("search_nodes MCP function not available, simulating result");
        console.warn("Would have called with:", { query });
        resolve({ entities: [] });
      }
    });
  }
  
  /**
   * Wrapper for open_nodes MCP function
   * @private
   */
  async _openNodes(names) {
    return new Promise((resolve, reject) => {
      try {
        open_nodes({ names }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        console.warn("open_nodes MCP function not available, simulating result");
        console.warn("Would have called with:", { names });
        resolve({ entities: [] });
      }
    });
  }
}

export { KnowledgeGraphHandler };

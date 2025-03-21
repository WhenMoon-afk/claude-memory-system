/**
 * Retrieval Service - Manages memory access with intelligent prioritization
 * Focuses on context-relevant memory retrieval for optimal token efficiency
 */

class RetrievalService {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      // Maximum number of entities to retrieve
      maxEntities: 10,
      // Maximum number of observations per entity
      maxObservationsPerEntity: 5,
      // Maximum number of relations to retrieve
      maxRelations: 20,
      // Confidence threshold for retrieved memories (1-5)
      minConfidence: 3,
      // Default time window for recency (in days)
      recencyWindow: 30,
      // Weight factors for scoring memories
      weights: {
        recency: 0.3,
        confidence: 0.3,
        relevance: 0.4
      },
      ...options
    };
  }
  
  /**
   * Retrieve memories relevant to the current context
   * @param {Object} knowledgeGraph - Knowledge Graph Handler instance
   * @param {Object} context - Current conversation context
   * @param {Array} targetEntities - Specific entities to focus on (optional)
   * @param {Object} options - Additional retrieval options
   * @returns {Promise<Object>} - Relevant memories
   */
  async retrieveRelevantMemories(knowledgeGraph, context, targetEntities = [], options = {}) {
    try {
      // Merge default options with provided options
      const retrievalOptions = {
        ...this.options,
        ...options
      };
      
      // Extract keywords from context
      const keywords = this._extractKeywords(context);
      
      // Get entities
      let entities = [];
      
      if (targetEntities.length > 0) {
        // Get specific entities if provided
        for (const entityName of targetEntities) {
          const entity = await knowledgeGraph.getEntity(entityName);
          if (entity) entities.push(entity);
        }
      } else {
        // Search for relevant entities based on keywords
        for (const keyword of keywords) {
          const results = await knowledgeGraph.search(keyword);
          if (results && results.entities) {
            entities = [...entities, ...results.entities];
          }
        }
        
        // Remove duplicates
        entities = this._removeDuplicateEntities(entities);
      }
      
      // Score and filter entities
      const scoredEntities = this._scoreEntities(entities, keywords, context);
      
      // Get top entities based on score
      const topEntities = scoredEntities
        .sort((a, b) => b.score - a.score)
        .slice(0, retrievalOptions.maxEntities);
      
      // Get relations for top entities
      let relations = [];
      for (const entity of topEntities) {
        const entityRelations = await knowledgeGraph.getEntityRelations(entity.name);
        relations = [...relations, ...entityRelations];
      }
      
      // Score and filter relations
      const scoredRelations = this._scoreRelations(relations, topEntities, context);
      
      // Get top relations based on score
      const topRelations = scoredRelations
        .sort((a, b) => b.score - a.score)
        .slice(0, retrievalOptions.maxRelations);
      
      // Filter observations for each entity
      const processedEntities = topEntities.map(entity => {
        return {
          ...entity,
          observations: this._filterAndSortObservations(
            entity.observations || [],
            keywords,
            context,
            retrievalOptions
          )
        };
      });
      
      return {
        entities: processedEntities,
        relations: topRelations,
        context: {
          keywords,
          retrievalOptions
        }
      };
    } catch (error) {
      console.error("Error retrieving memories:", error);
      return {
        entities: [],
        relations: [],
        error: error.message
      };
    }
  }
  
  /**
   * Extract keywords from conversation context
   * @private
   * @param {Object} context - Conversation context
   * @returns {Array} - Extracted keywords
   */
  _extractKeywords(context) {
    // In a production system, this would use more sophisticated NLP techniques
    // For this implementation, we'll use a simple approach
    
    // Convert context to string if it's an object
    const contextText = typeof context === 'string'
      ? context
      : JSON.stringify(context);
    
    // Tokenize and filter common words
    const tokens = contextText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this._isStopWord(word));
    
    // Count word frequencies
    const wordCounts = {};
    for (const word of tokens) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    
    // Get top keywords by frequency
    const keywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return keywords;
  }
  
  /**
   * Check if a word is a common stop word
   * @private
   * @param {string} word - Word to check
   * @returns {boolean} - True if it's a stop word
   */
  _isStopWord(word) {
    const stopWords = [
      'the', 'and', 'are', 'for', 'was', 'that', 'this', 'with', 'have', 'from',
      'what', 'which', 'when', 'where', 'who', 'will', 'would', 'there', 'their',
      'about', 'should', 'could', 'been', 'more', 'very', 'some', 'other', 'then'
    ];
    
    return stopWords.includes(word);
  }
  
  /**
   * Remove duplicate entities from list
   * @private
   * @param {Array} entities - List of entities
   * @returns {Array} - Deduplicated entities
   */
  _removeDuplicateEntities(entities) {
    const uniqueEntities = [];
    const entityNames = new Set();
    
    for (const entity of entities) {
      if (!entityNames.has(entity.name)) {
        entityNames.add(entity.name);
        uniqueEntities.push(entity);
      }
    }
    
    return uniqueEntities;
  }
  
  /**
   * Score entities based on relevance to keywords and context
   * @private
   * @param {Array} entities - List of entities
   * @param {Array} keywords - Extracted keywords
   * @param {Object} context - Conversation context
   * @returns {Array} - Scored entities
   */
  _scoreEntities(entities, keywords, context) {
    return entities.map(entity => {
      // Calculate relevance score
      const relevanceScore = this._calculateRelevanceScore(entity, keywords);
      
      // Calculate recency score
      const recencyScore = this._calculateRecencyScore(entity);
      
      // Calculate confidence score
      const confidenceScore = this._calculateConfidenceScore(entity);
      
      // Calculate total score
      const totalScore = (
        this.options.weights.relevance * relevanceScore +
        this.options.weights.recency * recencyScore +
        this.options.weights.confidence * confidenceScore
      );
      
      return {
        ...entity,
        score: totalScore,
        scores: {
          relevance: relevanceScore,
          recency: recencyScore,
          confidence: confidenceScore
        }
      };
    });
  }
  
  /**
   * Calculate relevance score based on keyword matches
   * @private
   * @param {Object} entity - Entity to score
   * @param {Array} keywords - Keywords to match
   * @returns {number} - Relevance score (0-1)
   */
  _calculateRelevanceScore(entity, keywords) {
    if (!entity) return 0;
    
    // Convert entity to string representation
    const entityString = JSON.stringify(entity).toLowerCase();
    
    // Count keyword matches
    let matches = 0;
    for (const keyword of keywords) {
      if (entityString.includes(keyword.toLowerCase())) {
        matches++;
      }
    }
    
    // Calculate score based on matches
    return keywords.length > 0
      ? matches / keywords.length
      : 0;
  }
  
  /**
   * Calculate recency score based on timestamps
   * @private
   * @param {Object} entity - Entity to score
   * @returns {number} - Recency score (0-1)
   */
  _calculateRecencyScore(entity) {
    if (!entity || !entity.observations || entity.observations.length === 0) {
      return 0;
    }
    
    // Find most recent observation
    const timestamps = entity.observations
      .map(obs => obs.timestamp ? new Date(obs.timestamp).getTime() : 0)
      .filter(timestamp => timestamp > 0);
    
    if (timestamps.length === 0) return 0;
    
    const mostRecent = Math.max(...timestamps);
    const now = new Date().getTime();
    
    // Calculate days since most recent observation
    const daysSince = (now - mostRecent) / (1000 * 60 * 60 * 24);
    
    // Score decreases as days increase, with recencyWindow as the horizon
    return Math.max(0, 1 - (daysSince / this.options.recencyWindow));
  }
  
  /**
   * Calculate confidence score based on observation confidence
   * @private
   * @param {Object} entity - Entity to score
   * @returns {number} - Confidence score (0-1)
   */
  _calculateConfidenceScore(entity) {
    if (!entity || !entity.observations || entity.observations.length === 0) {
      return 0;
    }
    
    // Calculate average confidence
    const confidences = entity.observations
      .map(obs => obs.confidence || 0)
      .filter(confidence => confidence > 0);
    
    if (confidences.length === 0) return 0;
    
    const avgConfidence = confidences.reduce((sum, val) => sum + val, 0) / confidences.length;
    
    // Normalize to 0-1 range (assuming confidence is 1-5)
    return avgConfidence / 5;
  }
  
  /**
   * Score relations based on connected entities
   * @private
   * @param {Array} relations - List of relations
   * @param {Array} topEntities - Top-scored entities
   * @param {Object} context - Conversation context
   * @returns {Array} - Scored relations
   */
  _scoreRelations(relations, topEntities, context) {
    const entityNames = new Set(topEntities.map(entity => entity.name));
    
    return relations.map(relation => {
      // Prioritize relations between top entities
      const connectsTopEntities = 
        entityNames.has(relation.from) && 
        entityNames.has(relation.to);
      
      // Calculate base score
      let score = connectsTopEntities ? 1.0 : 0.5;
      
      // Boost score for critical relations
      if (relation.attributes && relation.attributes.is_critical) {
        score += 0.3;
      }
      
      // Boost score for recent relations
      if (relation.attributes && relation.attributes.time) {
        const relationTime = new Date(relation.attributes.time).getTime();
        const now = new Date().getTime();
        const daysSince = (now - relationTime) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 0.2 * (1 - (daysSince / this.options.recencyWindow)));
        
        score += recencyBoost;
      }
      
      return {
        ...relation,
        score
      };
    });
  }
  
  /**
   * Filter and sort observations for an entity
   * @private
   * @param {Array} observations - List of observations
   * @param {Array} keywords - Extracted keywords
   * @param {Object} context - Conversation context
   * @param {Object} options - Retrieval options
   * @returns {Array} - Filtered and sorted observations
   */
  _filterAndSortObservations(observations, keywords, context, options) {
    if (!observations || observations.length === 0) {
      return [];
    }
    
    // Filter by minimum confidence
    const filteredObservations = observations.filter(obs => 
      (obs.confidence || 0) >= options.minConfidence
    );
    
    // Score observations
    const scoredObservations = filteredObservations.map(obs => {
      // Relevance to keywords
      const relevanceScore = keywords.reduce((score, keyword) => {
        return obs.content && obs.content.toLowerCase().includes(keyword.toLowerCase())
          ? score + 1
          : score;
      }, 0) / Math.max(1, keywords.length);
      
      // Recency score
      let recencyScore = 0;
      if (obs.timestamp) {
        const obsTime = new Date(obs.timestamp).getTime();
        const now = new Date().getTime();
        const daysSince = (now - obsTime) / (1000 * 60 * 60 * 24);
        recencyScore = Math.max(0, 1 - (daysSince / options.recencyWindow));
      }
      
      // Confidence score
      const confidenceScore = (obs.confidence || 0) / 5;
      
      // Critical flag bonus
      const criticalBonus = obs.is_critical ? 0.5 : 0;
      
      // Calculate total score
      const totalScore = (
        options.weights.relevance * relevanceScore +
        options.weights.recency * recencyScore +
        options.weights.confidence * confidenceScore +
        criticalBonus
      );
      
      return {
        ...obs,
        score: totalScore
      };
    });
    
    // Sort by score (descending) and limit number
    return scoredObservations
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxObservationsPerEntity);
  }
  
  /**
   * Retrieve memories by category
   * @param {Object} knowledgeGraph - Knowledge Graph Handler instance
   * @param {string} category - Category to filter by (e.g., "identity", "preference")
   * @param {Array} entityNames - Specific entities to focus on
   * @param {Object} options - Additional retrieval options
   * @returns {Promise<Object>} - Category-specific memories
   */
  async retrieveByCategory(knowledgeGraph, category, entityNames = [], options = {}) {
    try {
      // Get entities
      let entities = [];
      
      if (entityNames.length > 0) {
        // Get specific entities if provided
        for (const entityName of entityNames) {
          const entity = await knowledgeGraph.getEntity(entityName);
          if (entity) entities.push(entity);
        }
      } else {
        // Get all entities from knowledge graph
        const graph = await knowledgeGraph.exportGraph();
        entities = graph.entities || [];
      }
      
      // Filter observations by category
      const filteredEntities = entities.map(entity => {
        const categoryObservations = (entity.observations || []).filter(obs => 
          obs.category === category
        );
        
        return {
          ...entity,
          observations: categoryObservations
        };
      }).filter(entity => entity.observations.length > 0);
      
      // Apply standard scoring and filtering
      const mergedOptions = { ...this.options, ...options };
      const processedEntities = filteredEntities.map(entity => {
        return {
          ...entity,
          observations: this._filterAndSortObservations(
            entity.observations,
            [],  // No keywords for category filtering
            {},  // No context for category filtering
            mergedOptions
          )
        };
      });
      
      return {
        category,
        entities: processedEntities
      };
    } catch (error) {
      console.error(`Error retrieving memories by category ${category}:`, error);
      return {
        category,
        entities: [],
        error: error.message
      };
    }
  }
  
  /**
   * Retrieve critical memories that should never be forgotten
   * @param {Object} knowledgeGraph - Knowledge Graph Handler instance
   * @param {Array} entityNames - Specific entities to focus on
   * @returns {Promise<Object>} - Critical memories
   */
  async retrieveCriticalMemories(knowledgeGraph, entityNames = []) {
    try {
      // Get entities
      let entities = [];
      
      if (entityNames.length > 0) {
        // Get specific entities if provided
        for (const entityName of entityNames) {
          const entity = await knowledgeGraph.getEntity(entityName);
          if (entity) entities.push(entity);
        }
      } else {
        // Get all entities from knowledge graph
        const graph = await knowledgeGraph.exportGraph();
        entities = graph.entities || [];
      }
      
      // Filter for critical observations
      const criticalEntities = entities.map(entity => {
        const criticalObservations = (entity.observations || []).filter(obs => 
          obs.is_critical === true
        );
        
        return {
          ...entity,
          observations: criticalObservations
        };
      }).filter(entity => entity.observations.length > 0);
      
      // Get critical relations
      let relations = [];
      const graph = await knowledgeGraph.exportGraph();
      
      if (graph && graph.relations) {
        relations = graph.relations.filter(relation => 
          relation.attributes && relation.attributes.is_critical === true
        );
      }
      
      return {
        entities: criticalEntities,
        relations
      };
    } catch (error) {
      console.error("Error retrieving critical memories:", error);
      return {
        entities: [],
        relations: [],
        error: error.message
      };
    }
  }
  
  /**
   * Retrieve memories based on time period
   * @param {Object} knowledgeGraph - Knowledge Graph Handler instance
   * @param {Object} timeRange - Time range to filter by (startDate, endDate)
   * @param {Array} entityNames - Specific entities to focus on
   * @returns {Promise<Object>} - Time-filtered memories
   */
  async retrieveByTimeRange(knowledgeGraph, timeRange, entityNames = []) {
    try {
      const { startDate, endDate } = timeRange;
      const startTime = startDate ? new Date(startDate).getTime() : 0;
      const endTime = endDate ? new Date(endDate).getTime() : Date.now();
      
      // Get entities
      let entities = [];
      
      if (entityNames.length > 0) {
        // Get specific entities if provided
        for (const entityName of entityNames) {
          const entity = await knowledgeGraph.getEntity(entityName);
          if (entity) entities.push(entity);
        }
      } else {
        // Get all entities from knowledge graph
        const graph = await knowledgeGraph.exportGraph();
        entities = graph.entities || [];
      }
      
      // Filter observations by time range
      const filteredEntities = entities.map(entity => {
        const timeRangeObservations = (entity.observations || []).filter(obs => {
          if (!obs.timestamp) return false;
          
          const obsTime = new Date(obs.timestamp).getTime();
          return obsTime >= startTime && obsTime <= endTime;
        });
        
        return {
          ...entity,
          observations: timeRangeObservations
        };
      }).filter(entity => entity.observations.length > 0);
      
      // Filter relations by time range
      let relations = [];
      const graph = await knowledgeGraph.exportGraph();
      
      if (graph && graph.relations) {
        relations = graph.relations.filter(relation => {
          if (!relation.attributes || !relation.attributes.time) return false;
          
          const relationTime = new Date(relation.attributes.time).getTime();
          return relationTime >= startTime && relationTime <= endTime;
        });
      }
      
      return {
        timeRange: {
          startDate: startDate ? new Date(startDate).toISOString() : "beginning",
          endDate: endDate ? new Date(endDate).toISOString() : new Date().toISOString()
        },
        entities: filteredEntities,
        relations
      };
    } catch (error) {
      console.error("Error retrieving memories by time range:", error);
      return {
        timeRange,
        entities: [],
        relations: [],
        error: error.message
      };
    }
  }
}

export { RetrievalService };

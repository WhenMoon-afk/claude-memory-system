/**
 * Compression Engine - Implements intelligent memory compression algorithms
 * Focuses on semantic similarity detection and observation summarization
 */

class CompressionEngine {
  /**
   * @param {number} threshold - Minimum number of related observations to trigger compression
   * @param {Object} options - Additional configuration options
   */
  constructor(threshold = 5, options = {}) {
    this.compressionThreshold = threshold;
    this.options = {
      // Minimum similarity score (0-1) to consider observations related
      similarityThreshold: 0.6,
      // Maximum age in days for observations to be considered for compression
      maxObservationAge: 7,
      // Whether to preserve critical observations (never compress them)
      preserveCritical: true,
      // Minimum confidence score for compression candidates
      minConfidence: 3,
      ...options
    };
  }
  
  /**
   * Compress a set of observations into more concise representations
   * @param {Array} pendingObservations - New observations to consider for compression
   * @returns {Promise<Array>} - Compressed observations
   */
  async compressObservations(pendingObservations) {
    if (!pendingObservations || pendingObservations.length === 0) {
      return [];
    }
    
    try {
      // Group observations by entity and category
      const groupedObservations = this._groupObservations(pendingObservations);
      
      // Process each group for compression
      const compressedResults = [];
      
      for (const [key, group] of Object.entries(groupedObservations)) {
        // Skip groups smaller than threshold
        if (group.observations.length < this.compressionThreshold) {
          continue;
        }
        
        // Find semantically similar observations within group
        const clusters = this._clusterSimilarObservations(group.observations);
        
        // Compress each cluster into a single observation
        for (const cluster of clusters) {
          if (cluster.length >= this.compressionThreshold) {
            const compressed = this._compressCluster(cluster, group.entityName, group.category);
            if (compressed) {
              compressedResults.push(compressed);
            }
          }
        }
      }
      
      return compressedResults;
    } catch (error) {
      console.error("Error compressing observations:", error);
      return [];
    }
  }
  
  /**
   * Group observations by entity and category
   * @private
   * @param {Array} observations - List of observations
   * @returns {Object} - Grouped observations
   */
  _groupObservations(observations) {
    const groups = {};
    
    for (const item of observations) {
      const { entityName, entityType, observation } = item;
      
      // Skip critical observations if preserveCritical is enabled
      if (this.options.preserveCritical && observation.is_critical) {
        continue;
      }
      
      // Skip observations with confidence below minimum
      if (observation.confidence < this.options.minConfidence) {
        continue;
      }
      
      // Check observation age
      const obsDate = new Date(observation.timestamp);
      const now = new Date();
      const ageInDays = (now - obsDate) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > this.options.maxObservationAge) {
        continue;
      }
      
      // Create group key
      const groupKey = `${entityName}:${observation.category || 'general'}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          entityName,
          entityType,
          category: observation.category || 'general',
          observations: []
        };
      }
      
      groups[groupKey].observations.push(observation);
    }
    
    return groups;
  }
  
  /**
   * Cluster observations based on semantic similarity
   * @private
   * @param {Array} observations - List of observations
   * @returns {Array} - Clusters of similar observations
   */
  _clusterSimilarObservations(observations) {
    const clusters = [];
    const processed = new Set();
    
    for (let i = 0; i < observations.length; i++) {
      if (processed.has(i)) continue;
      
      const obsA = observations[i];
      const cluster = [obsA];
      processed.add(i);
      
      for (let j = i + 1; j < observations.length; j++) {
        if (processed.has(j)) continue;
        
        const obsB = observations[j];
        const similarity = this._calculateSimilarity(obsA.content, obsB.content);
        
        if (similarity >= this.options.similarityThreshold) {
          cluster.push(obsB);
          processed.add(j);
        }
      }
      
      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }
  
  /**
   * Calculate semantic similarity between two observation contents
   * @private
   * @param {string} contentA - First observation content
   * @param {string} contentB - Second observation content
   * @returns {number} - Similarity score (0-1)
   */
  _calculateSimilarity(contentA, contentB) {
    // This is a simplified version of semantic similarity
    // In a production system, this would use more sophisticated NLP techniques
    
    // Convert to lowercase and tokenize
    const tokensA = contentA.toLowerCase().split(/\W+/).filter(t => t.length > 0);
    const tokensB = contentB.toLowerCase().split(/\W+/).filter(t => t.length > 0);
    
    // Create sets for overlap calculation
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    
    // Calculate Jaccard similarity
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Compress a cluster of similar observations into a single observation
   * @private
   * @param {Array} cluster - Cluster of similar observations
   * @param {string} entityName - Entity name
   * @param {string} category - Observation category
   * @returns {Object} - Compressed observation
   */
  _compressCluster(cluster, entityName, category) {
    try {
      // Sort cluster by timestamp (newest first)
      const sortedCluster = [...cluster].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      // Get the most recent timestamp
      const timestamp = sortedCluster[0].timestamp;
      
      // Determine aggregate confidence level
      const avgConfidence = Math.round(
        sortedCluster.reduce((sum, obs) => sum + (obs.confidence || 3), 0) / sortedCluster.length
      );
      
      // Build a summary of the observations
      const summary = this._generateSummary(sortedCluster);
      
      // Check if any observation in the cluster is critical
      const is_critical = sortedCluster.some(obs => obs.is_critical === true);
      
      return {
        content: summary,
        source_observations: sortedCluster.map(obs => obs.content),
        confidence: avgConfidence,
        category,
        timestamp,
        is_critical
      };
    } catch (error) {
      console.error("Error compressing cluster:", error);
      return null;
    }
  }
  
  /**
   * Generate a summary from a cluster of observations
   * @private
   * @param {Array} cluster - Cluster of observations
   * @returns {string} - Summary text
   */
  _generateSummary(cluster) {
    // In a production system, this would use more sophisticated NLP techniques
    // For this implementation, we'll use a template-based approach
    
    // Extract key actions and subjects
    const actions = [];
    const subjects = [];
    const objects = [];
    
    for (const obs of cluster) {
      const content = obs.content;
      const words = content.split(/\W+/).filter(w => w.length > 0);
      
      // Extremely simplified extraction
      if (words.length > 2) {
        // Assume first word might be subject
        if (words[0].length > 3) subjects.push(words[0]);
        
        // Assume second word might be verb/action
        if (words[1].length > 3) actions.push(words[1]);
        
        // Assume some later words might be objects
        for (let i = 2; i < Math.min(5, words.length); i++) {
          if (words[i].length > 3) objects.push(words[i]);
        }
      }
    }
    
    // Get most common elements
    const mainSubject = this._getMostCommon(subjects) || "Subject";
    const mainAction = this._getMostCommon(actions) || "performed action";
    const mainObject = this._getMostCommon(objects) || "object";
    
    // Create summary template
    let summary = `${mainSubject} ${mainAction} ${mainObject}`;
    
    // Add observation count
    if (cluster.length > 1) {
      summary += ` (observed ${cluster.length} times)`;
    }
    
    return summary;
  }
  
  /**
   * Get the most common element in an array
   * @private
   * @param {Array} arr - Array of elements
   * @returns {*} - Most common element
   */
  _getMostCommon(arr) {
    if (!arr.length) return null;
    
    const counts = {};
    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1;
    }
    
    let maxCount = 0;
    let maxItem = null;
    
    for (const [item, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxItem = item;
      }
    }
    
    return maxItem;
  }
  
  /**
   * Enhanced compression using advanced NLP techniques
   * This is a placeholder for future implementation
   * @param {Array} observations - Observations to compress
   * @returns {Promise<Array>} - Compressed observations
   */
  async enhancedCompression(observations) {
    // This would implement more sophisticated NLP techniques:
    // - Named entity recognition
    // - Dependency parsing
    // - Semantic role labeling
    // - Transformers for text summarization
    // - Topic modeling
    
    console.log("Enhanced compression not yet implemented");
    return this.compressObservations(observations);
  }
  
  /**
   * Compress a large set of observations over time
   * @param {Array} observations - Historical observations
   * @param {number} timeWindowDays - Time window for compression (days)
   * @returns {Promise<Array>} - Temporal compression result
   */
  async temporalCompression(observations, timeWindowDays = 30) {
    if (!observations || observations.length === 0) {
      return [];
    }
    
    try {
      // Group observations by time windows
      const timeWindows = this._groupByTimeWindow(observations, timeWindowDays);
      
      // Compress each time window
      const compressedResults = [];
      
      for (const [windowKey, windowObservations] of Object.entries(timeWindows)) {
        // Convert to format expected by compressObservations
        const formattedObs = windowObservations.map(obs => ({
          entityName: obs.entityName,
          entityType: obs.entityType || 'Unknown',
          observation: obs
        }));
        
        // Apply standard compression to this time window
        const windowCompressed = await this.compressObservations(formattedObs);
        
        // Add time window to compressed result
        for (const compressed of windowCompressed) {
          compressed.time_window = windowKey;
          compressedResults.push(compressed);
        }
      }
      
      return compressedResults;
    } catch (error) {
      console.error("Error in temporal compression:", error);
      return [];
    }
  }
  
  /**
   * Group observations by time windows
   * @private
   * @param {Array} observations - List of observations
   * @param {number} timeWindowDays - Size of time window in days
   * @returns {Object} - Observations grouped by time window
   */
  _groupByTimeWindow(observations, timeWindowDays) {
    const windows = {};
    
    for (const obs of observations) {
      // Skip if no timestamp
      if (!obs.timestamp) continue;
      
      // Calculate time window
      const date = new Date(obs.timestamp);
      const windowStart = new Date(date);
      windowStart.setHours(0, 0, 0, 0);
      windowStart.setDate(windowStart.getDate() - (windowStart.getDate() % timeWindowDays));
      
      const windowKey = windowStart.toISOString().split('T')[0];
      
      if (!windows[windowKey]) {
        windows[windowKey] = [];
      }
      
      windows[windowKey].push(obs);
    }
    
    return windows;
  }
}

export { CompressionEngine };

/**
 * Token Analyzer - Monitors and optimizes token usage
 * Provides insights into memory system efficiency
 */

class TokenAnalyzer {
  /**
   * @param {number} tokenBudget - Maximum tokens to target for memory operations
   * @param {Object} options - Additional analyzer options
   */
  constructor(tokenBudget = 8000, options = {}) {
    this.tokenBudget = tokenBudget;
    this.options = {
      // Whether to track individual operations
      trackOperations: true,
      // Whether to generate warnings when approaching budget
      generateWarnings: true,
      // Threshold percentage for warning generation
      warningThreshold: 0.8,
      // Whether to use gzip compression to estimate token usage
      useGzipForEstimation: true,
      ...options
    };
    
    this.tracking = false;
    this.startTime = null;
    this.endTime = null;
    this.estimatedTokensUsed = 0;
    this.operations = [];
    this.warnings = [];
    this.optimizationSuggestions = [];
  }
  
  /**
   * Start tracking token usage
   * @returns {Object} - Tracking status
   */
  startTracking() {
    this.tracking = true;
    this.startTime = new Date();
    this.estimatedTokensUsed = 0;
    this.operations = [];
    this.warnings = [];
    this.optimizationSuggestions = [];
    
    console.log("Token usage tracking started");
    
    return {
      tracking: true,
      startTime: this.startTime,
      tokenBudget: this.tokenBudget
    };
  }
  
  /**
   * Track a memory operation's token usage
   * @param {string} operationType - Type of operation
   * @param {Object} data - Operation data
   * @returns {Object} - Updated tracking info
   */
  trackOperation(operationType, data = {}) {
    if (!this.tracking) {
      this.startTracking();
    }
    
    // Estimate tokens used for this operation
    const tokenEstimate = this._estimateTokens(data);
    
    // Add to total
    this.estimatedTokensUsed += tokenEstimate;
    
    // Record operation if enabled
    if (this.options.trackOperations) {
      this.operations.push({
        type: operationType,
        timestamp: new Date(),
        estimatedTokens: tokenEstimate,
        data: this._summarizeData(data)
      });
    }
    
    // Generate warning if approaching budget
    if (this.options.generateWarnings && 
        this.estimatedTokensUsed >= this.tokenBudget * this.options.warningThreshold) {
      const warningMessage = `Token usage at ${Math.round(this.estimatedTokensUsed / this.tokenBudget * 100)}% of budget (${this.estimatedTokensUsed}/${this.tokenBudget})`;
      
      // Only add warning if it's unique
      if (!this.warnings.includes(warningMessage)) {
        this.warnings.push(warningMessage);
        console.warn(warningMessage);
      }
    }
    
    return {
      tracking: true,
      operationType,
      estimatedTokens: tokenEstimate,
      totalTokens: this.estimatedTokensUsed,
      remainingBudget: this.tokenBudget - this.estimatedTokensUsed,
      percentUsed: this.estimatedTokensUsed / this.tokenBudget
    };
  }
  
  /**
   * Finalize token tracking and generate report
   * @returns {Object} - Token usage report
   */
  finalizeTracking() {
    this.tracking = false;
    this.endTime = new Date();
    
    // Generate optimization suggestions
    this._generateOptimizationSuggestions();
    
    const report = {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
      tokenBudget: this.tokenBudget,
      estimatedTokensUsed: this.estimatedTokensUsed,
      percentUsed: this.estimatedTokensUsed / this.tokenBudget,
      operationCount: this.operations.length,
      operationsSummary: this._summarizeOperations(),
      warnings: this.warnings,
      optimizationSuggestions: this.optimizationSuggestions
    };
    
    console.log("Token usage tracking finalized:", report);
    
    return report;
  }
  
  /**
   * Get the current number of tracked operations
   * @returns {number} - Operation count
   */
  getOperationCount() {
    return this.operations.length;
  }
  
  /**
   * Get current token usage status
   * @returns {Object} - Token usage status
   */
  getStatus() {
    const status = {
      tracking: this.tracking,
      startTime: this.startTime,
      currentTime: new Date(),
      tokenBudget: this.tokenBudget,
      estimatedTokensUsed: this.estimatedTokensUsed,
      percentUsed: this.estimatedTokensUsed / this.tokenBudget,
      remainingBudget: this.tokenBudget - this.estimatedTokensUsed,
      operationCount: this.operations.length,
      warnings: this.warnings
    };
    
    if (this.endTime) {
      status.endTime = this.endTime;
      status.duration = this.endTime - this.startTime;
    }
    
    return status;
  }
  
  /**
   * Estimate if an operation would exceed token budget
   * @param {string} operationType - Type of operation
   * @param {Object} data - Operation data
   * @returns {Object} - Budget prediction
   */
  predictTokenUsage(operationType, data = {}) {
    const tokenEstimate = this._estimateTokens(data);
    const wouldExceedBudget = (this.estimatedTokensUsed + tokenEstimate) > this.tokenBudget;
    const percentOfBudget = tokenEstimate / this.tokenBudget;
    
    return {
      operationType,
      estimatedTokens: tokenEstimate,
      currentUsage: this.estimatedTokensUsed,
      tokenBudget: this.tokenBudget,
      wouldExceedBudget,
      percentOfBudget,
      percentOfRemaining: this.estimatedTokensUsed < this.tokenBudget 
        ? tokenEstimate / (this.tokenBudget - this.estimatedTokensUsed)
        : Infinity
    };
  }
  
  /**
   * Analyze token usage patterns to identify optimizations
   * @returns {Array} - Optimization suggestions
   */
  analyzeTokenUsagePatterns() {
    if (this.operations.length === 0) {
      return ["Not enough operations tracked to analyze patterns"];
    }
    
    const patterns = [];
    
    // Group operations by type
    const operationsByType = {};
    for (const op of this.operations) {
      if (!operationsByType[op.type]) {
        operationsByType[op.type] = [];
      }
      operationsByType[op.type].push(op);
    }
    
    // Identify high-token operations
    const highTokenOps = this.operations
      .filter(op => op.estimatedTokens > (this.tokenBudget * 0.1))
      .sort((a, b) => b.estimatedTokens - a.estimatedTokens);
    
    if (highTokenOps.length > 0) {
      patterns.push(`Found ${highTokenOps.length} high-token operations that each use >10% of budget`);
      
      highTokenOps.slice(0, 3).forEach(op => {
        patterns.push(`High token usage: ${op.type} used ${op.estimatedTokens} tokens (${Math.round(op.estimatedTokens / this.tokenBudget * 100)}% of budget)`);
      });
    }
    
    // Identify frequent operation types
    for (const [type, ops] of Object.entries(operationsByType)) {
      if (ops.length > 5) {
        const totalTokens = ops.reduce((sum, op) => sum + op.estimatedTokens, 0);
        patterns.push(`Frequent operation: ${type} called ${ops.length} times, using ${totalTokens} tokens total (${Math.round(totalTokens / this.estimatedTokensUsed * 100)}% of usage)`);
      }
    }
    
    // Check for inefficient sequential patterns
    for (let i = 1; i < this.operations.length; i++) {
      const prevOp = this.operations[i - 1];
      const currOp = this.operations[i];
      
      if (prevOp.type === currOp.type) {
        const timeDiff = currOp.timestamp - prevOp.timestamp;
        
        // If same operation type happens within short time window
        if (timeDiff < 100) {
          patterns.push(`Sequential ${prevOp.type} operations detected within ${timeDiff}ms - consider batching`);
        }
      }
    }
    
    return patterns;
  }
  
  /**
   * Generate suggestions for optimizing token usage
   * @private
   */
  _generateOptimizationSuggestions() {
    const suggestions = [];
    
    // Check overall token usage
    const percentUsed = this.estimatedTokensUsed / this.tokenBudget;
    
    if (percentUsed > 0.95) {
      suggestions.push("Critical: Token usage exceeds 95% of budget. Consider increasing budget or implementing aggressive compression.");
    } else if (percentUsed > 0.8) {
      suggestions.push("Warning: Token usage exceeds 80% of budget. Consider implementing more efficient memory structures.");
    } else if (percentUsed < 0.3) {
      suggestions.push("Note: Token usage below 30% of budget. Consider decreasing budget or storing more detailed information.");
    }
    
    // Check operation patterns
    const patterns = this.analyzeTokenUsagePatterns();
    suggestions.push(...patterns);
    
    // Generate specific optimization suggestions
    if (this.operations.length > 0) {
      // Count operations by type
      const opCounts = {};
      for (const op of this.operations) {
        opCounts[op.type] = (opCounts[op.type] || 0) + 1;
      }
      
      // Check for excessive retrieveMemories operations
      if (opCounts['retrieveMemories'] && opCounts['retrieveMemories'] > 5) {
        suggestions.push("Consider caching retrieval results to reduce repeated memory lookups");
      }
      
      // Check for many small recordObservation operations
      if (opCounts['recordObservation'] && opCounts['recordObservation'] > 10) {
        suggestions.push("Batch multiple observations together for more efficient recording");
      }
      
      // Check if any operation is disproportionately expensive
      for (const [type, count] of Object.entries(opCounts)) {
        const ops = this.operations.filter(op => op.type === type);
        const totalTokens = ops.reduce((sum, op) => sum + op.estimatedTokens, 0);
        const percentOfTotal = totalTokens / this.estimatedTokensUsed;
        
        if (percentOfTotal > 0.5 && count > 1) {
          suggestions.push(`Optimize '${type}' operations - they account for ${Math.round(percentOfTotal * 100)}% of token usage`);
        }
      }
    }
    
    this.optimizationSuggestions = suggestions;
  }
  
  /**
   * Summarize operations by type
   * @private
   * @returns {Object} - Operations summary
   */
  _summarizeOperations() {
    if (this.operations.length === 0) {
      return {};
    }
    
    const summary = {};
    
    for (const op of this.operations) {
      if (!summary[op.type]) {
        summary[op.type] = {
          count: 0,
          totalTokens: 0,
          averageTokens: 0,
          minTokens: Infinity,
          maxTokens: 0,
          examples: []
        };
      }
      
      const typeSummary = summary[op.type];
      typeSummary.count++;
      typeSummary.totalTokens += op.estimatedTokens;
      typeSummary.minTokens = Math.min(typeSummary.minTokens, op.estimatedTokens);
      typeSummary.maxTokens = Math.max(typeSummary.maxTokens, op.estimatedTokens);
      
      // Store a few examples
      if (typeSummary.examples.length < 3) {
        typeSummary.examples.push(op);
      }
    }
    
    // Calculate averages
    for (const type in summary) {
      summary[type].averageTokens = summary[type].totalTokens / summary[type].count;
      summary[type].percentOfTotal = summary[type].totalTokens / this.estimatedTokensUsed;
    }
    
    return summary;
  }
  
  /**
   * Summarize operation data for storage
   * @private
   * @param {Object} data - Operation data
   * @returns {Object} - Summarized data
   */
  _summarizeData(data) {
    // Create a copy to avoid modifying original data
    const summary = { ...data };
    
    // Replace large arrays with length info
    for (const key in summary) {
      if (Array.isArray(summary[key]) && summary[key].length > 3) {
        summary[key] = `Array(${summary[key].length})`;
      } else if (typeof summary[key] === 'object' && summary[key] !== null) {
        summary[key] = this._summarizeData(summary[key]);
      }
    }
    
    return summary;
  }
  
  /**
   * Estimate tokens used for an operation
   * @private
   * @param {Object} data - Operation data
   * @returns {number} - Estimated token count
   */
  _estimateTokens(data) {
    // This is a simple estimation based on character count
    // In a production system, this would use a more accurate model
    
    let stringData;
    
    try {
      stringData = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (error) {
      // Fallback if data can't be stringified
      stringData = String(data);
    }
    
    if (this.options.useGzipForEstimation) {
      // Estimate compression ratio to approximate token efficiency
      return this._estimateTokensWithCompression(stringData);
    } else {
      // Simple character-based estimation (very rough)
      return Math.ceil(stringData.length / 4);
    }
  }
  
  /**
   * Estimate tokens with compression simulation
   * @private
   * @param {string} str - String to estimate
   * @returns {number} - Estimated token count
   */
  _estimateTokensWithCompression(str) {
    // Simple entropy-based token estimation
    // Calculate character frequency
    const charFreq = {};
    for (const char of str) {
      charFreq[char] = (charFreq[char] || 0) + 1;
    }
    
    // Calculate entropy
    let entropy = 0;
    const len = str.length;
    
    for (const char in charFreq) {
      const prob = charFreq[char] / len;
      entropy -= prob * Math.log2(prob);
    }
    
    // Estimate compressed size based on entropy
    // Higher entropy = less compressible = more tokens
    const compressionFactor = 0.5 + (entropy / 8); // Range ~0.5-1.5
    
    // Estimate tokens based on compressed size
    // Assume average of 4 characters per token
    return Math.ceil((str.length * compressionFactor) / 4);
  }
  
  /**
   * Reset token tracking
   * @returns {Object} - Reset status
   */
  reset() {
    this.tracking = false;
    this.startTime = null;
    this.endTime = null;
    this.estimatedTokensUsed = 0;
    this.operations = [];
    this.warnings = [];
    this.optimizationSuggestions = [];
    
    console.log("Token analyzer reset");
    
    return { reset: true };
  }
  
  /**
   * Simulate token usage for a memory structure
   * @param {Object} memoryData - Memory data to evaluate
   * @returns {Object} - Token usage simulation
   */
  simulateMemoryTokenUsage(memoryData) {
    try {
      // Extract components to analyze
      const components = {
        metadata: memoryData.metadata || {},
        memory_instructions: memoryData.memory_instructions || {},
        user_profile: memoryData.user_profile || {},
        short_term_memory: memoryData.short_term_memory || {},
        long_term_memory: memoryData.long_term_memory || {},
        system_capabilities: memoryData.system_capabilities || {}
      };
      
      // Simulate tokens for each component
      const componentTokens = {};
      let totalTokens = 0;
      
      for (const [name, data] of Object.entries(components)) {
        const tokens = this._estimateTokens(data);
        componentTokens[name] = tokens;
        totalTokens += tokens;
      }
      
      // Calculate percentages
      const percentages = {};
      for (const [name, tokens] of Object.entries(componentTokens)) {
        percentages[name] = tokens / totalTokens;
      }
      
      // Generate optimization suggestions
      const suggestions = [];
      
      // Check short-term vs long-term balance
      const shortTermTokens = componentTokens['short_term_memory'] || 0;
      const longTermTokens = componentTokens['long_term_memory'] || 0;
      
      if (shortTermTokens > longTermTokens * 2) {
        suggestions.push("Short-term memory is significantly larger than long-term memory. Consider compressing older observations.");
      }
      
      // Check for large components
      for (const [name, percentage] of Object.entries(percentages)) {
        if (percentage > 0.4) {
          suggestions.push(`'${name}' uses ${Math.round(percentage * 100)}% of total tokens. Consider optimizing this section.`);
        }
      }
      
      return {
        totalTokens,
        componentTokens,
        percentages,
        suggestions,
        originalSize: JSON.stringify(memoryData).length,
        estimatedCompression: totalTokens / JSON.stringify(memoryData).length
      };
    } catch (error) {
      console.error("Error simulating memory token usage:", error);
      return {
        error: error.message,
        totalTokens: 0,
        componentTokens: {},
        percentages: {},
        suggestions: ["Error analyzing memory structure"]
      };
    }
  }
}

export { TokenAnalyzer };

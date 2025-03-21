/**
 * Persistence Layer - Handles file system operations for memory persistence
 * Manages reading from and writing to memory.json
 */

class PersistenceLayer {
  /**
   * @param {string} memoryFilePath - Path to the memory file
   * @param {Object} options - Additional configuration options
   */
  constructor(memoryFilePath, options = {}) {
    this.memoryFilePath = memoryFilePath;
    this.options = {
      backupOnWrite: true,
      prettyPrint: true,
      retryAttempts: 3,
      ...options
    };
    
    // Keep track of last read/write operations
    this.lastReadTime = null;
    this.lastWriteTime = null;
    this.lastError = null;
  }
  
  /**
   * Read memory file from the file system
   * @returns {Promise<Object>} - Parsed memory data
   */
  async readMemoryFile() {
    let attempts = 0;
    
    while (attempts < this.options.retryAttempts) {
      try {
        // Attempt to read file
        const fileData = await this._readFile(this.memoryFilePath);
        this.lastReadTime = new Date();
        
        // Parse JSON content
        const memoryData = JSON.parse(fileData);
        
        return memoryData;
      } catch (error) {
        attempts++;
        this.lastError = error;
        
        console.error(`Error reading memory file (attempt ${attempts}):`, error);
        
        if (attempts >= this.options.retryAttempts) {
          throw new Error(`Failed to read memory file after ${attempts} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * attempts));
      }
    }
  }
  
  /**
   * Write memory data to the file system
   * @param {Object} memoryData - The memory data to write
   * @returns {Promise<boolean>} - Success indicator
   */
  async writeMemoryFile(memoryData) {
    if (!memoryData) {
      throw new Error("Cannot write null or undefined memory data");
    }
    
    let attempts = 0;
    
    // Create backup if enabled
    if (this.options.backupOnWrite) {
      await this._createBackup();
    }
    
    while (attempts < this.options.retryAttempts) {
      try {
        // Convert memory data to JSON string
        const jsonString = this.options.prettyPrint
          ? JSON.stringify(memoryData, null, 2)
          : JSON.stringify(memoryData);
        
        // Write to file
        await this._writeFile(this.memoryFilePath, jsonString);
        this.lastWriteTime = new Date();
        
        return true;
      } catch (error) {
        attempts++;
        this.lastError = error;
        
        console.error(`Error writing memory file (attempt ${attempts}):`, error);
        
        if (attempts >= this.options.retryAttempts) {
          throw new Error(`Failed to write memory file after ${attempts} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * attempts));
      }
    }
    
    return false;
  }
  
  /**
   * Create a backup of the current memory file
   * @private
   * @returns {Promise<boolean>} - Success indicator
   */
  async _createBackup() {
    try {
      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const backupPath = this.memoryFilePath.replace('.json', `-backup-${timestamp}.json`);
      
      // Read current file
      const currentData = await this._readFile(this.memoryFilePath);
      
      // Write to backup file
      await this._writeFile(backupPath, currentData);
      
      return true;
    } catch (error) {
      console.error("Failed to create backup:", error);
      return false;
    }
  }
  
  /**
   * Update specific parts of the memory file without rewriting the entire file
   * @param {Object} updates - Key-value pairs to update
   * @returns {Promise<boolean>} - Success indicator
   */
  async updateMemoryFile(updates) {
    try {
      // Read current memory file
      const memoryData = await this.readMemoryFile();
      
      // Apply updates
      for (const [key, value] of Object.entries(updates)) {
        if (key.includes('.')) {
          // Handle nested updates
          this._setNestedProperty(memoryData, key, value);
        } else {
          // Handle top-level updates
          memoryData[key] = value;
        }
      }
      
      // Update last_updated timestamp
      if (memoryData.metadata) {
        memoryData.metadata.last_updated = new Date().toISOString();
      }
      
      // Write updated file
      return await this.writeMemoryFile(memoryData);
    } catch (error) {
      this.lastError = error;
      console.error("Failed to update memory file:", error);
      return false;
    }
  }
  
  /**
   * Set a nested property using dot notation
   * @private
   * @param {Object} obj - The object to modify
   * @param {string} path - Dot notation path (e.g., "a.b.c")
   * @param {*} value - Value to set
   */
  _setNestedProperty(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      if (!current[part]) {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Get memory file information
   * @returns {Promise<Object>} - File information
   */
  async getMemoryFileInfo() {
    try {
      const fileInfo = await this._getFileInfo(this.memoryFilePath);
      
      return {
        path: this.memoryFilePath,
        size: fileInfo.size,
        lastModified: fileInfo.mtime,
        lastRead: this.lastReadTime,
        lastWrite: this.lastWriteTime
      };
    } catch (error) {
      console.error("Failed to get memory file info:", error);
      
      return {
        path: this.memoryFilePath,
        error: error.message,
        lastRead: this.lastReadTime,
        lastWrite: this.lastWriteTime
      };
    }
  }
  
  /**
   * Find memory backup files
   * @returns {Promise<Array>} - List of backup files
   */
  async findBackupFiles() {
    try {
      const baseDir = this.memoryFilePath.substring(0, this.memoryFilePath.lastIndexOf('\\'));
      const baseFilename = this.memoryFilePath.substring(this.memoryFilePath.lastIndexOf('\\') + 1);
      const baseNameWithoutExt = baseFilename.replace('.json', '');
      
      const files = await this._listDirectory(baseDir);
      
      // Filter for backup files
      const backupFiles = files
        .filter(file => file.startsWith(baseNameWithoutExt) && file.includes('-backup-'))
        .map(file => `${baseDir}\\${file}`);
      
      return backupFiles;
    } catch (error) {
      console.error("Failed to find backup files:", error);
      return [];
    }
  }
  
  /**
   * Restore from a backup file
   * @param {string} backupFilePath - Path to backup file
   * @returns {Promise<boolean>} - Success indicator
   */
  async restoreFromBackup(backupFilePath) {
    try {
      // Read backup file
      const backupData = await this._readFile(backupFilePath);
      
      // Create backup of current file before restoring
      await this._createBackup();
      
      // Write backup data to main file
      await this._writeFile(this.memoryFilePath, backupData);
      
      this.lastWriteTime = new Date();
      return true;
    } catch (error) {
      this.lastError = error;
      console.error("Failed to restore from backup:", error);
      return false;
    }
  }
  
  /**
   * Initialize a new memory file with template structure
   * @returns {Promise<boolean>} - Success indicator
   */
  async initializeNewMemoryFile() {
    try {
      // Check if file already exists
      try {
        await this._getFileInfo(this.memoryFilePath);
        console.warn("Memory file already exists, not initializing");
        return false;
      } catch (error) {
        // File doesn't exist, continue with initialization
      }
      
      // Create template memory structure
      const template = {
        metadata: {
          version: "1.0.0",
          last_updated: new Date().toISOString(),
          system_name: "Claude Memory System"
        },
        memory_instructions: {
          general_rules: [
            "Remember information about the user's identity, behaviors, preferences, goals, and relationships",
            "Create entities for recurring organizations, people, and significant events",
            "Connect entities using meaningful relations",
            "Store facts about entities as observations",
            "Compress short-term memories into long-term memories at the start of new sessions"
          ]
        },
        user_profile: {
          basic_identity: {
            name: null,
            pronouns: null,
            location: null,
            occupation: null,
            education: null,
            age: null,
            timezone: null
          },
          preferences: {
            communication_style: null,
            interests: []
          },
          goals: {
            stated_goals: [],
            inferred_goals: []
          }
        },
        short_term_memory: {
          entities: [],
          relations: [],
          session_metadata: {
            session_id: `session_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}_001`,
            start_time: new Date().toISOString(),
            end_time: null,
            platform: "Claude Web Interface",
            interaction_count: 0
          }
        },
        long_term_memory: {
          entities: [],
          relations: [],
          compressed_observations: [],
          memory_evolution: [
            {
              date: new Date().toISOString().split('T')[0],
              summary: "Initial memory system creation"
            }
          ]
        },
        system_capabilities: {
          supported_file_operations: ["read", "write", "edit", "list"],
          memory_persistence_enabled: true,
          compression_algorithm_version: "1.0.0"
        }
      };
      
      // Write template to file
      const jsonString = JSON.stringify(template, null, 2);
      await this._writeFile(this.memoryFilePath, jsonString);
      
      this.lastWriteTime = new Date();
      console.log("Initialized new memory file with template structure");
      
      return true;
    } catch (error) {
      this.lastError = error;
      console.error("Failed to initialize new memory file:", error);
      return false;
    }
  }
  
  // File system operation wrappers
  
  /**
   * Wrapper for file system read operation
   * @private
   * @param {string} path - File path
   * @returns {Promise<string>} - File contents
   */
  async _readFile(path) {
    return new Promise((resolve, reject) => {
      try {
        // Use MCP file system API if available
        read_file({ path }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.content);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        try {
          // Try browser-like API approach
          window.fs.readFile(path, { encoding: 'utf8' })
            .then(content => resolve(content))
            .catch(err => reject(err));
        } catch (fsError) {
          reject(new Error(`Failed to read file: ${error.message}, then ${fsError.message}`));
        }
      }
    });
  }
  
  /**
   * Wrapper for file system write operation
   * @private
   * @param {string} path - File path
   * @param {string} content - File content
   * @returns {Promise<void>}
   */
  async _writeFile(path, content) {
    return new Promise((resolve, reject) => {
      try {
        // Use MCP file system API if available
        write_file({ path, content }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        try {
          // Try browser-like API approach
          window.fs.writeFile(path, content)
            .then(() => resolve())
            .catch(err => reject(err));
        } catch (fsError) {
          reject(new Error(`Failed to write file: ${error.message}, then ${fsError.message}`));
        }
      }
    });
  }
  
  /**
   * Wrapper for file system directory listing
   * @private
   * @param {string} path - Directory path
   * @returns {Promise<Array>} - List of files
   */
  async _listDirectory(path) {
    return new Promise((resolve, reject) => {
      try {
        // Use MCP file system API if available
        list_directory({ path }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            // Extract filenames from result
            const files = result.entries
              .filter(entry => entry.startsWith('[FILE]'))
              .map(entry => entry.substring(7).trim());
            
            resolve(files);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        try {
          // Try browser-like API approach, though this is likely not available
          console.warn("list_directory MCP function not available, listing files may not work");
          resolve([]);
        } catch (fsError) {
          reject(new Error(`Failed to list directory: ${error.message}, then ${fsError.message}`));
        }
      }
    });
  }
  
  /**
   * Wrapper for file info operation
   * @private
   * @param {string} path - File path
   * @returns {Promise<Object>} - File info
   */
  async _getFileInfo(path) {
    return new Promise((resolve, reject) => {
      try {
        // Use MCP file system API if available
        get_file_info({ path }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        // Fallback if MCP function not available
        try {
          // Try browser-like API approach, though file stats might not be available
          console.warn("get_file_info MCP function not available, using simplified info");
          resolve({
            path,
            size: -1, // Unknown size
            mtime: new Date(), // Current time as fallback
            exists: true // Assume exists if no error above
          });
        } catch (fsError) {
          reject(new Error(`Failed to get file info: ${error.message}, then ${fsError.message}`));
        }
      }
    });
  }
}

export { PersistenceLayer };

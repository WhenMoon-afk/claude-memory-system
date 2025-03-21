# Claude Memory System

A persistent memory system for Claude AI using knowledge graph and file storage.

## Overview

This project implements a memory persistence mechanism for Claude AI that combines in-session knowledge graph capabilities with filesystem persistence through structured JSON files.

## Architecture

The system follows a modular architecture with six core components:

1. **Memory Manager**: Central orchestration component that coordinates all memory operations
2. **Knowledge Graph Handler**: Manages in-session entity and relation operations
3. **Persistence Layer**: Handles file read/write operations
4. **Compression Engine**: Implements algorithms for memory summarization
5. **Retrieval Service**: Manages memory access with prioritization
6. **Token Analyzer**: Monitors and optimizes token usage

```
┌────────────────────────────────────────┐
│              Memory Manager            │
└───────────────────┬────────────────────┘
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
┌───────────────┐ ┌─────────┐ ┌─────────────┐
│ Knowledge     │ │ Token   │ │ Persistence │
│ Graph Handler │ │ Analyzer│ │ Layer       │
└───────┬───────┘ └────┬────┘ └──────┬──────┘
        │              │             │
        ▼              ▼             ▼
┌───────────────┐ ┌────────────┐ ┌─────────────┐
│ Compression   │ │ Retrieval  │ │ Memory      │
│ Engine        │ │ Service    │ │ Schema      │
└───────────────┘ └────────────┘ └─────────────┘
```

For detailed architecture information, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Features

- **Knowledge Graph**: Utilizes MCP server-memory for in-session entity and relationship tracking
- **File Persistence**: Stores memory between sessions in structured JSON format
- **Hierarchical Memory**: Organizes memories by importance and recency
- **Memory Compression**: Implements algorithms to summarize and condense older memories
- **Token Efficiency**: Designed to minimize token usage in conversations
- **Semantic Similarity**: Detects related observations for intelligent compression
- **Weighted Retrieval**: Prioritizes memories based on relevance, recency, and confidence
- **Token Analysis**: Provides metrics and optimization suggestions for token usage

## Components

- `memory-manager.js`: Core orchestration component
- `knowledge-graph.js`: Entity and relation management
- `persistence-layer.js`: File operations for memory persistence
- `compression-engine.js`: Memory compression algorithms
- `retrieval-service.js`: Context-aware memory retrieval
- `token-analyzer.js`: Token usage monitoring and optimization
- `index.js`: Main entry point and API

## Usage

This system is designed to be used with Claude instances that have access to file system operations and knowledge graph capabilities.

### Basic Example

```javascript
import { initializeMemorySystem, recordObservation, saveMemory } from './src/index.js';

// Initialize memory system
const memoryManager = await initializeMemorySystem({
  memoryFilePath: 'path/to/memory.json'
});

// Record an observation
await recordObservation(
  memoryManager,
  'User',
  'Person',
  'Expressed interest in AI memory systems',
  {
    confidence: 5,
    category: 'preference',
    is_critical: true
  }
);

// Save all changes
await saveMemory(memoryManager);
```

## Development

This is an evolving project with continuous improvements planned for memory organization, compression, and retrieval capabilities.

### Priority Areas

1. Enhanced semantic similarity algorithms
2. Weighted importance ranking system
3. Token usage analytics and optimization
4. Hierarchical memory organization
5. Improved compression techniques

## License

MIT

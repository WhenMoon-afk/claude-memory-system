# Claude Memory System

A persistent memory system for Claude AI using knowledge graph and file storage.

## Overview

This project implements a memory persistence mechanism for Claude AI that combines in-session knowledge graph capabilities with filesystem persistence through structured JSON files.

## Features

- **Knowledge Graph**: Utilizes MCP server-memory for in-session entity and relationship tracking
- **File Persistence**: Stores memory between sessions in structured JSON format
- **Hierarchical Memory**: Organizes memories by importance and recency
- **Memory Compression**: Implements algorithms to summarize and condense older memories
- **Token Efficiency**: Designed to minimize token usage in conversations

## Structure

- `/src`: Core implementation code
- `/templates`: Memory structure templates
- `/docs`: Documentation

## Usage

This system is designed to be used with Claude instances that have access to file system operations and knowledge graph capabilities.

## Development

This is an evolving project with continuous improvements planned for memory organization, compression, and retrieval capabilities.

## License

MIT

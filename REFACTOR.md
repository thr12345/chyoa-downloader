# Refactoring Documentation

## Overview

This document describes the refactoring of the CHYOA Downloader from a single monolithic file (`index.ts` - 1,200+ lines) into a modular architecture with 6 focused files totaling the same functionality but with much better organization.

## Motivation

The original `index.ts` file had grown to over 1,200 lines with multiple responsibilities mixed together:
- CLI argument parsing
- Browser automation and authentication
- HTTP fetching and content extraction
- Image processing and conversion
- Multiple export formats (MD, JSON, combined files)
- File system operations
- Utility functions

This made the code difficult to:
- Test individual components
- Maintain and debug
- Extend with new features
- Follow single responsibility principle

## New Architecture

### File Structure

```
src/
├── types.ts      # Type definitions (53 lines)
├── utils.ts      # Utility functions and constants (114 lines)
├── auth.ts       # Authentication and session management (251 lines)
├── fetcher.ts    # Content fetching and story chain building (332 lines)
├── exporter.ts   # File exports and image processing (493 lines)
├── cli.ts        # CLI interface and main orchestration (418 lines)
└── index.ts      # Entry point and re-exports (20 lines)
```

### Module Responsibilities

#### 1. `types.ts` - Type Definitions
- **Purpose**: Centralized type definitions
- **Exports**: Interfaces for `StoryData`, `Chapter`, `AuthCredentials`, `SessionData`, `DownloaderConfig`, `CliArguments`
- **Benefits**: Type safety across modules, single source of truth for data structures

#### 2. `utils.ts` - Utility Functions
- **Purpose**: Reusable utility functions and constants
- **Key Functions**:
  - String sanitization (`sanitizeTitle`, `sanitizeFilename`)
  - File system operations (`ensureDirectory`, `ensureDirectories`)
  - URL manipulation (`makeAbsoluteUrl`, `getFilenameFromUrl`)
  - Image filtering and MIME type detection
- **Constants**: Base URLs, default settings, Puppeteer arguments
- **Benefits**: Centralized utilities, easy to test and reuse

#### 3. `auth.ts` - Authentication Manager
- **Purpose**: Handle all authentication-related functionality
- **Key Features**:
  - Browser initialization and management
  - Session persistence (save/load/cleanup)
  - Interactive authentication flow
  - Cookie management and validation
- **Class**: `AuthManager`
- **Benefits**: Isolated authentication logic, session management in one place

#### 4. `fetcher.ts` - Content Fetcher
- **Purpose**: Content retrieval and story chain building
- **Key Features**:
  - Story chain traversal (following parent links)
  - HTML fetching with both Puppeteer and HTTP
  - Content extraction using Cheerio
  - Cloudflare bypass handling
  - Static test methods for connectivity and cookies
- **Class**: `ContentFetcher`
- **Benefits**: Separation of fetching logic, easy to test different strategies

#### 5. `exporter.ts` - Story Exporter
- **Purpose**: Handle all export formats and image processing
- **Key Features**:
  - Multiple export formats (individual MD, combined MD, JSON)
  - Image downloading and processing
  - WebP conversion using Sharp
  - Base64 embedding for images
  - HTML to Markdown conversion
- **Class**: `StoryExporter`
- **Benefits**: All export logic in one place, easy to add new formats

#### 6. `cli.ts` - CLI Interface and Orchestration
- **Purpose**: Command line interface and main application logic
- **Key Features**:
  - Yargs configuration and argument parsing
  - Main orchestration logic (reduced `ChyoaDownloader` class)
  - Error handling and process management
  - Command implementations
- **Class**: `ChyoaDownloader` (slimmed down to orchestration only)
- **Benefits**: Clean separation of CLI from business logic

#### 7. `index.ts` - Entry Point
- **Purpose**: Main entry point and re-exports
- **Features**:
  - Re-exports all public classes and types
  - Handles direct execution for CLI usage
- **Benefits**: Clean public API, single import point

## Key Improvements

### 1. Modularity
- Each file has a single, clear responsibility
- Dependencies flow in one direction (no circular dependencies)
- Easy to understand what each module does

### 2. Testability
- Each class can be instantiated and tested independently
- Static methods for testing connectivity and authentication
- Dependency injection pattern used in main orchestrator

### 3. Maintainability
- Changes are isolated to specific modules
- Much easier to debug issues
- Clear boundaries between different concerns

### 4. Extensibility
- Easy to add new export formats by extending `StoryExporter`
- New authentication methods can be added to `AuthManager`
- Additional fetching strategies can be added to `ContentFetcher`

### 5. Type Safety
- Strong typing across all module boundaries
- Proper use of TypeScript's type-only imports
- Centralized type definitions

## Migration Benefits

### Before (Monolithic)
```typescript
// Everything in one 1,200+ line file
class ChyoaDownloader {
  // Authentication logic
  // Fetching logic  
  // Export logic
  // CLI logic
  // Utils mixed throughout
}
```

### After (Modular)
```typescript
// Clean separation of concerns
class ChyoaDownloader {
  constructor(config: DownloaderConfig) {
    this.authManager = new AuthManager(config.credentials);
    this.fetcher = new ContentFetcher(config.usePuppeteer);
    this.exporter = new StoryExporter(/* config params */);
  }
  
  async downloadStory(url: string) {
    // Just orchestration - delegates to specialized classes
  }
}
```

## Backwards Compatibility

- All CLI commands work exactly the same
- Same command-line interface and options
- No breaking changes to functionality
- Package.json updated to point to new structure

## Testing

The refactored code maintains the same functionality while being much easier to test:

```bash
# Test individual modules
bun test auth.test.js
bun test fetcher.test.js
bun test exporter.test.js

# Test CLI interface
bun run src/index.ts --help
bun run src/index.ts --test
```

## File Size Comparison

| File | Lines | Responsibility |
|------|-------|---------------|
| **Original** | | |
| `index.ts` | 1,200+ | Everything |
| **Refactored** | | |
| `types.ts` | 53 | Type definitions |
| `utils.ts` | 114 | Utilities & constants |
| `auth.ts` | 251 | Authentication |
| `fetcher.ts` | 332 | Content fetching |
| `exporter.ts` | 493 | Export & image processing |
| `cli.ts` | 418 | CLI & orchestration |
| `index.ts` | 20 | Entry point |
| **Total** | **1,681** | **Same functionality** |

The slight increase in total lines is due to:
- Proper module boundaries and imports
- Better documentation and type safety
- Cleaner separation of concerns
- Some code that was previously mixed is now properly organized

## Future Enhancements Made Easy

With this modular structure, future enhancements become much easier:

1. **New Export Formats**: Extend `StoryExporter` 
2. **New Authentication Methods**: Extend `AuthManager`
3. **New Fetching Strategies**: Extend `ContentFetcher`
4. **Additional CLI Commands**: Add to `cli.ts`
5. **New Utility Functions**: Add to `utils.ts`
6. **Additional Types**: Add to `types.ts`

Each enhancement can be developed and tested in isolation without affecting other parts of the system.
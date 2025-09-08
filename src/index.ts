#!/usr/bin/env node
import { cliEntry } from './cli';

// Re-export the main CLI functionality
export { ChyoaDownloader } from './cli';
export { AuthManager } from './auth';
export { ContentFetcher } from './fetcher';
export { StoryExporter } from './exporter';
export * from './types';
export * from './utils';

// If this file is run directly, execute the CLI
if (import.meta.main) {
  // Import and run the CLI
  cliEntry()
    .then(() => {
      // The CLI module handles its own execution in the main block
    })
    .catch((error) => {
      console.error('Failed to load CLI:', error);
      process.exit(1);
    });
}

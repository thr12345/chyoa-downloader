#!/usr/bin/env node
import path from 'path';
import { consola } from 'consola';
import { sys } from 'typescript';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AuthManager } from './auth.js';
import { StoryExporter } from './exporter.js';
import { ContentFetcher } from './fetcher.js';
import type {
  AuthCredentials,
  CliArguments,
  DownloaderConfig,
} from './types.js';
import {
  DEFAULT_OUTPUT_DIR,
  ensureDirectories,
  IMAGES_DIR,
  sanitizeFilename,
} from './utils.js';

export class ChyoaDownloader {
  private config: DownloaderConfig;
  private authManager: AuthManager;
  private fetcher: ContentFetcher;
  private exporter: StoryExporter;
  private outputDir: string;

  constructor(config: DownloaderConfig) {
    this.config = config;
    this.outputDir = config.baseOutputDir;

    this.authManager = new AuthManager(config.credentials);
    this.fetcher = new ContentFetcher(config.usePuppeteer);
    this.exporter = new StoryExporter(
      this.outputDir,
      config.convertToWebp,
      config.embedImages,
      config.singleFile,
      config.jsonFile,
    );
  }

  async downloadStory(storyUrl: string): Promise<void> {
    consola.start(`Chyoa Download starting for: ${storyUrl}`);

    try {
      let browser = null;
      let page = null;

      // Initialize browser if using Puppeteer
      if (this.config.usePuppeteer) {
        // Try to load saved session first
        await this.authManager.loadSavedSession();

        const browserResult = await this.authManager.initializeBrowser();
        browser = browserResult.browser;
        page = browserResult.page;

        // Set up authentication after browser is ready
        const sessionValid =
          await this.authManager.setupAuthenticationAfterBrowser();

        // Update fetcher and exporter with page reference
        this.fetcher = new ContentFetcher(this.config.usePuppeteer, page);
        this.exporter = new StoryExporter(
          this.outputDir,
          this.config.convertToWebp,
          this.config.embedImages,
          this.config.singleFile,
          this.config.jsonFile,
          page,
        );

        // Check if we need authentication
        const credentials = this.authManager.getCredentials();
        if (
          !sessionValid &&
          !credentials.sessionCookie &&
          !credentials.username
        ) {
          // No credentials at all, need to authenticate
          console.log(
            '🔐 Authentication required for full story access (including images)',
          );

          const interactive = await consola.prompt(
            'Would you like to log in interactively?',
            {
              type: 'confirm',
              cancel: 'undefined',
            },
          );

          if (interactive === undefined) {
            console.log('Process canceled');
            sys.exit(1);
          }

          if (interactive) {
            // Close current browser and open visible one for login
            await this.authManager.closeBrowser();

            const visibleBrowserResult =
              await this.authManager.initializeBrowser(false);
            browser = visibleBrowserResult.browser;
            page = visibleBrowserResult.page;

            // Update references again
            this.fetcher = new ContentFetcher(this.config.usePuppeteer, page);
            this.exporter = new StoryExporter(
              this.outputDir,
              this.config.convertToWebp,
              this.config.embedImages,
              this.config.singleFile,
              this.config.jsonFile,
              page,
            );

            const loginSuccess = await this.authManager.promptUserLogin();
            if (!loginSuccess) {
              console.log(
                "Continuing without authentication - you'll get placeholder images.",
              );
            }
          } else {
            console.log(
              "Continuing without authentication - you'll get placeholder images.",
            );
          }
        } else if (!sessionValid && credentials.sessionCookie) {
          // Had a session but it was invalid, offer to re-authenticate
          console.log('🔐 Saved session is invalid, authentication required');

          const readline = require('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const response = await new Promise<string>((resolve) => {
            rl.question(
              'Would you like to log in again? (y/n): ',
              (answer: string) => {
                rl.close();
                resolve(answer.trim().toLowerCase());
              },
            );
          });

          if (response === 'y' || response === 'yes') {
            // Close current browser and open visible one for login
            await this.authManager.closeBrowser();

            const visibleBrowserResult =
              await this.authManager.initializeBrowser(false);
            browser = visibleBrowserResult.browser;
            page = visibleBrowserResult.page;

            // Update references again
            this.fetcher = new ContentFetcher(this.config.usePuppeteer, page);
            this.exporter = new StoryExporter(
              this.outputDir,
              this.config.convertToWebp,
              this.config.embedImages,
              this.config.singleFile,
              this.config.jsonFile,
              page,
            );

            const loginSuccess = await this.authManager.promptUserLogin();
            if (!loginSuccess) {
              console.log(
                "Continuing without authentication - you'll get placeholder images.",
              );
            }
          }
        }
      }

      // Get the target story data first to create the story-specific directory
      const targetStoryData = await this.fetcher.fetchStoryData(storyUrl);
      const storyDirName = sanitizeFilename(targetStoryData.title);
      this.outputDir = path.join(this.config.baseOutputDir, storyDirName);

      // Update exporter with new output directory
      this.exporter = new StoryExporter(
        this.outputDir,
        this.config.convertToWebp,
        this.config.embedImages,
        this.config.singleFile,
        this.config.jsonFile,
        page,
      );

      // Create output directories
      await ensureDirectories(
        this.outputDir,
        IMAGES_DIR,
        this.config.embedImages,
      );

      // Get the story chain (current story + all parents)
      const storyChain = await this.fetcher.getStoryChain(storyUrl);

      console.log(`Found ${storyChain.length} stories in the chain`);
      console.log(`Saving to: ${this.outputDir}`);

      // Download each story
      for (let i = 0; i < storyChain.length; i++) {
        const story = storyChain[i];
        console.log(
          `Downloading story ${i + 1}/${storyChain.length}: ${story.title}`,
        );

        // Process images for this story
        await this.exporter.processImages(story);

        // Save story based on configured format
        await this.exporter.saveStory(story, i);
      }

      // Finalize any combined exports
      await this.exporter.finalizeSave();

      console.log('Download completed!');
    } finally {
      // Clean up browser
      await this.authManager.closeBrowser();

      // Ensure process exits
      process.exit(0);
    }
  }
}

// CLI setup and main function
const argv = (await yargs(hideBin(process.argv))
  .usage('Usage: $0 [url] [options]')
  .command('$0 [url]', 'Download a CHYOA story', (yargs) => {
    return yargs.positional('url', {
      type: 'string',
      description: 'CHYOA story URL to download',
      demandOption: false,
    });
  })
  .option('username', {
    type: 'string',
    description: 'CHYOA username for authentication (optional)',
  })
  .option('password', {
    type: 'string',
    description: 'CHYOA password for authentication (optional)',
  })
  .option('cookie', {
    alias: 'c',
    type: 'string',
    description: 'Session cookie for authentication (optional)',
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output directory for downloaded stories',
    default: DEFAULT_OUTPUT_DIR,
  })
  .option('test', {
    type: 'boolean',
    description: 'Test connectivity to CHYOA (no download)',
    default: false,
  })
  .option('test-cookies', {
    type: 'boolean',
    description: 'Test if provided cookies work for authentication',
    default: false,
  })
  .option('clear-session', {
    type: 'boolean',
    description: 'Clear saved session and force re-authentication',
    default: false,
  })
  .option('no-puppeteer', {
    type: 'boolean',
    description: 'Disable Puppeteer and use direct HTTP requests',
    default: false,
  })
  .option('no-webp', {
    type: 'boolean',
    description: 'Disable WebP conversion (keeps original image formats)',
    default: false,
  })
  .option('embed-images', {
    type: 'boolean',
    description:
      'Embed images as base64 data URLs in markdown instead of saving to files',
    default: false,
  })
  .option('single-file', {
    type: 'boolean',
    description:
      'Save all chapters to a single markdown file instead of separate files',
    default: false,
  })
  .option('json-file', {
    type: 'boolean',
    description:
      'Export chapters as JSON instead of markdown (mutually exclusive with --single-file)',
    default: false,
  })
  .help()
  .alias('help', 'h')
  .example(
    '$0 "https://chyoa.com/chapter/example"',
    'Download a story with interactive login if needed',
  )
  .example(
    '$0 "https://chyoa.com/chapter/example" -c "session=abc123"',
    'Download with manual session cookie',
  )
  .example(
    '$0 "https://chyoa.com/chapter/example" --no-puppeteer',
    'Download with direct HTTP requests (may be blocked)',
  )
  .example(
    '$0 "https://chyoa.com/chapter/example" --embed-images',
    'Embed images as base64 in markdown instead of saving files',
  )
  .example(
    '$0 "https://chyoa.com/chapter/example" --single-file',
    'Save all chapters to one markdown file',
  )
  .example(
    '$0 "https://chyoa.com/chapter/example" --no-webp',
    'Keep original image formats instead of converting to WebP',
  )
  .example(
    '$0 "https://chyoa.com/chapter/example" --json-file',
    'Export chapters as JSON instead of markdown',
  )
  .example(
    '$0 "https://chyoa.com/chapter/example" --json-file --embed-images',
    'Export as JSON with images embedded as base64 in content',
  ).argv) as CliArguments;

export async function cliEntry() {
  consola.wrapConsole();

  try {
    // Handle session clearing
    if (argv['clear-session']) {
      const authManager = new AuthManager({});
      await authManager.clearSession();
      if (!argv.url) {
        console.log('Session cleared successfully!');
        process.exit(0);
      }
    }

    // Add a simple connectivity test
    if (argv.test) {
      await ContentFetcher.testConnectivity();
      return;
    }

    // Test cookies specifically
    if (argv['test-cookies']) {
      if (!argv.cookie) {
        console.error('Error: --cookie is required for cookie testing');
        console.log(
          'Use: bun run index.ts --test-cookies -c "your_cookies_here"',
        );
        process.exit(1);
      }

      await ContentFetcher.testCookies(argv.cookie);
      return;
    }

    if (
      !argv.url &&
      !argv.test &&
      !argv['test-cookies'] &&
      !argv['clear-session']
    ) {
      console.error(
        'Error: URL is required (unless using --test, --test-cookies, or --clear-session)',
      );
      console.log('Use --help for usage information');
      process.exit(1);
    }

    const credentials: AuthCredentials = {};

    if (argv.username && argv.password) {
      credentials.username = argv.username;
      credentials.password = argv.password;
    }

    if (argv.cookie) {
      credentials.sessionCookie = argv.cookie;
    }

    const usePuppeteer = !argv['no-puppeteer'];
    const convertToWebp = !argv['no-webp'];
    const embedImages = argv['embed-images'] || false;
    const singleFile = argv['single-file'] || false;
    const jsonFile = argv['json-file'] || false;

    // Validate mutually exclusive options
    if (singleFile && jsonFile) {
      console.error(
        'Error: --single-file and --json-file are mutually exclusive',
      );
      process.exit(1);
    }

    const outputDir = argv.output || DEFAULT_OUTPUT_DIR;

    const config: DownloaderConfig = {
      credentials,
      baseOutputDir: outputDir,
      usePuppeteer,
      convertToWebp,
      embedImages,
      singleFile,
      jsonFile,
    };

    // If we have username/password but no session cookie, we need to authenticate first
    if (
      credentials.username &&
      credentials.password &&
      !credentials.sessionCookie
    ) {
      console.log('⚠️  Username/password authentication not yet implemented.');
      console.log('');
      console.log('🔧 AUTHENTICATION OPTIONS:');
      console.log('');
      console.log('📋 OPTION 1: Interactive Login (Recommended)');
      console.log('Run without -c flag and the app will prompt you to log in');
      console.log('');
      console.log('📋 OPTION 2: Manual Cookie Extraction');
      console.log('1. Log into chyoa.com in your browser');
      console.log('2. Open Developer Tools (F12) > Application > Cookies');
      console.log('3. Copy the cookies from https://chyoa.com');
      console.log(
        '4. Run: chyoa-download -u "STORY_URL" -c "laravel_session=...; other_cookie=..."',
      );
      console.log('');
      console.log(
        "💡 Note: Without authentication, you'll get placeholder images",
      );
      console.log(
        "   with 'Please log in to view the image' instead of actual story images.",
      );
      process.exit(1);
    }

    if (usePuppeteer) {
      console.debug('🚀 Using Puppeteer to bypass Cloudflare protection');
    } else {
      console.info('Using direct HTTP requests (may be blocked by Cloudflare)');
    }

    const downloader = new ChyoaDownloader(config);

    if (argv.url) {
      await downloader.downloadStory(argv.url);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cliEntry().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

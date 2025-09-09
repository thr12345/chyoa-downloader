import { existsSync, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import type { AuthCredentials, SessionData } from './types.js';
import {
  BASE_URL,
  DEFAULT_USER_AGENT,
  ensureDirectory,
  PUPPETEER_ARGS,
  SESSION_MAX_AGE,
} from './utils.js';

export class AuthManager {
  private credentials: AuthCredentials;
  private sessionFile: string;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(credentials: AuthCredentials) {
    this.credentials = credentials;

    // Store session file in user's config directory
    const configDir = path.join(os.homedir(), '.config', 'chyoa-download');
    this.sessionFile = path.join(configDir, 'session.json');
  }

  async initializeBrowser(
    headless = true,
  ): Promise<{ browser: Browser; page: Page }> {
    console.debug('Starting browser...');

    this.browser = await puppeteer.launch({
      headless: headless,
      args: PUPPETEER_ARGS,
    });

    this.page = await this.browser.newPage();

    // Set viewport and user agent
    await this.page.setViewport({ width: 1366, height: 768 });
    await this.page.setUserAgent(DEFAULT_USER_AGENT);

    return { browser: this.browser, page: this.page };
  }

  private async setupAuthentication(): Promise<void> {
    if (!this.page) return;

    // Navigate to the base URL first
    await this.page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Parse and set cookies
    if (this.credentials.sessionCookie) {
      const cookies = this.credentials.sessionCookie
        .split(';')
        .map((cookie) => {
          const [name, value] = cookie.trim().split('=');
          return {
            name: name.trim(),
            value: value?.trim() || '',
            domain: '.chyoa.com',
            path: '/',
          };
        });

      for (const cookie of cookies) {
        if (cookie.name && cookie.value) {
          await this.page.setCookie(cookie);
        }
      }
      console.log(`Set ${cookies.length} authentication cookies`);

      // Test authentication by trying to access a protected resource
      console.log('Testing authentication...');
      await this.page.reload({ waitUntil: 'networkidle0' });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async checkAuthentication(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Navigate to CHYOA and check if we're logged in
      await this.page.goto(BASE_URL, { waitUntil: 'networkidle0' });

      // Check if user profile link exists (indicates logged in)
      const profileLink = await this.page.$('a[href*="/user/"]');
      const loginButton = await this.page.$('a[href*="/login"]');

      // If we have a profile link and no login button, we're authenticated
      return profileLink !== null && loginButton === null;
    } catch (error) {
      console.warn('Error checking authentication:', error);
      return false;
    }
  }

  async promptUserLogin(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log('🌐 Opening browser for login...');
      console.log('Please log in to your CHYOA account in the browser window.');
      console.log('After logging in, press Enter here to continue...');

      // Navigate to login page
      await this.page.goto(`${BASE_URL}/auth/login`, {
        waitUntil: 'networkidle0',
      });

      // Wait for user input
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      await new Promise<void>((resolve) => {
        rl.question('Press Enter after logging in...', () => {
          rl.close();
          resolve();
        });
      });

      // Check if login was successful
      const isAuthenticated = await this.checkAuthentication();

      if (isAuthenticated) {
        console.log('✅ Successfully authenticated!');

        // Extract session cookies for future use
        const cookies = await this.page.cookies();
        const sessionCookies = cookies
          .map((cookie) => `${cookie.name}=${cookie.value}`)
          .join('; ');

        this.credentials.sessionCookie = sessionCookies;
        console.log('🍪 Session cookies saved for this session.');

        // Save session to file for future use
        await this.saveSession();

        return true;
      } else {
        console.log('❌ Authentication failed or not completed.');
        return false;
      }
    } catch (error) {
      console.error('Error during login process:', error);
      return false;
    }
  }

  async saveSession(): Promise<void> {
    try {
      if (this.credentials.sessionCookie) {
        // Ensure session directory exists
        const sessionDir = path.dirname(this.sessionFile);
        await ensureDirectory(sessionDir);

        const sessionData: SessionData = {
          cookies: this.credentials.sessionCookie,
          timestamp: Date.now(),
        };
        await fs.writeFile(
          this.sessionFile,
          JSON.stringify(sessionData, null, 2),
        );
        console.log('💾 Session saved for future use');
      }
    } catch (error) {
      console.warn('Failed to save session:', error);
    }
  }

  async loadSavedSession(): Promise<void> {
    try {
      if (existsSync(this.sessionFile)) {
        const sessionData: SessionData = JSON.parse(
          await fs.readFile(this.sessionFile, 'utf-8'),
        );

        // Check if session is not too old (24 hours)
        const sessionAge = Date.now() - sessionData.timestamp;
        console.log(
          `🔍 Debug: Session age: ${sessionAge}ms (${Math.round(sessionAge / 1000 / 60)} minutes)`,
        );
        console.log(
          `🔍 Debug: Max age: ${SESSION_MAX_AGE}ms (${SESSION_MAX_AGE / 1000 / 60 / 60} hours)`,
        );

        if (sessionAge < SESSION_MAX_AGE && sessionData.cookies) {
          this.credentials.sessionCookie = sessionData.cookies;
          console.log('🔄 Restored saved session from previous run');
          // Don't call setupAuthentication here - wait for browser to be ready
        } else {
          console.log('⏰ Saved session expired, will need to re-authenticate');
          // Remove expired session file
          await this.cleanupSessionFile();
        }
      }
    } catch (error) {
      console.warn('Failed to load saved session:', error);
      // Remove corrupted session file
      await this.cleanupSessionFile();
    }
  }

  async setupAuthenticationAfterBrowser(): Promise<boolean> {
    if (this.credentials.sessionCookie) {
      console.log('Setting up authentication cookies...');
      await this.setupAuthentication();

      // Verify the session is still valid
      const isValid = await this.checkAuthentication();
      if (!isValid) {
        console.log('⚠️  Saved session expired, will need to re-authenticate');
        this.credentials.sessionCookie = undefined;
        // Remove expired session file
        await this.cleanupSessionFile();
        return false;
      } else {
        console.log('✅ Saved session is still valid');
        return true;
      }
    }
    return false;
  }

  async cleanupSessionFile(): Promise<void> {
    try {
      await fs.unlink(this.sessionFile);
    } catch (error) {
      // Ignore errors when cleaning up session file
    }
  }

  async clearSession(): Promise<void> {
    try {
      await fs.unlink(this.sessionFile);
      console.log('🗑️  Cleared saved session');
    } catch (error) {
      console.log('No saved session to clear');
    }
  }

  getCredentials(): AuthCredentials {
    return this.credentials;
  }

  updateCredentials(credentials: Partial<AuthCredentials>): void {
    this.credentials = { ...this.credentials, ...credentials };
  }
}

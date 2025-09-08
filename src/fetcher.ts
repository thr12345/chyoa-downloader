import * as cheerio from 'cheerio';
import { Page } from 'puppeteer';
import type { StoryData } from './types.js';
import {
  BASE_URL,
  DEFAULT_USER_AGENT,
  isValidStoryImage,
  makeAbsoluteUrl,
  randomDelay,
  sanitizeTitle,
} from './utils.js';

export class ContentFetcher {
  private usePuppeteer: boolean;
  private page: Page | null = null;

  constructor(usePuppeteer: boolean, page: Page | null = null) {
    this.usePuppeteer = usePuppeteer;
    this.page = page;
  }

  async getStoryChain(storyUrl: string): Promise<StoryData[]> {
    const stories: StoryData[] = [];
    const visitedUrls = new Set<string>();
    let currentUrl = storyUrl;

    while (currentUrl && !visitedUrls.has(currentUrl)) {
      console.log(`Fetching story data from: ${currentUrl}`);
      visitedUrls.add(currentUrl);
      const storyData = await this.fetchStoryData(currentUrl);
      stories.unshift(storyData); // Add to beginning to maintain parent -> child order
      currentUrl = storyData.parentUrl || '';
    }

    if (currentUrl && visitedUrls.has(currentUrl)) {
      console.log(
        `Cycle detected at: ${currentUrl}. Stopping story chain traversal.`,
      );
    }

    return stories;
  }

  async fetchStoryData(storyUrl: string): Promise<StoryData> {
    try {
      let html: string;

      if (this.usePuppeteer && this.page) {
        // Use Puppeteer to fetch the page
        html = await this.fetchWithPuppeteer(storyUrl);
      } else {
        // Fallback to direct HTTP request
        html = await this.fetchWithHttp(storyUrl);
      }

      const $ = cheerio.load(html);

      // Extract story title - try multiple selectors for CHYOA
      let title =
        $('h1.chapter-title').first().text().trim() ||
        $('.chapter-title').first().text().trim() ||
        $('h1').first().text().trim() ||
        $('.story-title').first().text().trim() ||
        $('title').text().replace(' - CHYOA', '').trim() ||
        'Untitled Story';

      // Clean up title by removing extra parts
      title = title.replace(/Chapter \d+/, '').trim();

      // Extract story content - focus ONLY on chapter-content div
      let content = '';
      const chapterContentDiv = $('.chapter-content').first();

      if (chapterContentDiv.length > 0) {
        content = chapterContentDiv.html() || '';
      } else {
        // Fallback: Look for other story content containers
        const mainContent = $(
          '.chapter-text, .story-content, #chapter-text',
        ).first();
        if (mainContent.length > 0) {
          content = mainContent.html() || '';
        }
      }

      // Extract images ONLY from the chapter-content div
      const images: string[] = [];

      if (chapterContentDiv.length > 0) {
        chapterContentDiv.find('img').each((_, img) => {
          const src = $(img).attr('src');

          if (src && isValidStoryImage(src)) {
            // Convert relative URLs to absolute
            const absoluteUrl = makeAbsoluteUrl(src);
            images.push(absoluteUrl);
          }
        });
      }

      // Find parent story link - look for "Previous Chapter" only
      let parentUrl: string | undefined;
      const currentStoryId = storyUrl.split('/').pop()?.split('.')[1]; // Extract story ID

      // Only look for "Previous Chapter" link - this is the most reliable indicator of story chain
      $('a').each((_, link) => {
        const href = $(link).attr('href');
        const text = $(link).text().trim();

        if (
          href &&
          href.includes('/chapter/') &&
          href !== storyUrl &&
          text === 'Previous Chapter'
        ) {
          const linkStoryId = href.split('/').pop()?.split('.')[1];
          if (linkStoryId && linkStoryId !== currentStoryId) {
            parentUrl = makeAbsoluteUrl(href);
            return false; // Break out of loop
          }
        }
      });

      return {
        url: storyUrl,
        title: sanitizeTitle(title),
        content,
        images,
        parentUrl,
      };
    } catch (error) {
      console.error(`Error fetching story data from ${storyUrl}:`);
      if (error instanceof Error) {
        console.error(`  ${error.message}`);
      }
      throw error;
    }
  }

  private async fetchWithPuppeteer(storyUrl: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    console.log(`Fetching with browser: ${storyUrl}`);

    // Add human-like delay
    await randomDelay();

    try {
      // Navigate to the story page
      const response = await this.page.goto(storyUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      if (!response) {
        throw new Error('Failed to load page');
      }

      // Wait a bit more for any dynamic content
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if we're still being challenged
      const title = await this.page.title();
      if (title.includes('Just a moment')) {
        // Wait longer for Cloudflare challenge to complete
        console.log('Waiting for Cloudflare challenge to complete...');
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Check if challenge completed
        const newTitle = await this.page.title();
        if (newTitle.includes('Just a moment')) {
          throw new Error(
            'Cloudflare challenge did not complete. The page may require manual verification.',
          );
        }
      }

      // Get the page content
      const html = await this.page.content();

      if (html.includes('Just a moment...') || html.includes('__cf_chl_')) {
        throw new Error(
          'Still being challenged by Cloudflare after waiting. Try using fresh cookies or waiting longer.',
        );
      }

      console.log(`✅ Successfully loaded page (${html.length} characters)`);
      return html;
    } catch (error) {
      console.error('Puppeteer navigation failed:', error);
      throw error;
    }
  }

  private async fetchWithHttp(
    storyUrl: string,
    sessionCookie?: string,
  ): Promise<string> {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Upgrade-Insecure-Requests': '1',
    };

    // Add authentication if available
    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    // Add referer for subsequent requests (not first)
    if (storyUrl !== BASE_URL) {
      headers['Referer'] = BASE_URL;
    }

    // Add small delay to appear more human-like
    await randomDelay();

    const response = await fetch(storyUrl, {
      headers,
      redirect: 'follow',
      credentials: 'include',
    });

    // Get the response content
    const html = await response.text();

    // Check if we're being redirected to a login page or blocked by Cloudflare
    if (
      html.includes('Just a moment...') ||
      html.includes('__cf_chl_') ||
      html.includes('challenge-platform')
    ) {
      throw new Error(
        'Blocked by Cloudflare protection. Consider using --puppeteer flag or fresh cookies.',
      );
    }

    // Check for specific error conditions
    if (!response.ok) {
      if (response.status === 403) {
        // Check if it's an authentication issue or Cloudflare
        if (html.includes('login') && html.includes('password')) {
          throw new Error(
            `Authentication required. Please provide valid credentials or check your session cookie.`,
          );
        } else {
          throw new Error(
            `Access forbidden (${response.status}). This might be due to Cloudflare protection, invalid session cookie, or content restrictions.`,
          );
        }
      } else if (response.status === 404) {
        throw new Error(
          `Story not found (${response.status}). Please check the URL.`,
        );
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    if (
      html.includes('login') &&
      html.includes('password') &&
      html.length < 10000
    ) {
      throw new Error(
        'Redirected to login page. Please provide valid authentication credentials.',
      );
    }

    return html;
  }

  // Test connectivity to CHYOA
  static async testConnectivity(): Promise<void> {
    console.log('Testing connectivity to CHYOA...');
    try {
      const testResponse = await fetch(BASE_URL, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
        },
      });
      console.log(`Test response: ${testResponse.status}`);
      const testHtml = await testResponse.text();
      console.log(`Response length: ${testHtml.length} characters`);
      console.log(
        `Cloudflare challenge: ${testHtml.includes('Just a moment...') ? 'YES' : 'NO'}`,
      );
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  }

  // Test authentication cookies
  static async testCookies(sessionCookie: string): Promise<void> {
    console.log('Testing authentication cookies...');
    try {
      // Test with a simple CHYOA page that requires auth
      const testUrl = `${BASE_URL}/user/profile`; // User profile page
      const headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        Cookie: sessionCookie,
      };

      console.log('Testing cookie authentication...');
      const testResponse = await fetch(testUrl, { headers });
      const testHtml = await testResponse.text();

      console.log(`Response status: ${testResponse.status}`);
      console.log(`Response length: ${testHtml.length} characters`);
      console.log(
        `Cloudflare challenge: ${testHtml.includes('Just a moment...') ? 'YES' : 'NO'}`,
      );

      if (
        testResponse.status === 200 &&
        !testHtml.includes('Just a moment...')
      ) {
        console.log('✅ Cookies appear to be working!');
        console.log('You can now try downloading a story.');
      } else if (testHtml.includes('Just a moment...')) {
        console.log('❌ Still being challenged by Cloudflare');
        console.log('Try refreshing your cookies or waiting longer.');
      } else {
        console.log(`⚠️  Unexpected response (${testResponse.status})`);
        console.log('Your cookies might be expired or invalid.');
      }
    } catch (error) {
      console.error('Cookie test failed:', error);
      throw error;
    }
  }
}

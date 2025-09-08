import { promises as fs } from "fs";
import path from "path";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { Page } from "puppeteer";

import type { StoryData, Chapter } from "./types.js";
import {
  BASE_URL,
  IMAGES_DIR,
  sanitizeFilename,
  cleanHtmlEntities,
  getFilenameFromUrl,
  convertToWebpFilename,
  getMimeTypeFromExtension,
} from "./utils.js";

export class StoryExporter {
  private outputDir: string;
  private convertToWebp: boolean;
  private embedImages: boolean;
  private singleFile: boolean;
  private jsonFile: boolean;
  private page: Page | null = null;
  private combinedStories: Array<{ story: StoryData; index: number }> = [];
  private chapters: Chapter[] = [];

  constructor(
    outputDir: string,
    convertToWebp: boolean,
    embedImages: boolean,
    singleFile: boolean,
    jsonFile: boolean,
    page: Page | null = null,
  ) {
    this.outputDir = outputDir;
    this.convertToWebp = convertToWebp;
    this.embedImages = embedImages;
    this.singleFile = singleFile;
    this.jsonFile = jsonFile;
    this.page = page;
  }

  async processImages(story: StoryData): Promise<void> {
    if (story.images.length === 0) {
      return;
    }

    console.log(
      `Processing ${story.images.length} images for "${story.title}"`,
    );

    const processedImages = new Set<string>();

    for (let i = 0; i < story.images.length; i++) {
      const imageUrl = story.images[i];
      const filename = getFilenameFromUrl(imageUrl, `image_${i}.jpg`);

      if (!processedImages.has(filename)) {
        try {
          if (this.embedImages) {
            await this.processImageForEmbedding(imageUrl, story, i);
          } else {
            await this.downloadImage(imageUrl, story.title, i);
          }
          processedImages.add(filename);
        } catch (error) {
          console.warn(`Failed to process image ${imageUrl}:`, error);
        }
      }
    }
  }

  private async downloadImage(
    imageUrl: string,
    storyTitle: string,
    index: number,
  ): Promise<void> {
    if (!this.page) {
      console.warn("No browser page available for image download");
      return;
    }

    try {
      const fullUrl = imageUrl.startsWith("http")
        ? imageUrl
        : `${BASE_URL}${imageUrl}`;

      console.log(`Downloading image via browser: ${fullUrl}`);

      // Get filename from URL
      let filename = getFilenameFromUrl(
        fullUrl,
        `${sanitizeFilename(storyTitle)}_${index}.jpg`,
      );
      const originalExtension = path.extname(filename);

      // Convert extension to webp if conversion is enabled
      if (this.convertToWebp) {
        filename = convertToWebpFilename(filename);
      }

      const filepath = path.join(this.outputDir, IMAGES_DIR, filename);

      // For protected images, try to get the actual image if authentication works
      if (fullUrl.includes("default.jpg")) {
        console.log("⚠️  Protected image detected - skipping placeholder");
        // Skip downloading placeholder images entirely
        return;
      }

      // Navigate to the image URL using the authenticated browser session
      const response = await this.page.goto(fullUrl, {
        waitUntil: "networkidle0",
        timeout: 15000,
      });

      if (!response || !response.ok()) {
        console.warn(
          `Failed to load image ${fullUrl}: HTTP ${response?.status() || "unknown"}`,
        );
        return;
      }

      // Get the image as buffer
      let buffer = await response.buffer();

      if (!buffer || buffer.length === 0) {
        console.warn(`Empty image buffer for ${fullUrl}`);
        return;
      }

      // Convert to WebP if enabled
      if (this.convertToWebp) {
        try {
          buffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
          console.log(
            `✅ Downloaded and converted image: ${filename} (${buffer.length} bytes)`,
          );
        } catch (conversionError) {
          console.warn(
            `Failed to convert image to WebP, saving original:`,
            conversionError,
          );
          // Fallback to original format
          filename = filename.replace(".webp", originalExtension);
        }
      } else {
        console.log(
          `✅ Downloaded image: ${filename} (${buffer.length} bytes)`,
        );
      }

      await fs.writeFile(filepath, buffer);
    } catch (error) {
      console.warn(`Failed to download image ${imageUrl}:`, error);
    }
  }

  private async processImageForEmbedding(
    imageUrl: string,
    story: StoryData,
    index: number,
  ): Promise<void> {
    if (!this.page) {
      console.warn("No browser page available for image processing");
      return;
    }

    try {
      const fullUrl = imageUrl.startsWith("http")
        ? imageUrl
        : `${BASE_URL}${imageUrl}`;

      console.log(`Processing image for embedding: ${fullUrl}`);

      // For protected images, skip placeholder images
      if (fullUrl.includes("default.jpg")) {
        console.log("⚠️  Protected image detected - skipping placeholder");
        return;
      }

      // Navigate to the image URL using the authenticated browser session
      const response = await this.page.goto(fullUrl, {
        waitUntil: "networkidle0",
        timeout: 15000,
      });

      if (!response || !response.ok()) {
        console.warn(
          `Failed to load image ${fullUrl}: HTTP ${response?.status() || "unknown"}`,
        );
        return;
      }

      // Get the image as buffer
      let buffer = await response.buffer();

      if (!buffer || buffer.length === 0) {
        console.warn(`Empty image buffer for ${fullUrl}`);
        return;
      }

      // Convert to WebP if enabled
      let mimeType = "image/jpeg";
      if (this.convertToWebp) {
        try {
          buffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
          mimeType = "image/webp";
        } catch (conversionError) {
          console.warn(
            `Failed to convert image to WebP for embedding:`,
            conversionError,
          );
          // Keep original buffer and detect mime type
          const originalUrl = new URL(fullUrl);
          const ext = path.extname(originalUrl.pathname);
          mimeType = getMimeTypeFromExtension(ext);
        }
      } else {
        // Detect mime type from original
        const originalUrl = new URL(fullUrl);
        const ext = path.extname(originalUrl.pathname);
        mimeType = getMimeTypeFromExtension(ext);
      }

      // Convert to base64 and update story content
      const base64 = buffer.toString("base64");
      const base64DataUrl = `data:${mimeType};base64,${base64}`;

      // Replace the image URL in the story content with the base64 data URL
      story.content = story.content.replace(
        new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        base64DataUrl,
      );

      console.log(
        `✅ Embedded image as base64 (${buffer.length} bytes -> ${base64.length} chars)`,
      );
    } catch (error) {
      console.warn(`Failed to process image for embedding ${imageUrl}:`, error);
    }
  }

  private convertHtmlToMarkdown(html: string): string {
    if (!html || html.trim().length === 0) {
      return "";
    }

    const $ = cheerio.load(html);

    // Process images first - replace with markdown syntax
    $("img").each((_, img) => {
      const src = $(img).attr("src") || "";
      const alt = $(img).attr("alt") || "";

      if (src) {
        let imageSrc = src;

        // If not embedding images, convert to local file path
        if (!this.embedImages) {
          // Get the filename from the URL and convert to WebP if needed
          let filename = getFilenameFromUrl(src);

          if (this.convertToWebp && !filename.toLowerCase().endsWith(".webp")) {
            filename = convertToWebpFilename(filename);
          }

          imageSrc = `${IMAGES_DIR}/${filename}`;
        }
        // If embedding images, src should already be a base64 data URL from processImageForEmbedding

        // Replace with markdown image syntax
        $(img).replaceWith(`![${alt}](${imageSrc})`);
      }
    });

    // Convert basic HTML formatting to markdown
    $("strong, b").each((_, el) => {
      $(el).replaceWith(`**${$(el).text()}**`);
    });

    $("em, i").each((_, el) => {
      $(el).replaceWith(`*${$(el).text()}*`);
    });

    // Remove links but keep text content
    $("a").each((_, el) => {
      $(el).replaceWith($(el).text());
    });

    // Convert paragraphs to clean markdown with proper spacing
    let markdown = "";

    $("p").each((_, p) => {
      const text = $(p).html() || "";
      if (text.trim()) {
        // Clean up HTML tags and entities
        const cleanText = text
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]*>/g, "") // Remove remaining HTML tags
          .replace(/&quot;/g, '"') // Convert HTML entities
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();

        if (cleanText) {
          markdown += cleanText + "\n\n";
        }
      }
    });

    // If no paragraphs found, fall back to simple text extraction
    if (!markdown.trim()) {
      markdown = $.text().replace(/\s+/g, " ").trim();
    }

    // Clean up and format the final markdown
    markdown = markdown
      .replace(/\n\s*\n\s*\n+/g, "\n\n") // Normalize line breaks
      .replace(/!\[([^\]]*)\]\(([^)]*)\)\s*([A-Z])/g, "![$1]($2)\n\n$3") // Space after images
      .trim();

    return markdown;
  }

  async saveStory(story: StoryData, index: number): Promise<void> {
    if (this.jsonFile) {
      this.collectChapter(story);
    } else if (this.singleFile) {
      this.combinedStories.push({ story, index });
    } else {
      await this.saveStoryAsMarkdown(story, index);
    }
  }

  private async saveStoryAsMarkdown(
    story: StoryData,
    index: number,
  ): Promise<void> {
    const markdown = this.convertHtmlToMarkdown(story.content);
    const filename = `${String(index).padStart(2, "0")}_${sanitizeFilename(story.title)}.md`;
    const filepath = path.join(this.outputDir, filename);

    // Extract author from the original HTML if possible
    const $ = cheerio.load(story.content);
    let author = "";
    $("a[href*='/user/']").each((_, el) => {
      const authorName = $(el).text().trim();
      if (authorName && !author) {
        author = authorName;
      }
    });

    const content = `# ${story.title}

${author ? `**Author:** ${author}\n` : ""}**Source URL:** ${story.url}

---

${markdown}
`;

    await fs.writeFile(filepath, content, "utf-8");
    console.log(`Saved: ${filename}`);
  }

  async finalizeSave(): Promise<void> {
    if (this.singleFile && this.combinedStories.length > 0) {
      await this.saveCombinedStoryAsMarkdown();
    }

    if (this.jsonFile && this.chapters.length > 0) {
      await this.saveStoryAsJson();
    }
  }

  private async saveCombinedStoryAsMarkdown(): Promise<void> {
    console.log(
      `Combining ${this.combinedStories.length} stories into a single file`,
    );

    let combinedContent = "";
    const allAuthors = new Set<string>();
    const allUrls: string[] = [];

    // Process each story
    for (const { story, index } of this.combinedStories) {
      const markdown = this.convertHtmlToMarkdown(story.content);

      // Extract author from the original HTML if possible
      const $ = cheerio.load(story.content);
      $("a[href*='/user/']").each((_, el) => {
        const authorName = $(el).text().trim();
        if (authorName) {
          allAuthors.add(authorName);
        }
      });

      allUrls.push(story.url);

      // Add story content with chapter heading
      combinedContent += `# Chapter ${index + 1}: ${story.title}

**Source URL:** ${story.url}

---

${markdown}

${index < this.combinedStories.length - 1 ? "\n---\n\n" : ""}`;
    }

    // Get the main story title from the first story
    const mainTitle = this.combinedStories[0].story.title;
    const filename = `${sanitizeFilename(mainTitle)}_complete.md`;
    const filepath = path.join(this.outputDir, filename);

    // Create header with metadata
    const authorsText =
      allAuthors.size > 0
        ? `**Authors:** ${Array.from(allAuthors).join(", ")}\n`
        : "";
    const header = `# ${mainTitle} - Complete Story

${authorsText}**Total Chapters:** ${this.combinedStories.length}
**Source URLs:**
${allUrls.map((url) => `- ${url}`).join("\n")}

---

`;

    const finalContent = header + combinedContent;

    await fs.writeFile(filepath, finalContent, "utf-8");
    console.log(`Saved combined story: ${filename}`);
  }

  private collectChapter(story: StoryData): void {
    const markdown = this.convertHtmlToMarkdown(story.content);

    // Extract author from the original HTML if possible
    const $ = cheerio.load(story.content);
    let author: string | undefined;
    $("a[href*='/user/']").each((_, el) => {
      const authorName = $(el).text().trim();
      if (authorName && !author) {
        author = authorName;
      }
    });

    const chapter: Chapter = {
      title: story.title,
      content: markdown,
    };

    if (author) {
      chapter.author = author;
    }

    this.chapters.push(chapter);
  }

  private async saveStoryAsJson(): Promise<void> {
    console.log(`Saving ${this.chapters.length} chapters as JSON`);

    // Get the main story title from the first chapter
    const mainTitle = this.chapters[0].title;
    const filename = `${sanitizeFilename(mainTitle)}_chapters.json`;
    const filepath = path.join(this.outputDir, filename);

    // Create the JSON structure - chapters are in chronological order (parents first)
    // so we need to build the tree structure
    const jsonData = this.buildChapterTree();

    await fs.writeFile(filepath, JSON.stringify(jsonData, null, 2), "utf-8");
    console.log(`Saved JSON file: ${filename}`);
  }

  private buildChapterTree(): Chapter[] {
    if (this.chapters.length === 0) {
      return [];
    }

    // Build hierarchical structure where each chapter has the next as its child
    for (let i = 0; i < this.chapters.length - 1; i++) {
      this.chapters[i].children = [this.chapters[i + 1]];
    }

    // Return only the root chapter (first one)
    return [this.chapters[0]];
  }
}

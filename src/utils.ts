import { promises as fs } from "fs";
import path from "path";

// Constants
export const BASE_URL = "https://chyoa.com";
export const DEFAULT_OUTPUT_DIR = "downloaded_stories";
export const IMAGES_DIR = "images";
export const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
];

// String utilities
export function sanitizeTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, "").trim();
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .trim();
}

export function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// File system utilities
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureDirectories(outputDir: string, imagesDir: string, embedImages: boolean): Promise<void> {
  await ensureDirectory(outputDir);

  // Only create images directory if not embedding images
  if (!embedImages) {
    await ensureDirectory(path.join(outputDir, imagesDir));
  }
}

// URL utilities
export function makeAbsoluteUrl(url: string, baseUrl: string = BASE_URL): string {
  if (url.startsWith("http")) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  if (url.startsWith("/")) {
    return `${baseUrl}${url}`;
  }
  return `${baseUrl}/${url}`;
}

export function getFilenameFromUrl(imageUrl: string, fallbackName: string = "image.jpg"): string {
  try {
    const url = new URL(imageUrl);
    const filename = path.basename(url.pathname).split("?")[0];
    return filename && filename !== "" ? filename : fallbackName;
  } catch (error) {
    return fallbackName;
  }
}

export function convertToWebpFilename(filename: string): string {
  const nameWithoutExt = path.parse(filename).name;
  return `${nameWithoutExt}.webp`;
}

// Delay utility
export function randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const delay = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Image filtering
export function isValidStoryImage(src: string): boolean {
  return !src.includes("/data/avatars/") &&
         src !== "/assets/img/avatar-male.jpg" &&
         !src.includes("avatar-male.jpg") &&
         !src.includes("default.jpg");
}

// MIME type detection
export function getMimeTypeFromExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

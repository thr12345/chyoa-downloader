export interface StoryData {
  url: string;
  title: string;
  content: string;
  images: string[];
  parentUrl?: string;
}

export interface Chapter {
  title: string;
  author?: string;
  content: string;
  children?: Chapter[];
}

export interface AuthCredentials {
  username?: string;
  password?: string;
  sessionCookie?: string;
}

export interface SessionData {
  cookies: string;
  timestamp: number;
}

export interface DownloaderConfig {
  credentials: AuthCredentials;
  baseOutputDir: string;
  usePuppeteer: boolean;
  convertToWebp: boolean;
  embedImages: boolean;
  singleFile: boolean;
  jsonFile: boolean;
}

export interface CliArguments {
  url?: string;
  username?: string;
  password?: string;
  cookie?: string;
  output: string;
  test: boolean;
  "test-cookies": boolean;
  "clear-session": boolean;
  "no-puppeteer": boolean;
  "no-webp": boolean;
  "embed-images": boolean;
  "single-file": boolean;
  "json-file": boolean;
  help?: boolean;
  h?: boolean;
}

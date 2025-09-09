# CHYOA Downloader

> Bun-native TypeScript CLI for downloading CHYOA stories (can also be installed via npm).

A TypeScript CLI tool that downloads stories from [chyoa.com](https://chyoa.com/) and converts them to Markdown files, including all parent stories in the story chain. Features interactive authentication, session persistence, and automatic Cloudflare bypass.

## Features

- ✅ **Downloads CHYOA stories and all their parent stories**
- ✅ **Converts HTML content to clean Markdown format**
- ✅ **Downloads and saves embedded images locally (with WebP conversion by default)**
- ✅ **Updates image references in Markdown to point to local files**
- 🖼️ **Option to embed images as base64 data URLs within Markdown**
- 📄 **Option to save all chapters as a single combined Markdown file**
- 🗜️ **Automatic WebP conversion to save space (can be disabled)**
- ✅ **Supports authentication via session cookies**
- ✅ **Creates organized output directory structure**
- 🚀 **Puppeteer integration bypasses Cloudflare bot protection**
- 🤖 **Automated browser handling for reliable scraping**
- 🔐 **Interactive login with automatic session persistence**
- 💾 **Saves login sessions between runs (24-hour expiry)**

## Installation

### Global Installation (Recommended)

You can install globally with Bun (native) or npm.

Using Bun (preferred for fastest cold start):

```bash
bun add -g cyoa-cli
```

Using npm:

```bash
npm install -g cyoa-cli
```

Then use anywhere:

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url"
```

### Local Development

1. Clone this repository
2. Install dependencies (Bun will read bun.lock):
   ```bash
   bun install
   ```
3. Build the project (emits `index.js` bundle):
   ```bash
   bun run build
   ```
4. Run in watch/dev mode:
   ```bash
   bun run dev
   ```

## Requirements

- Node.js 18+
- Valid CHYOA account (for accessing protected content)

## Usage

### Basic Usage (Recommended)

Download any CHYOA story with a simple command:

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url"
```

The app will automatically:

- Create a subfolder named after the story
- Prompt for login if authentication is needed
- Save your session for future use

### With Interactive Authentication (Recommended)

When authentication is needed for protected content, the app will automatically prompt you:

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url"
# 🔐 Authentication required for full story access (including images)
# Would you like to log in interactively? (y/n)
# Choose 'y' to open a browser window for easy login
# Your session will be saved for 24 hours!
```

### With Manual Session Cookies

You can also provide session cookies directly:

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url" -c "laravel_session=your_session_cookie"
```

### Without Puppeteer (Legacy Mode)

If you want to use direct HTTP requests instead of browser automation:

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url" --no-puppeteer
```

### Image Processing Options

**Convert images to WebP (default):**

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url"
# Images are automatically converted to WebP format to save space
```

**Keep original image formats:**

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url" --no-webp
```

**Embed images as base64 in Markdown:**

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url" --embed-images
# No separate image files - everything embedded in the markdown
```

### Output Format Options

**Save each chapter as separate files (default):**

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url"
# Creates 00_chapter1.md, 01_chapter2.md, etc.
```

**Save all chapters to a single file:**

```bash
cyoa-cli "https://chyoa.com/chapter/your-story-url" --single-file
# Creates story_title_complete.md with all chapters combined
```

### Session Management

**Interactive Login (Easiest):**

1. Run the downloader without cookies
2. When prompted, choose 'y' for interactive login
3. Browser will open - log in normally
4. Press Enter to continue
5. Your session is automatically saved for 24 hours!

**Manual Session Cookies:**

1. Log into chyoa.com in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage tab > Cookies > https://chyoa.com
4. Look for cookies like 'laravel_session'
5. Copy the cookie values
6. Use the format: `--cookie "laravel_session=value1; other_cookie=value2"`

**Clear Saved Session:**

```bash
cyoa-cli --clear-session
```

**Session Location:**
Sessions are stored in `~/.config/cyoa-cli/session.json`

### Command Line Options

**Positional Arguments:**

- `url`: CHYOA story URL to download (can be used without flag)

**Options:**

- `-c, --cookie`: Session cookie for authentication
- `-o, --output`: Base output directory (default: "downloaded_stories")
- `--clear-session`: Clear saved session and force re-authentication
- `--test`: Test connectivity to CHYOA
- `--test-cookies`: Test if provided cookies work
- `--no-puppeteer`: Disable browser automation
- `--no-webp`: Disable WebP conversion (keeps original image formats)
- `--embed-images`: Embed images as base64 data URLs in markdown instead of saving to files
- `--single-file`: Save all chapters to a single markdown file instead of separate files
- `--username`: Username for authentication (not yet implemented)
- `--password`: Password for authentication (not yet implemented)
- `-h, --help`: Show help

### Examples

```bash
# Download with interactive login (recommended)
cyoa-cli "https://chyoa.com/chapter/example.123456"

# Download with manual session cookie
cyoa-cli "https://chyoa.com/chapter/example.123456" -c "laravel_session=abc123"

# Download to custom base directory
cyoa-cli "https://chyoa.com/chapter/example.123456" -o "my_stories"

# Save all chapters to a single file
cyoa-cli "https://chyoa.com/chapter/example.123456" --single-file

# Embed images as base64 in markdown (no separate image files)
cyoa-cli "https://chyoa.com/chapter/example.123456" --embed-images

# Keep original image formats (disable WebP conversion)
cyoa-cli "https://chyoa.com/chapter/example.123456" --no-webp

# Combine options: single file with embedded images
cyoa-cli "https://chyoa.com/chapter/example.123456" --single-file --embed-images

# Clear saved session before downloading
cyoa-cli "https://chyoa.com/chapter/example.123456" --clear-session

# Use direct HTTP requests (may be blocked by Cloudflare)
cyoa-cli "https://chyoa.com/chapter/example.123456" --no-puppeteer

# Test connectivity without downloading
cyoa-cli --test

# Clear session only
cyoa-cli --clear-session
```

## Output Structure

The application creates the following directory structure:

**Default mode (separate files with WebP images):**

```
downloaded_stories/
└── story_title/                    # Named after the input URL's story
    ├── 00_parent_story_title.md
    ├── 01_child_story_title.md
    ├── 02_final_story_title.md
    └── images/
        ├── image1.webp            # Converted to WebP by default
        ├── image2.webp
        └── image3.webp
```

**Single file mode (`--single-file`):**

```
downloaded_stories/
└── story_title/
    └── story_title_complete.md     # All chapters in one file
    └── images/                     # (unless --embed-images is used)
        ├── image1.webp
        ├── image2.webp
        └── image3.webp
```

**Embedded images mode (`--embed-images`):**

```
downloaded_stories/
└── story_title/
    ├── 00_parent_story_title.md    # Images embedded as base64
    ├── 01_child_story_title.md     # No separate image files
    └── 02_final_story_title.md
```

## Story Processing

1. **Story Chain Discovery**: Starting from the provided URL, the application traces back through parent stories to find the complete story chain
2. **Content Extraction**: Downloads HTML content from each story page
3. **Image Processing**:
   - Downloads all embedded images
   - Converts to WebP format by default (80% quality) to save space
   - Can embed as base64 data URLs with `--embed-images`
   - Updates references to local paths or data URLs
4. **Markdown Conversion**: Converts HTML content to clean Markdown format
5. **File Organization**:
   - Saves stories in chronological order (parents first)
   - Can save as separate files (default) or combined into single file (`--single-file`)

## Supported Content

- **Text Content**: Paragraphs, headers, bold/italic text
- **Lists**: Both ordered and unordered lists
- **Links**: External links are preserved
- **Images**: Downloaded and referenced locally
- **Story Navigation**: Automatically follows parent story links

## Test Case ✅

The application has been successfully tested with:
https://chyoa.com/chapter/The-great-east-shift-%28race-change%29-Michelle.1392983

**Test Results:**

- ✅ Successfully bypassed Cloudflare protection with Puppeteer
- ✅ Downloaded 5 stories in the complete chain
- ✅ Converted all content to clean Markdown format
- ✅ Created organized file structure
- ✅ No authentication required for this particular story

## Authentication Notes

- 🎉 **Interactive login makes authentication effortless!**
- App automatically detects when authentication is needed
- Browser opens for easy login - no manual cookie extraction needed
- Sessions are automatically saved and persist for 24 hours
- Cloudflare protection is automatically handled by browser automation
- Manual session cookies are still supported for advanced users
- Legacy HTTP mode (--no-puppeteer) may still require extensive cookie management
- Use `--clear-session` to force re-authentication

## Error Handling

The application provides clear error messages for common issues:

- **403 Forbidden**: Authentication required (try with cookies)
- **404 Not Found**: Invalid story URL
- **Browser Issues**: Puppeteer navigation problems
- **Network Issues**: Connection problems
- **Infinite Loops**: Cycle detection in story chains

## Limitations

- Username/password authentication not yet implemented
- Some premium/protected content may still require authentication
- Browser automation is slower than direct HTTP requests
- Large story chains may take several minutes to download
- Requires Chrome/Chromium to be installed for Puppeteer

## Development

### Development

```bash
# Run in development mode (watch)
bun run dev

# Build for production (bundles to index.js)
bun run build

# Test the built version
bun index.js "https://chyoa.com/chapter/example"
```

### Project Structure

- `index.ts`: Main application and CLI interface
- `package.json`: Project configuration and dependencies
- `README.md`: Documentation

## Dependencies

- **yargs**: Command-line argument parsing
- **cheerio**: HTML parsing and manipulation
- **puppeteer**: Browser automation for Cloudflare bypass
- **sharp**: Image processing and WebP conversion
- **@types/yargs**: TypeScript definitions
- **@types/puppeteer**: Puppeteer TypeScript definitions
- **@types/sharp**: Sharp TypeScript definitions

## Publishing

This package is Bun-native but fully compatible with npm.

To publish (with Bun):

1. Update the version in `package.json`
2. Build: `bun run build`
3. (Optional sanity check) Dry run: `bun publish --dry-run`
4. Publish: `bun publish --access public`

Alternative (with npm):

1. Update version in `package.json`
2. Build: `bun run build` (still fastest)
3. Publish: `npm publish`

Users can install with either:

- Bun: `bun add -g cyoa-cli`
- npm: `npm install -g cyoa-cli`

## License

MIT License

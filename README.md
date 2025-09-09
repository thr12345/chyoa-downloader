# CYOA Downloader CLI

Bun-native (but npm-compatible) TypeScript CLI for downloading stories from https://chyoa.com and exporting them as Markdown (single file or per chapter) with optional local image downloading, WebP conversion, and embedded image data.

## Key Features

- Download a story plus all ancestor (parent) chapters
- Clean HTML → Markdown conversion
- Local image download with automatic WebP conversion (can disable)
- Optionally embed images as base64 directly in Markdown
- Separate files per chapter or one combined file
- Interactive browser login (Puppeteer) with session reuse (24h)
- Manual cookie mode (skip browser)
- Cloudflare bypass via real browser
- Deterministic file + directory naming

## Installation

Global (Bun - fastest startup):

```bash
bun add -g cyoa-cli
```

Global (npm):

```bash
npm install -g cyoa-cli
```

Verify:

```bash
cyoa-cli --help
```

## Quick Start

Download a public story:

```bash
cyoa-cli "https://chyoa.com/chapter/example.123456"
```

If authentication is required you will be prompted to open a login browser—press y and log in once; session is cached.

## Basic Examples

Download with interactive login (auto prompt):

```bash
cyoa-cli "https://chyoa.com/chapter/example.123456"
```

Supply manual cookie:

```bash
cyoa-cli "https://chyoa.com/chapter/example.123456" -c "laravel_session=YOUR_VALUE"
```

Single combined file:

```bash
cyoa-cli "https://chyoa.com/chapter/example.123456" --single-file
```

Embed images (no image dir):

```bash
cyoa-cli "https://chyoa.com/chapter/example.123456" --embed-images
```

Keep original image formats:

```bash
cyoa-cli "https://chyoa.com/chapter/example.123456" --no-webp
```

Disable browser (legacy HTTP mode):

```bash
cyoa-cli "https://chyoa.com/chapter/example.123456" --no-puppeteer
```

Clear saved session:

```bash
cyoa-cli --clear-session
```

Connectivity test only:

```bash
cyoa-cli --test
```

## CLI Overview

Positional:

- url Story (chapter) URL. Can omit flags and just pass it.

Options:

- -c, --cookie Provide session cookie string (e.g. "laravel_session=...; other=...")
- -o, --output Base output directory (default: downloaded_stories)
- --single-file Combine all chapters into one Markdown file
- --embed-images Inline images as base64 (skips image directory)
- --no-webp Do not convert images to WebP
- --no-puppeteer Skip browser (direct HTTP; may fail with Cloudflare/protected content)
- --clear-session Delete cached session file and force fresh auth
- --test Simple reachability test (no download)
- --test-cookies Verify provided cookies before full run
- --username / --password Reserved (not implemented)
- -h, --help Show help

## Output Layout

Default (per chapter + WebP):

```
downloaded_stories/
  story_title/
    00_first_parent.md
    01_next.md
    02_target.md
    images/
      img_0.webp
      img_1.webp
```

Single file:

```
downloaded_stories/
  story_title/
    story_title_complete.md
    images/...
```

Embedded images:

```
downloaded_stories/
  story_title/
    00_first_parent.md
    01_next.md
    02_target.md   (all image data inlined)
```

## How It Works

1. Start from supplied chapter URL.
2. Walk parent chain (oldest ancestor → target).
3. Fetch HTML (browser automation unless --no-puppeteer).
4. Extract + sanitize text content.
5. Download images (unless embedding).
6. Convert to WebP (unless --no-webp) or embed as base64.
7. Rewrite image references.
8. Emit Markdown (ordered by ancestry or combined).

## Authentication

Preferred: interactive login (auto prompt when needed):

1. Run without cookies.
2. Accept prompt (y).
3. Browser opens—log in normally.
4. Return to terminal; press Enter.
5. Session saved for ~24h at: ~/.config/cyoa-cli/session.json

Manual cookies (advanced):

1. Log in at chyoa.com.
2. Inspect cookies (DevTools → Application/Storage).
3. Copy e.g. laravel_session.
4. Pass via: --cookie "laravel_session=VALUE"

Force reset:

```
cyoa-cli --clear-session
```

## Error Notes

Common cases:

- 403 / missing content: needs auth (login or provide cookie)
- 404: malformed or removed story URL
- Cloudflare blocked: use default (Puppeteer) mode
- Image conversion errors: try --no-webp
- Infinite parent loop: cycle detection aborts with message

## Limitations

- Username/password flags not yet implemented (interactive + cookies only)
- Very large chains increase runtime
- Browser automation slower than pure HTTP (but more reliable)
- Requires Chromium/Chrome install for Puppeteer

## Development

Install deps:

```bash
bun install
```

Watch mode:

```bash
bun run dev
```

Build bundle (emits index.js):

```bash
bun run build
```

Run built output:

```bash
bun index.js "https://chyoa.com/chapter/example"
```

Project files:

- index.ts (entry + CLI)
- package.json
- README.md

## Publishing

Bun:

```bash
# bump version in package.json
bun run build
bun publish --access public
```

npm:

```bash
# bump version
bun run build
npm publish
```

Install (end users):

- bun add -g cyoa-cli
- npm install -g cyoa-cli

## License

MIT

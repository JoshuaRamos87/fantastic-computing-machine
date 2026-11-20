# X Video Downloader Pro

A fast, client-side, offline-ready Progressive Web App (PWA) for extracting and downloading videos, GIFs, cover thumbnails, and full-resolution photos from public Twitter / X posts directly from X CDN servers—with no backend server and zero external runtime CDN requests.

---

## Features

- **Multi-Resolution MP4 Extraction**: Queries `api.fxtwitter.com` with automatic failover to `api.vxtwitter.com`, lists all MP4 variants sorted from highest to lowest quality (`4K UHD`, `2K QHD`, `FULL HD`, `HD 720p`, `SD 480p`, `SD`, `GIF MP4`), and probes exact file sizes via `HEAD` requests (with bitrate × duration estimates as fallback).
- **Streamed Downloads & Disk Streaming**: Shows live percentage, transferred MB, download speed, and ETA with a 30-second stall timeout and cancellation support. Supports streaming directly to disk via the File System Access API (`showSaveFilePicker`) when enabled or automatically for files ≥ 80 MB, with a native-tab safeguard for ≥ 150 MB files on memory-constrained mobile browsers.
- **Lossless Quick Trim / Clip**: Expandable **Trim** panel with Start/End sliders, **Use Current** time capture, and looped in-range playback. Cuts MP4 clips directly in the browser using a pure-JS ISO-BMFF keyframe-aligned remuxer (`trimMp4Lossless`) without re-encoding (falling back to `MediaRecorder` only for fragmented/non-standard containers).
- **Client-Side Animated `.GIF` Export**: Converts X GIF posts, videos ≤ 15 seconds, or any trimmed clip ≤ 15 seconds into a real `.gif` file in-browser using a pure-JS GIF89a encoder (256-color palette with Bayer dithering and LZW compression).
- **Multi-Video, Quoted Posts & Photo Galleries**:
  - Tabbed switcher and **Download All** support for multi-video posts.
  - Automatic fallback to quoted post media (marked with a **From Quoted Post** badge) when the outer post has no media.
  - Full-resolution (`name=orig`) photo gallery with **Save Full-Res**, **Save All Photos**, and direct URL copy.
  - **Save Cover** thumbnail button for video posts.
- **Adaptive HLS (`.m3u8`) Support**: For live broadcasts or HLS-only streams without direct MP4s, provides a playable stream link plus one-click copy buttons for the `.m3u8` URL, an `ffmpeg` copy command, and a `yt-dlp` command.
- **Resilient Inline Player**: Includes per-resolution preview switching, automatic variant failover, `no-referrer` metadata/headers, and a Blob preview fallback (up to 25 MB) when direct `<video>` streaming is blocked on hosted HTTPS origins.
- **Customization & Local History**:
  - Customizable filename templates using `{handle}`, `{id}`, `{res}`, `{index}`, and `{date}` tokens with a live preview.
  - Auto-extract on paste and File System Access "Save As" toggles.
  - Stores up to 25 recent extractions in `localStorage` with thumbnails, relative timestamps, live search filtering (when > 4 items), and one-click re-opening without re-fetching.
  - Dark and light themes synced with system preference and initialized before first paint.
- **Installable PWA & Zero Runtime CDNs**: Ships with compiled Tailwind CSS ([assets/styles.css](assets/styles.css)), a self-hosted Inter font, and an inline SVG-mask icon stylesheet ([assets/icons.css](assets/icons.css)), cached by [sw.js](sw.js) for offline shell loading.

---

## How to Use

### 1. Extract Media from a Post
Paste any of the following into the input box (or click **Paste** / **Sample Post**):
- Standard or mobile X / Twitter post URLs (`https://x.com/.../status/...`, `https://twitter.com/.../status/...`, `https://mobile.x.com/i/web/status/...`)
- Mirror URLs (`fxtwitter.com`, `vxtwitter.com`, `fixupx.com`, `fixvx.com`, `xcancel.com`, `nitter.*`, etc.)
- Messy mobile share text containing a post link
- A bare 15–20 digit Tweet ID

> **Note on `t.co` links:** Shortened `https://t.co/...` URLs hide the Tweet ID. Open the link in your browser first and copy the resolved `x.com/.../status/...` URL.

### 2. Preview, Trim, or Download
- **Download MP4**: Click any resolution button to stream and save the MP4, or use the play/copy buttons beside each quality to preview it in the player or copy its direct CDN URL.
- **Trim Clip**: Click **Trim** beneath the video player, adjust the **Start** / **End** sliders (or scrub and click **Use Current**), and click **Save Trimmed Clip** for a lossless MP4 cut (or **Export Trimmed .GIF** if the selection is ≤ 15 seconds).
- **Post Header Actions**: Use **Copy Text** (caption), **Copy Link** (canonical `https://x.com/<handle>/status/<id>` URL), **Refresh** (re-fetch fresh CDN URLs), or **View Post** (open on X).
- **Keyboard Shortcut**: Press `Esc` to close open modals/drawers or return to the input screen (press `Esc` twice within 3 seconds to confirm if a download is active).

### 3. Install as a PWA / Share Directly from Mobile or Desktop
When hosted over HTTPS (for example via GitHub Pages) or `localhost`:
- **Install App**: Click the **Install** button in the header (when prompted by Chromium/Android) or use your browser's **Add to Home Screen** / **Install App** option.
- **Android Share Sheet**: Once installed as a PWA, the app registers via [manifest.webmanifest](manifest.webmanifest) (`share_target`) so you can tap **Share → X Downloader** directly from the X app.
- **iOS Shortcuts & Desktop Bookmarklet**: Open the **Shortcuts & Bookmarklet** dialog (bookmark icon in the header) to copy the `?url={TWEET_URL}` template for iOS Shortcuts or the one-click JavaScript bookmarklet for desktop browsers.

---

## Local Development & Testing

### Prerequisites
- [Node.js](https://nodejs.org/) (v22+ recommended) and `npm`

### Setup
```bash
npm ci
```

### Building Offline Assets
If you edit Tailwind utility classes in [index.html](index.html), modify [src/input.css](src/input.css) or [tailwind.config.js](tailwind.config.js), or reference new Font Awesome icons, regenerate the self-contained stylesheets and font assets:
```bash
npm run build:assets
```
This runs [scripts/build-assets.js](scripts/build-assets.js) to copy the Inter font, bundle the exact Font Awesome SVGs used in [index.html](index.html) into [assets/icons.css](assets/icons.css), and compile minified Tailwind CSS into [assets/styles.css](assets/styles.css).

### Serving Locally
To test the PWA and Service Worker over HTTP:
```bash
node tests/helpers/static-server.js
```
Then open `http://127.0.0.1:4173/index.html`.

### Running the Playwright Test Suite
If Playwright's managed browser is not already installed (and you are not using a system Chrome/Edge binary), install Chromium once:
```bash
npx playwright install chromium
```

Available test scripts:
- `npm test` — Runs the full offline acceptance suite (Desktop Chrome + Mobile Pixel 7), excluding `@live` tests
- `npm run test:desktop` — Runs desktop Chromium tests only
- `npm run test:mobile` — Runs mobile Pixel 7 viewport/drawer tests only
- `npm run test:live` — Runs the optional `@live` smoke test against real upstream FxTwitter / VxTwitter endpoints
- `npm run test:headed` / `npm run test:ui` — Runs tests in headed browser or Playwright UI mode

---

## CI/CD & GitHub Pages Deployment

- **Pull Requests**: [.github/workflows/acceptance-tests.yml](.github/workflows/acceptance-tests.yml) runs `npm test` on Playwright Chromium across all desktop and mobile acceptance specs.
- **Deployments (`master` / `main`)**: [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) gates deployment behind the `acceptance-tests.yml` workflow (`needs: test`, `if: ${{ success() }}`). GitHub Pages only receives the static PWA bundle (`index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, and `assets/`) when every acceptance test passes.

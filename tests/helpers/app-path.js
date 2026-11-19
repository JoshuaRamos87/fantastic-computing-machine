const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Resolves the single-file app HTML filename in the repo root.
 * Override via APP_FILE env var if multiple HTML files exist.
 */
function resolveAppFilename() {
  if (process.env.APP_FILE) {
    return process.env.APP_FILE;
  }

  const htmlFiles = fs
    .readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.html'))
    .sort();

  const preferred = htmlFiles.find((f) => /^Twitter_video_downloader/i.test(f)) || htmlFiles.find((f) => f === 'index.html') || htmlFiles[0];

  if (!preferred) {
    throw new Error(`No .html app file found in ${REPO_ROOT}`);
  }
  return preferred;
}

const APP_FILENAME = resolveAppFilename();
const APP_URL_PATH = `/${encodeURIComponent(APP_FILENAME)}`;
const APP_ABS_PATH = path.join(REPO_ROOT, APP_FILENAME);

module.exports = {
  REPO_ROOT,
  APP_FILENAME,
  APP_URL_PATH,
  APP_ABS_PATH,
};

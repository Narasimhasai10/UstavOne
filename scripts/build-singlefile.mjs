import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const assetsDir = path.resolve(distDir, 'assets');

// Find built JS and CSS files
const assetFiles = fs.readdirSync(assetsDir);
const jsFile = assetFiles.find(f => f.endsWith('.js') && f.length > 5);
const cssFile = assetFiles.find(f => f.endsWith('.css'));

if (!jsFile) {
  console.error('No JS bundle found in dist/assets!');
  process.exit(1);
}

const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8');
const cssContent = cssFile ? fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8') : '';

// Create self-contained single-file HTML
const singleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Vedika – Plan any event within your budget</title>
  <meta name="description" content="Vedika is an event-planning app (function halls, catering, decoration, band, wedding cards) for Indian families." />

  <!-- Google Fonts: Yatra One and Hind with safe system/serif fallbacks -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600&family=Yatra+One&display=swap" rel="stylesheet" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%23FF5C8A'/><path d='M16 8c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z' fill='%23E8B84A'/></svg>" />

  <style>
    /* Safe offline fallback font definitions */
    @font-face {
      font-family: 'Hind';
      font-style: normal;
      font-weight: 400;
      src: local('Segoe UI'), local('Roboto'), local('Helvetica Neue'), sans-serif;
    }
    @font-face {
      font-family: 'Yatra One';
      font-style: normal;
      font-weight: 400;
      src: local('Georgia'), local('Times New Roman'), serif;
    }
    ${cssContent}
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- Inlined Self-Contained IIFE Application (Zero CORS, 100% file:// compatible) -->
  <script>
${jsContent}
  </script>
</body>
</html>`;

// Write to root index.html and dist/index.html
fs.writeFileSync(path.join(rootDir, 'index.html'), singleHtml, 'utf-8');
fs.writeFileSync(path.join(distDir, 'index.html'), singleHtml, 'utf-8');

console.log(`✅ [Single-File Builder] Successfully built self-contained root index.html (${Math.round(singleHtml.length / 1024)} kB)`);

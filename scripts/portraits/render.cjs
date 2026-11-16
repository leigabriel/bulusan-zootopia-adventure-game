// Usage: node scripts/portraits/render.cjs [name ...]
// Needs `npm run dev` (port 5173) and Playwright. Writes public/images/animals/*.webp.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', '..', 'public', 'images', 'animals');
const BASE = process.env.PORTRAIT_URL || 'http://localhost:5173';

// Per-animal camera tweaks: yaw turns the animal, fill is how much of the frame it covers.
const PRESETS = {
    'Rabbit': { yaw: -0.7, fill: 0.72 },
    'Parrot': { yaw: -0.5, fill: 0.62 },
    'Koi Fish': { yaw: -1.2, pitch: 0.7, fill: 0.78 },
};

async function main() {
    const { ANIMAL_METADATA } = await import('../../src/game/data/animalMetadata.js');
    const wanted = process.argv.slice(2);
    const entries = ANIMAL_METADATA.filter((entry) => wanted.length === 0 || wanted.includes(entry.name));
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
    page.on('pageerror', (error) => console.log('page error', error.message));
    await page.goto(`${BASE}/scripts/portraits/index.html`);
    await page.waitForFunction(() => window.portraitReady === true, null, { timeout: 60000 });
    for (const entry of entries) {
        const preset = PRESETS[entry.name] || {};
        const dataUrl = await page.evaluate((options) => window.renderPortrait(options), { file: entry.file, ...preset });
        const slug = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        fs.writeFileSync(path.join(OUT, `${slug}.webp`), Buffer.from(dataUrl.split(',')[1], 'base64'));
        console.log('rendered', slug);
    }
    await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });

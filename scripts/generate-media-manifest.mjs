import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = process.env.QIFU_DATA_DIR || path.join(root, "outputs", "QIFU-2026-08-13");
const imageDir = path.join(dataDir, "images");
const manifestFile = path.join(root, "data", "media-manifest.json");
const output = {};

if (!fs.existsSync(imageDir)) {
  if (fs.existsSync(manifestFile)) {
    console.log("Image source directory is unavailable; using the committed media manifest.");
    process.exit(0);
  }
  throw new Error(`Image source directory and media manifest are both missing: ${imageDir}`);
}

for (const sku of fs.readdirSync(imageDir)) {
  const folder = path.join(imageDir, sku);
  if (!fs.statSync(folder).isDirectory()) continue;
  output[sku] = fs.readdirSync(folder).filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(manifestFile, `${JSON.stringify(output)}\n`);
console.log(`Generated media manifest for ${Object.keys(output).length} SKUs.`);

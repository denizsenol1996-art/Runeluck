// Preprocess GLTF textures: shrink anything > MAX_SIZE so the browser doesn't
// have to decode huge 2048-4096px images at runtime.
// Usage: node preprocess-textures.js
// Requires: sharp (npm install sharp)

const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch(e){
  console.error('sharp is not installed. Run: npm install sharp');
  process.exit(1);
}

const MODELS = path.join(__dirname, 'models');
const MAX_SIZE = 512;              // max width/height for any texture
const JPEG_QUALITY = 82;
const PNG_QUALITY  = 85;
const EXTENSIONS = ['.png', '.jpg', '.jpeg'];

async function processFile(file){
  const ext = path.extname(file).toLowerCase();
  if(!EXTENSIONS.includes(ext)) return null;
  const before = fs.statSync(file).size;
  try {
    const img = sharp(file);
    const meta = await img.metadata();
    if(!meta.width || !meta.height) return null;
    if(Math.max(meta.width, meta.height) <= MAX_SIZE && before < 200*1024) return null; // small enough
    const scale = MAX_SIZE / Math.max(meta.width, meta.height);
    const nw = Math.max(1, Math.round(meta.width * scale));
    const nh = Math.max(1, Math.round(meta.height * scale));
    let pipe = sharp(file).resize(nw, nh, {fit:'inside'});
    if(ext === '.png') pipe = pipe.png({quality: PNG_QUALITY, compressionLevel: 9});
    else pipe = pipe.jpeg({quality: JPEG_QUALITY, mozjpeg: true});
    const buf = await pipe.toBuffer();
    fs.writeFileSync(file, buf);
    const after = fs.statSync(file).size;
    return { file: path.relative(__dirname, file), before, after, w: nw, h: nh };
  } catch(e){
    console.warn('skip', file, '-', e.message);
    return null;
  }
}

async function walk(dir){
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for(const e of entries){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

(async () => {
  console.log('Scanning', MODELS, '...');
  const files = await walk(MODELS);
  console.log('Found', files.length, 'files, processing images...');
  let totalBefore = 0, totalAfter = 0, count = 0;
  for(const f of files){
    const r = await processFile(f);
    if(r){
      totalBefore += r.before;
      totalAfter  += r.after;
      count++;
      const pct = ((1 - r.after/r.before)*100).toFixed(0);
      console.log(`  ${r.file}  ${(r.before/1024/1024).toFixed(1)}→${(r.after/1024/1024).toFixed(1)}MB  (-${pct}%)  ${r.w}x${r.h}`);
    }
  }
  console.log('');
  console.log('Processed', count, 'textures');
  console.log('Total:', (totalBefore/1024/1024).toFixed(1), 'MB →', (totalAfter/1024/1024).toFixed(1), 'MB');
  console.log('Saved:', ((totalBefore-totalAfter)/1024/1024).toFixed(1), 'MB');
})();

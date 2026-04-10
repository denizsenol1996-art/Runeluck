#!/usr/bin/env node
/**
 * RuneLuck — 317 Cache Model Exporter
 * Ported from Hazy Client ModelLoader.decodeOldFormat()
 * 
 * Reads the RSPS cache and exports models as JSON for Three.js
 * 
 * Usage:
 *   node export-models.js --cache "C:\hazy\hazy-swift\cache" --ids 230,232,234,5412
 *   node export-models.js --cache "C:\hazy\hazy-swift\cache" --list
 *   node export-models.js --cache "C:\hazy\hazy-swift\cache" --range 0-100 --out models
 */

const fs = require('fs');
const path = require('path');

// ═══ BUFFER READER (matches RS Buffer class) ═══
class RSBuffer {
  constructor(data) {
    this.data = Buffer.from(data);
    this.pos = 0;
  }
  setOffset(off) { this.pos = off; }
  readUnsignedByte() { return this.data[this.pos++] & 0xFF; }
  readSignedByte() { const v = this.data[this.pos++]; return v > 127 ? v - 256 : v; }
  readUnsignedShort() { const v = ((this.data[this.pos] & 0xFF) << 8) | (this.data[this.pos+1] & 0xFF); this.pos += 2; return v; }
  readSmart() {
    const peek = this.data[this.pos] & 0xFF;
    if (peek < 128) {
      return this.readUnsignedByte() - 64;
    } else {
      return this.readUnsignedShort() - 49152;
    }
  }
}

// ═══ CACHE READER ═══
class CacheReader {
  constructor(cacheDir) {
    this.dataFile = path.join(cacheDir, 'main_file_cache.dat');
    if (!fs.existsSync(this.dataFile)) throw new Error('Cache not found: ' + this.dataFile);
    this.dataBuffer = fs.readFileSync(this.dataFile);
  }

  readIndex(idxNum) {
    const idxPath = path.join(path.dirname(this.dataFile), `main_file_cache.idx${idxNum}`);
    if (!fs.existsSync(idxPath)) return [];
    const data = fs.readFileSync(idxPath);
    const entries = [];
    for (let i = 0; i + 5 < data.length; i += 6) {
      const size = (data[i] << 16) | (data[i+1] << 8) | data[i+2];
      const sector = (data[i+3] << 16) | (data[i+4] << 8) | data[i+5];
      entries.push({ size, sector });
    }
    return entries;
  }

  readFile(idxNum, fileId) {
    const entries = this.readIndex(idxNum);
    if (fileId >= entries.length) return null;
    const { size, sector } = entries[fileId];
    if (size === 0 || sector === 0) return null;

    const result = Buffer.alloc(size);
    let remaining = size;
    let currentSector = sector;
    let chunk = 0;
    let written = 0;

    while (remaining > 0 && currentSector > 0) {
      const offset = currentSector * 520;
      if (offset + 520 > this.dataBuffer.length) break;

      // Read 8-byte header
      const hFileId = (this.dataBuffer[offset] << 8) | this.dataBuffer[offset+1];
      const hChunk = (this.dataBuffer[offset+2] << 8) | this.dataBuffer[offset+3];
      const hNextSector = (this.dataBuffer[offset+4] << 16) | (this.dataBuffer[offset+5] << 8) | this.dataBuffer[offset+6];
      const hIdx = this.dataBuffer[offset+7];

      const readSize = Math.min(remaining, 512);
      this.dataBuffer.copy(result, written, offset + 8, offset + 8 + readSize);
      written += readSize;
      remaining -= readSize;
      currentSector = hNextSector;
      chunk++;
    }

    return result.slice(0, size);
  }
}

// ═══ RS HSL → RGB CONVERTER ═══
function rsHslToRgb(hsl) {
  if (hsl === 65535) return [128, 128, 128]; // special: no color
  hsl = hsl & 0xFFFF;
  
  const h = ((hsl >> 10) & 63) / 63.0;
  const s = ((hsl >> 7) & 7) / 7.0;
  const l = (hsl & 127) / 127.0;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.max(0, Math.min(255, Math.round(hue2rgb(p, q, h + 1/3) * 255))),
    Math.max(0, Math.min(255, Math.round(hue2rgb(p, q, h) * 255))),
    Math.max(0, Math.min(255, Math.round(hue2rgb(p, q, h - 1/3) * 255))),
  ];
}

// ═══ 317 MODEL DECODER — Ported from ModelLoader.decodeOldFormat() ═══
function decodeModel(data) {
  if (!data || data.length < 18) return null;

  // Check format type (last 2 bytes)
  const last = data[data.length - 1] & 0xFF;
  const secondLast = data[data.length - 2] & 0xFF;

  // We handle old format (no special markers at end)
  // Types 1,2,3 have markers -1/-2/-3 at end
  if (secondLast === 0xFF && (last === 0xFF || last === 0xFE || last === 0xFD)) {
    // For now, only handle old format. Type1/2/3 need separate decoders.
    console.warn('  Model uses newer format (type ' + (256 - last) + '), skipping for now');
    return null;
  }

  return decodeOldFormat(data);
}

function decodeOldFormat(data) {
  const var4 = new RSBuffer(data);
  const var5 = new RSBuffer(data);
  const var6 = new RSBuffer(data);
  const var7 = new RSBuffer(data);
  const var8 = new RSBuffer(data);

  // Read header from last 18 bytes
  var4.setOffset(data.length - 18);
  const vertexCount = var4.readUnsignedShort();    // var9
  const triangleCount = var4.readUnsignedShort();   // var10
  const texTriCount = var4.readUnsignedByte();      // var11
  const useTextures = var4.readUnsignedByte();      // var12
  const usePriority = var4.readUnsignedByte();      // var13
  const useAlpha = var4.readUnsignedByte();         // var14
  const useTriSkins = var4.readUnsignedByte();      // var15
  const useVertSkins = var4.readUnsignedByte();     // var16
  const dataLenX = var4.readUnsignedShort();        // var17
  const dataLenY = var4.readUnsignedShort();        // var18
  const dataLenZ = var4.readUnsignedShort();        // var19
  const dataLenTri = var4.readUnsignedShort();      // var20

  if (vertexCount === 0 || triangleCount === 0) return null;
  if (vertexCount > 50000 || triangleCount > 50000) return null;

  // Calculate data section offsets
  let offset = 0;
  const vertDirOff = offset;    offset += vertexCount;     // var21=0, var22=vertexCount
  const triTypeOff = offset;    offset += triangleCount;   // var23
  let priOff = offset;
  if (usePriority === 255) offset += triangleCount;        // var24

  let triSkinOff = offset;
  if (useTriSkins === 1) offset += triangleCount;          // var25

  let texPtrOff = offset;
  if (useTextures === 1) offset += triangleCount;          // var26

  let vertSkinOff = offset;
  if (useVertSkins === 1) offset += vertexCount;           // var27

  let alphaOff = offset;
  if (useAlpha === 1) offset += triangleCount;             // var28

  const triDataOff = offset;    offset += dataLenTri;      // var29
  const colorOff = offset;      offset += triangleCount * 2; // var30
  const texTriOff = offset;     offset += texTriCount * 6;   // var31
  const vertXOff = offset;      offset += dataLenX;          // var32
  const vertYOff = offset;      offset += dataLenY;          // var33
  // vertZOff = offset, + dataLenZ

  // Decode vertices (delta encoded)
  const vx = new Int32Array(vertexCount);
  const vy = new Int32Array(vertexCount);
  const vz = new Int32Array(vertexCount);

  var4.setOffset(vertDirOff);    // direction flags
  var5.setOffset(vertXOff);      // X deltas
  var6.setOffset(vertYOff);      // Y deltas
  var7.setOffset(offset);        // Z deltas (starts after vertYOff + dataLenY)

  let dx = 0, dy = 0, dz = 0;
  for (let i = 0; i < vertexCount; i++) {
    const flag = var4.readUnsignedByte();
    let xd = 0, yd = 0, zd = 0;
    if (flag & 1) xd = var5.readSmart();
    if (flag & 2) yd = var6.readSmart();
    if (flag & 4) zd = var7.readSmart();
    vx[i] = dx + xd;
    vy[i] = dy + yd;
    vz[i] = dz + zd;
    dx = vx[i]; dy = vy[i]; dz = vz[i];
  }

  // Decode face colors
  const colors = new Uint16Array(triangleCount);
  var4.setOffset(colorOff);
  for (let i = 0; i < triangleCount; i++) {
    colors[i] = var4.readUnsignedShort();
  }

  // Decode face alpha
  const alphas = new Int8Array(triangleCount);
  if (useAlpha === 1) {
    var4.setOffset(alphaOff);
    for (let i = 0; i < triangleCount; i++) {
      alphas[i] = var4.readSignedByte();
    }
  }

  // Decode face indices (triangle strip encoding)
  const fa = new Int32Array(triangleCount);
  const fb = new Int32Array(triangleCount);
  const fc = new Int32Array(triangleCount);

  var4.setOffset(triDataOff);    // vertex index deltas
  var5.setOffset(triTypeOff);    // triangle types

  let a = 0, b = 0, c = 0, last = 0;
  for (let i = 0; i < triangleCount; i++) {
    const type = var5.readUnsignedByte();
    if (type === 1) {
      a = var4.readSmart() + last;
      b = var4.readSmart() + a;
      c = var4.readSmart() + b;
      last = c;
    } else if (type === 2) {
      b = c;
      c = var4.readSmart() + last;
      last = c;
    } else if (type === 3) {
      a = c;
      c = var4.readSmart() + last;
      last = c;
    } else if (type === 4) {
      const tmp = a;
      a = b;
      b = tmp;
      c = var4.readSmart() + last;
      last = c;
    }
    fa[i] = a;
    fb[i] = b;
    fc[i] = c;
  }

  // Convert colors to RGB
  const faceRgb = [];
  for (let i = 0; i < triangleCount; i++) {
    faceRgb.push(rsHslToRgb(colors[i]));
  }

  return {
    vertexCount,
    triangleCount,
    vertices: { x: Array.from(vx), y: Array.from(vy), z: Array.from(vz) },
    faces: { a: Array.from(fa), b: Array.from(fb), c: Array.from(fc) },
    faceColors: faceRgb,
    faceAlphas: Array.from(alphas),
  };
}

// ═══ EXPORT TO OBJ ═══
function toOBJ(model, scale = 0.01) {
  let obj = '# RuneLuck 317 Model Export\n';
  let mtl = '# RuneLuck Materials\n';
  
  // Vertices (Y is flipped in RS)
  for (let i = 0; i < model.vertexCount; i++) {
    obj += `v ${model.vertices.x[i] * scale} ${-model.vertices.y[i] * scale} ${model.vertices.z[i] * scale}\n`;
  }
  
  // Materials + Faces
  const colorMap = new Map();
  for (let i = 0; i < model.triangleCount; i++) {
    const [r, g, b] = model.faceColors[i];
    const key = `${r}_${g}_${b}`;
    if (!colorMap.has(key)) {
      const idx = colorMap.size;
      colorMap.set(key, `m${idx}`);
      mtl += `\nnewmtl m${idx}\nKd ${r/255} ${g/255} ${b/255}\n`;
    }
    obj += `usemtl ${colorMap.get(key)}\n`;
    obj += `f ${model.faces.a[i]+1} ${model.faces.b[i]+1} ${model.faces.c[i]+1}\n`;
  }
  
  return { obj, mtl };
}

// ═══ EXPORT TO JSON (for Three.js) ═══
function toJSON(model, modelId) {
  // Build indexed BufferGeometry-compatible format
  const positions = [];
  const colors = [];
  const indices = [];

  // Vertices
  const scale = 0.01; // RS units to world units
  for (let i = 0; i < model.vertexCount; i++) {
    positions.push(model.vertices.x[i] * scale, -model.vertices.y[i] * scale, model.vertices.z[i] * scale);
  }

  // We need per-vertex colors, but RS has per-face colors
  // So we need to un-index: create 3 vertices per face
  const flatPositions = [];
  const flatColors = [];
  
  for (let i = 0; i < model.triangleCount; i++) {
    const a = model.faces.a[i], b = model.faces.b[i], c = model.faces.c[i];
    const [r, g, bb] = model.faceColors[i];
    const rn = r/255, gn = g/255, bn = bb/255;
    
    flatPositions.push(
      model.vertices.x[a]*scale, -model.vertices.y[a]*scale, model.vertices.z[a]*scale,
      model.vertices.x[b]*scale, -model.vertices.y[b]*scale, model.vertices.z[b]*scale,
      model.vertices.x[c]*scale, -model.vertices.y[c]*scale, model.vertices.z[c]*scale,
    );
    flatColors.push(rn, gn, bn, rn, gn, bn, rn, gn, bn);
  }

  return {
    id: modelId,
    vertexCount: model.vertexCount,
    triangleCount: model.triangleCount,
    // Flat arrays ready for Three.js BufferGeometry
    positions: flatPositions,
    colors: flatColors,
  };
}

// ═══ MAIN ═══
function main() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    opts[args[i].replace('--', '')] = args[i+1] || true;
  }

  const cacheDir = opts.cache || 'C:\\hazy\\hazy-swift\\cache';
  const outDir = opts.out || 'rs-models';
  
  console.log('☘️  RuneLuck 317 Model Exporter');
  console.log(`Cache: ${cacheDir}`);
  
  const cache = new CacheReader(cacheDir);
  const modelIndex = cache.readIndex(1);
  console.log(`Found ${modelIndex.length} model entries\n`);

  if (opts.list !== undefined) {
    let count = 0;
    for (let i = 0; i < modelIndex.length; i++) {
      if (modelIndex[i].size > 0) {
        process.stdout.write(`${i}(${modelIndex[i].size}b) `);
        count++;
        if (count % 10 === 0) console.log();
      }
    }
    console.log(`\n\nTotal: ${count} models`);
    return;
  }

  // Determine which IDs to export
  let ids = [];
  if (opts.ids) {
    ids = opts.ids.split(',').map(Number);
  } else if (opts.range) {
    const [start, end] = opts.range.split('-').map(Number);
    ids = Array.from({length: end - start + 1}, (_, i) => i + start);
  } else {
    console.log('Usage:');
    console.log('  node export-models.js --cache <path> --list');
    console.log('  node export-models.js --cache <path> --ids 230,5412,5698');
    console.log('  node export-models.js --cache <path> --range 0-50');
    console.log('  node export-models.js --cache <path> --range 0-50 --out rs-models');
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  let exported = 0, failed = 0;
  const manifest = [];

  for (const id of ids) {
    const data = cache.readFile(1, id);
    if (!data) continue;

    const model = decodeModel(data);
    if (!model || model.vertexCount === 0) {
      failed++;
      continue;
    }

    // Export JSON for Three.js
    const json = toJSON(model, id);
    const jsonPath = path.join(outDir, `${id}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(json));

    // Export OBJ for preview
    const { obj, mtl } = toOBJ(model);
    fs.writeFileSync(path.join(outDir, `${id}.obj`), obj);
    fs.writeFileSync(path.join(outDir, `${id}.mtl`), mtl);

    console.log(`  ✓ Model ${id}: ${model.vertexCount} verts, ${model.triangleCount} tris → ${jsonPath}`);
    manifest.push({ id, verts: model.vertexCount, tris: model.triangleCount });
    exported++;
  }

  // Write manifest
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n✓ Exported ${exported} models (${failed} skipped)`);
  console.log(`Output: ${outDir}/`);
  console.log(`\nTo use in RuneLuck, copy the JSON files to runeluck/models/`);
  console.log(`Then load them with: RL.rsModels.load(modelId)`);
}

main();

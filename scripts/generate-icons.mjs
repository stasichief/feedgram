/**
 * Generates the PWA PNG icons without any image dependencies.
 * Run with: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, '..', 'public', 'icons');

const ACCENT = [37, 99, 235];
const WHITE = [255, 255, 255];

/** CRC32 for PNG chunks. */
const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed distance from a point to a rounded rectangle. */
function roundedRectDistance(x, y, cx, cy, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x - cx) - (halfWidth - radius);
  const dy = Math.abs(y - cy) - (halfHeight - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Distance from a point to a circular arc band. */
function arcDistance(x, y, cx, cy, radius, thickness) {
  const distance = Math.hypot(x - cx, y - cy) - radius;
  return Math.abs(distance) - thickness / 2;
}

function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = size / 64;

  // Maskable icons need a safe zone: the glyph is scaled down.
  const glyphScale = maskable ? 0.72 : 1;
  const cornerRadius = maskable ? 0 : 14 * scale;
  const glyphOffset = maskable ? 0 : 2 * scale;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = px + 0.5;
      const y = py + 0.5;

      const offset = (py * size + px) * 4;

      // Background
      let colour = ACCENT;
      let alpha = 255;

      if (maskable) {
        alpha = 255;
      } else {
        const distance = roundedRectDistance(
          x,
          y,
          size / 2,
          size / 2,
          size / 2,
          size / 2,
          cornerRadius,
        );
        alpha = Math.round(255 * Math.min(1, Math.max(0, 0.5 - distance)));
        if (alpha === 0) colour = [0, 0, 0];
      }

      // RSS glyph: a dot in the bottom-left corner with two quarter arcs
      // sweeping up and to the left.
      const gx = (x - size / 2) / (scale * glyphScale) + 32;
      const gy = (y - size / 2) / (scale * glyphScale) + 32 - glyphOffset / scale;

      const centerX = 20;
      const centerY = 44;
      const thickness = 5;
      const dotRadius = 3.9;

      let glyphDistance = Infinity;

      if (gx <= centerX + 1 && gy <= centerY + 1) {
        glyphDistance = Math.min(
          arcDistance(gx, gy, centerX, centerY, 22, thickness),
          arcDistance(gx, gy, centerX, centerY, 12.5, thickness),
        );
      }

      const dotDistance = Math.hypot(gx - centerX, gy - centerY) - dotRadius;
      glyphDistance = Math.min(glyphDistance, dotDistance);

      const glyphAlpha =
        Math.round(255 * Math.min(1, Math.max(0, 0.5 - glyphDistance)));
      if (glyphAlpha > 0) {
        const blend = glyphAlpha / 255;
        colour = [
          Math.round(colour[0] * (1 - blend) + WHITE[0] * blend),
          Math.round(colour[1] * (1 - blend) + WHITE[1] * blend),
          Math.round(colour[2] * (1 - blend) + WHITE[2] * blend),
        ];
      }

      rgba[offset] = colour[0];
      rgba[offset + 1] = colour[1];
      rgba[offset + 2] = colour[2];
      rgba[offset + 3] = alpha;
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(outputDir, { recursive: true });

writeFileSync(resolve(outputDir, 'icon-192.png'), renderIcon(192));
writeFileSync(resolve(outputDir, 'icon-512.png'), renderIcon(512));
writeFileSync(
  resolve(outputDir, 'icon-512-maskable.png'),
  renderIcon(512, { maskable: true }),
);

console.log('Icons written to', outputDir);

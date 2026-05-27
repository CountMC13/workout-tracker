// Generates PWA PNG icons (no image-library dependency).
// Draws a teal tile with a white medical cross, the app's brand mark.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });

const TEAL = [13, 148, 136]; // #0d9488
const WHITE = [255, 255, 255];

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Wrap a PNG buffer in a single-image .ico (Windows Vista+ supports PNG-in-ICO).
function icoFromPng(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 0 => 256
  entry.writeUInt8(0, 1); // height 0 => 256
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset to image data
  return Buffer.concat([header, entry, pngBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  // raw scanlines, each prefixed with a 0 filter byte
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  // teal background (full bleed -> maskable safe)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, TEAL);
  // white cross
  const bar = Math.round(size * 0.16);
  const half = Math.round(size * 0.30);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inV = Math.abs(x - c) <= bar / 2 && Math.abs(y - c) <= half;
      const inH = Math.abs(y - c) <= bar / 2 && Math.abs(x - c) <= half;
      if (inV || inH) set(x, y, WHITE);
    }
  }
  return encodePng(size, size, px);
}

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), drawIcon(size));
  console.log(`wrote icon-${size}.png`);
}

// .ico at project root for the Windows desktop-launcher shortcut.
fs.writeFileSync(path.join(__dirname, '..', 'icon.ico'), icoFromPng(drawIcon(256)));
console.log('wrote icon.ico');

// SVG favicon
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0d9488"/>
  <rect x="42" y="20" width="16" height="60" rx="4" fill="#fff"/>
  <rect x="20" y="42" width="60" height="16" rx="4" fill="#fff"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), favicon);
console.log('wrote favicon.svg');

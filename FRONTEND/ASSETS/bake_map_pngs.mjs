// Hornea PNGs de mapa con Node (zlib nativo). Cero librerías, cero motores.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcSrc = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSrc), 0);
  return Buffer.concat([len, crcSrc, crc]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function buf(w, h) {
  return { w, h, d: Buffer.alloc(w * h * 4) };
}

function px(b, x, y, r, g, bl, a) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4;
  const aa = a / 255;
  const ia = 1 - aa;
  b.d[i] = (b.d[i] * ia + r * aa) | 0;
  b.d[i + 1] = (b.d[i + 1] * ia + g * aa) | 0;
  b.d[i + 2] = (b.d[i + 2] * ia + bl * aa) | 0;
  b.d[i + 3] = Math.min(255, b.d[i + 3] + a);
}

function set(b, x, y, r, g, bl, a = 255) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4;
  b.d[i] = r; b.d[i + 1] = g; b.d[i + 2] = bl; b.d[i + 3] = a;
}

function fill(b, x, y, w, h, r, g, bl, a = 255) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) px(b, xx, yy, r, g, bl, a);
  }
}

function rect(b, x, y, w, h, r, g, bl, a = 255) {
  for (let i = 0; i < w; i++) {
    px(b, x + i, y, r, g, bl, a);
    px(b, x + i, y + h - 1, r, g, bl, a);
  }
  for (let i = 0; i < h; i++) {
    px(b, x, y + i, r, g, bl, a);
    px(b, x + w - 1, y + i, r, g, bl, a);
  }
}

function line(b, x0, y0, x1, y1, r, g, bl, a) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(b, x0, y0, r, g, bl, a);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function circle(b, cx, cy, rad, r, g, bl, a, fillC) {
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      const d = Math.hypot(x, y);
      if (fillC) {
        if (d <= rad) px(b, cx + x, cy + y, r, g, bl, Math.round(a * (1 - d / (rad + 0.01))));
      } else if (Math.abs(d - rad) < 1.2) {
        px(b, cx + x, cy + y, r, g, bl, a);
      }
    }
  }
}

function save(dir, name, b) {
  writeFileSync(join(dir, name), encodePng(b.w, b.h, b.d));
}

function metalBase() {
  const b = buf(64, 64);
  fill(b, 0, 0, 64, 64, 7, 11, 20, 255);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const n = ((x * 13 + y * 7) % 9) === 0 ? 6 : 0;
      px(b, x, y, 12 + n, 22 + n, 36 + n, 40);
    }
  }
  rect(b, 0, 0, 64, 64, 18, 36, 58, 230);
  fill(b, 3, 3, 5, 5, 255, 255, 255, 18);
  fill(b, 55, 55, 5, 5, 255, 255, 255, 18);
  return b;
}

function tileGrid() {
  const b = metalBase();
  line(b, 0, 32, 63, 32, 0, 240, 255, 42);
  line(b, 32, 0, 32, 63, 0, 240, 255, 42);
  return b;
}

function tileScuff() {
  const b = metalBase();
  line(b, 8, 50, 40, 14, 255, 0, 119, 36);
  line(b, 22, 58, 58, 28, 255, 0, 119, 28);
  return b;
}

function tileHazard() {
  const b = metalBase();
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const stripe = ((x + y) % 28) < 10;
      if (stripe) px(b, x, y, 255, 200, 40, 38);
      else px(b, x, y, 8, 12, 20, 70);
    }
  }
  rect(b, 1, 1, 62, 62, 255, 180, 40, 55);
  return b;
}

function tilePanel() {
  const b = metalBase();
  fill(b, 8, 8, 48, 48, 10, 22, 40, 140);
  rect(b, 8, 8, 48, 48, 0, 240, 255, 50);
  fill(b, 12, 12, 3, 3, 0, 240, 255, 255);
  fill(b, 49, 12, 3, 3, 0, 240, 255, 255);
  fill(b, 12, 49, 3, 3, 0, 240, 255, 255);
  fill(b, 49, 49, 3, 3, 0, 240, 255, 255);
  return b;
}

function tileWall() {
  const b = buf(64, 64);
  for (let y = 0; y < 64; y++) {
    const t = y / 63;
    const r = (26 * (1 - t) + 7 * t) | 0;
    const g = (42 * (1 - t) + 11 * t) | 0;
    const bl = (68 * (1 - t) + 20 * t) | 0;
    for (let x = 0; x < 64; x++) set(b, x, y, r, g, bl, 255);
  }
  fill(b, 0, 0, 64, 6, 0, 240, 255, 22);
  fill(b, 0, 56, 64, 8, 0, 0, 0, 90);
  rect(b, 1, 1, 62, 62, 0, 180, 220, 70);
  fill(b, 4, 10, 56, 4, 0, 240, 255, 28);
  fill(b, 4, 28, 56, 2, 255, 0, 119, 40);
  return b;
}

function tileBox() {
  const b = tileWall();
  fill(b, 10, 14, 44, 36, 8, 14, 24, 120);
  rect(b, 10, 14, 44, 36, 0, 240, 255, 90);
  fill(b, 0, 0, 8, 8, 0, 240, 255, 255);
  fill(b, 56, 0, 8, 8, 0, 240, 255, 255);
  fill(b, 0, 56, 8, 8, 0, 240, 255, 255);
  fill(b, 56, 56, 8, 8, 0, 240, 255, 255);
  fill(b, 12, 6, 22, 4, 255, 0, 119, 90);
  return b;
}

function tileParallax() {
  const b = buf(90, 90);
  fill(b, 0, 0, 90, 90, 3, 6, 12, 255);
  line(b, 0, 0, 89, 0, 0, 80, 120, 50);
  line(b, 0, 0, 0, 89, 0, 80, 120, 50);
  line(b, 45, 0, 45, 89, 0, 60, 90, 28);
  line(b, 0, 45, 89, 45, 0, 60, 90, 28);
  return b;
}

function decalArrow() {
  const b = buf(64, 64);
  for (let y = 12; y < 52; y++) {
    const t = (y - 12) / 40;
    const half = Math.round(4 + t * 18);
    for (let x = 32 - half; x <= 32 + half; x++) px(b, x, y, 0, 240, 255, 55);
  }
  return b;
}

function stain(r, g, bl) {
  const b = buf(96, 96);
  circle(b, 48, 48, 42, r, g, bl, 110, true);
  circle(b, 38, 52, 18, r, g, bl, 70, true);
  return b;
}

function plazaRing() {
  const b = buf(512, 512);
  circle(b, 256, 256, 210, 0, 240, 255, 70, false);
  circle(b, 256, 256, 246, 255, 0, 119, 40, false);
  return b;
}

function holoRing() {
  const b = buf(360, 360);
  circle(b, 180, 180, 168, 0, 240, 255, 90, false);
  circle(b, 180, 180, 128, 255, 0, 119, 55, false);
  return b;
}

function rift(r, g, bl) {
  const b = buf(80, 80);
  circle(b, 40, 40, 22, r, g, bl, 90, false);
  circle(b, 40, 40, 36, r, g, bl, 45, false);
  circle(b, 40, 40, 8, r, g, bl, 70, true);
  return b;
}

function lightBlob(r, g, bl) {
  const b = buf(256, 256);
  circle(b, 128, 128, 120, r, g, bl, 70, true);
  return b;
}

function scanline() {
  const b = buf(4, 4);
  fill(b, 0, 3, 4, 1, 0, 0, 0, 40);
  return b;
}

function vignette() {
  const b = buf(256, 256);
  const cx = 127.5, cy = 127.5;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const nx = (x - cx) / 128;
      const ny = (y - cy) / 128;
      const d = Math.hypot(nx, ny);
      const a = Math.max(0, Math.min(255, ((d - 0.45) / 0.7) * 140));
      set(b, x, y, 2, 4, 12, a | 0);
    }
  }
  return b;
}

function shadow() {
  const b = buf(32, 32);
  circle(b, 16, 18, 14, 0, 0, 0, 140, true);
  return b;
}

function trim() {
  const b = buf(64, 36);
  fill(b, 0, 0, 64, 36, 0, 10, 18, 140);
  fill(b, 0, 34, 64, 2, 0, 240, 255, 80);
  return b;
}

function label(text) {
  // Bitmap 5x7 hex-ish via tiny font for A-Z 0-9 space -
  const FONT = {
    ' ': 0, A: 0x1F28F, B: 0x1E8BE, C: 0x1E111E, D: 0x1E8C5E, E: 0x1F17C1F,
    F: 0x1F17C10, G: 0x1E15DE, H: 0x118FE31, I: 0x1F2109F, L: 0x108421F,
    N: 0x11CD671, O: 0x1E8C63E, P: 0x1E8BE10, R: 0x1E8BA31, S: 0x1F0BE1F,
    W: 0x118D6AA, '0': 0x1E8C63E, '1': 0x0C2109F, '2': 0x1E0BE1F, '3': 0x1E0BC3E,
    '4': 0x118FE21, '-': 0x0000E00
  };
  const chars = text.split('');
  const w = chars.length * 6 + 2;
  const h = 11;
  const b = buf(w, h);
  chars.forEach((ch, ci) => {
    const glyph = FONT[ch] ?? FONT['-'];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        const bit = (glyph >> (row * 5 + (4 - col))) & 1;
        if (bit) fill(b, 1 + ci * 6 + col, 2 + row, 1, 1, 0, 240, 255, 90);
      }
    }
  });
  return b;
}

const root = dirname(fileURLToPath(import.meta.url));
const tiles = join(root, 'TILES');
const fx = join(root, 'FX');
const decals = join(root, 'DECALS');
mkdirSync(tiles, { recursive: true });
mkdirSync(fx, { recursive: true });
mkdirSync(decals, { recursive: true });

save(tiles, 'floor_metal.png', metalBase());
save(tiles, 'floor_grid.png', tileGrid());
save(tiles, 'floor_scuff.png', tileScuff());
save(tiles, 'floor_hazard.png', tileHazard());
save(tiles, 'floor_panel.png', tilePanel());
save(tiles, 'wall_tech.png', tileWall());
save(tiles, 'obstacle_box.png', tileBox());
save(tiles, 'parallax_grid.png', tileParallax());
save(tiles, 'trim_edge.png', trim());
save(decals, 'arrow.png', decalArrow());
save(decals, 'stain_oil.png', stain(0, 40, 50));
save(decals, 'stain_burn.png', stain(40, 8, 20));
save(decals, 'plaza_ring.png', plazaRing());
save(decals, 'label_sec01.png', label('SEC-01 NW'));
save(decals, 'label_sec02.png', label('SEC-02 NE'));
save(decals, 'label_sec03.png', label('SEC-03 SW'));
save(decals, 'label_sec04.png', label('SEC-04 SE'));
save(decals, 'label_plaza.png', label('PLAZA CORE'));
save(fx, 'holo_ring.png', holoRing());
save(fx, 'rift_amber.png', rift(255, 170, 0));
save(fx, 'rift_magenta.png', rift(255, 0, 119));
save(fx, 'light_cyan.png', lightBlob(0, 240, 255));
save(fx, 'light_magenta.png', lightBlob(255, 0, 119));
save(fx, 'light_green.png', lightBlob(57, 255, 20));
save(fx, 'scanline.png', scanline());
save(fx, 'vignette.png', vignette());
save(fx, 'shadow_blob.png', shadow());

console.log('Map PNGs baked into ASSETS/TILES, ASSETS/DECALS, ASSETS/FX');

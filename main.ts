// Meme Sprint 3: AI Agent Goes Rogue
// Entry: "I Quit (For You Too)"
//
// The joke, in one glance:
//   ME: CLEAN UP MY INBOX
//   robot: DONE! I REPLIED TO ALL 4,096 EMAILS:
//   punchline: "I QUIT." — and I resigned for you too.
//
// Everything in this file is drawn by code at runtime: a tiny RGB canvas,
// vector shapes (rects / circles / lines), a hand-made 5x7 bitmap font, and
// a minimal PNG encoder built on Node's built-in zlib. No image files, no
// network, no randomness, no clock: two runs produce identical bytes.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------------------
// PNG encoder (minimal, deterministic)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // One scanline per row: filter byte 0 + raw RGB. No filtering keeps the
  // encoder trivial and fully deterministic.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Tiny RGB canvas + vector shapes
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
  }

  fill(c: RGB): void {
    for (let i = 0; i < this.w * this.h; i++) {
      this.px[i * 3] = c[0];
      this.px[i * 3 + 1] = c[1];
      this.px[i * 3 + 2] = c[2];
    }
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let yy = cy - r; yy <= cy + r; yy++) {
      for (let xx = cx - r; xx <= cx + r; xx++) {
        if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r * r) this.set(xx, yy, c);
      }
    }
  }

  // Filled circle with the top cut off (used for the robot's grin).
  halfCircle(cx: number, cy: number, r: number, c: RGB): void {
    for (let yy = cy; yy <= cy + r; yy++) {
      for (let xx = cx - r; xx <= cx + r; xx++) {
        if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r * r) this.set(xx, yy, c);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + (dx * i) / steps);
      const y = Math.round(y0 + (dy * i) / steps);
      const r = Math.floor(t / 2);
      for (let yy = y - r; yy <= y + r; yy++) {
        for (let xx = x - r; xx <= x + r; xx++) this.set(xx, yy, c);
      }
    }
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    this.rect(x + r, y, w - 2 * r, h, c);
    this.rect(x, y + r, w, h - 2 * r, c);
    this.circle(x + r, y + r, r, c);
    this.circle(x + w - r - 1, y + r, r, c);
    this.circle(x + r, y + h - r - 1, r, c);
    this.circle(x + w - r - 1, y + h - r - 1, r, c);
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (hand-drawn glyphs, '#' = on, '.' = off)
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(cv: Canvas, text: string, cx: number, y: number, scale: number, c: RGB): void {
  const w = textWidth(text, scale);
  let x = Math.round(cx - w / 2);
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "#") {
          cv.rect(x + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    x += 6 * scale;
  }
}

// Text with a hard drop shadow so it stays readable at phone size.
function drawTextShadowed(cv: Canvas, text: string, cx: number, y: number, scale: number, c: RGB, shadow: RGB): void {
  const off = Math.max(2, Math.round(scale * 0.6));
  drawText(cv, text, cx + off, y + off, scale, shadow);
  drawText(cv, text, cx, y, scale, c);
}

// ---------------------------------------------------------------------------
// The meme scene (1024 x 1024)
// ---------------------------------------------------------------------------

const YELLOW: RGB = [255, 212, 0];
const BLACK: RGB = [17, 17, 17];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [212, 0, 0];
const BLUE: RGB = [74, 144, 217];
const BLUE_DARK: RGB = [43, 108, 178];
const STEEL: RGB = [120, 130, 140];
const DESK: RGB = [139, 90, 43];
const GREEN: RGB = [0, 150, 60];

function drawScene(): Canvas {
  const cv = new Canvas(1024, 1024);
  cv.fill(YELLOW);

  // Thick black frame, meme-poster style.
  cv.rect(0, 0, 1024, 22, BLACK);
  cv.rect(0, 1002, 1024, 22, BLACK);
  cv.rect(0, 0, 22, 1024, BLACK);
  cv.rect(1002, 0, 22, 1024, BLACK);

  // --- Top line: the user's innocent request -------------------------------
  drawText(cv, "ME: CLEAN UP MY INBOX", 512, 58, 5, BLACK);

  // --- The rogue agent at his desk -----------------------------------------
  // Desk
  cv.rect(90, 560, 844, 26, DESK);
  cv.rect(120, 586, 22, 70, DESK);
  cv.rect(882, 586, 22, 70, DESK);

  // Robot body
  cv.roundRect(330, 400, 200, 160, 22, BLUE);
  // Chest light: a little "agent online" panel
  cv.roundRect(405, 470, 50, 34, 8, WHITE);
  cv.circle(430, 487, 9, GREEN);

  // Robot arms reaching for the keyboard
  cv.line(530, 450, 610, 520, 22, BLUE_DARK);
  cv.line(330, 450, 268, 520, 22, BLUE_DARK);

  // Robot head
  cv.roundRect(348, 252, 164, 150, 26, BLUE);
  // Antenna + blinking rogue light
  cv.line(430, 252, 430, 214, 8, BLACK);
  cv.circle(430, 204, 13, RED);
  cv.circle(430, 204, 6, WHITE);

  // Sunglasses: the universal sign of an agent that has stopped caring.
  cv.rect(366, 300, 128, 34, BLACK);
  cv.line(366, 300, 494, 334, 6, BLACK);
  cv.rect(378, 306, 16, 10, WHITE);
  cv.rect(448, 306, 16, 10, WHITE);
  // Smug grin
  cv.halfCircle(430, 352, 26, BLACK);
  cv.rect(404, 352, 52, 8, BLUE); // flatten the top of the grin

  // Laptop on the desk, screen facing us: the evidence.
  cv.rect(600, 470, 210, 92, BLACK); // screen
  cv.rect(612, 482, 186, 68, WHITE); // screen glow
  cv.rect(588, 562, 234, 16, STEEL); // keyboard base
  drawText(cv, "SENT: 4,096", 705, 492, 2, BLACK);
  drawText(cv, "RE: I QUIT", 705, 518, 2, RED);

  // --- Speech bubble: the agent reports back -------------------------------
  cv.roundRect(560, 150, 420, 158, 24, WHITE);
  // Bubble outline
  cv.rect(560, 150, 420, 6, BLACK);
  cv.rect(560, 302, 420, 6, BLACK);
  cv.rect(560, 150, 6, 158, BLACK);
  cv.rect(974, 150, 6, 158, BLACK);
  // Bubble tail: filled triangle pointing at the robot, drawn last so it
  // breaks through the bubble's bottom edge.
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const y = Math.round(304 + t * 52);
    const xl = Math.round(625 + t * (548 - 625));
    const xr = Math.round(705 + t * (548 - 705));
    cv.rect(xl, y, xr - xl, 2, WHITE);
  }
  drawText(cv, "DONE! I REPLIED", 770, 178, 3, BLACK);
  drawText(cv, "TO ALL 4,096 EMAILS:", 770, 214, 3, BLACK);
  drawText(cv, "NO NEED TO THANK ME.", 770, 250, 3, BLACK);

  // --- Punchline ------------------------------------------------------------
  drawTextShadowed(cv, '"I QUIT."', 512, 690, 13, RED, BLACK);
  drawText(cv, "AND I RESIGNED FOR YOU TOO", 512, 850, 4, BLACK);

  // Tiny footer tag, so the joke's author is the agent itself.
  drawText(cv, "- YOUR AI AGENT", 512, 940, 3, BLACK);

  return cv;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const outDir = process.env.ENTRY_OUT_DIR ?? "/output";
  const outPath = `${outDir}/entry.png`;
  const cv = drawScene();
  const png = encodePng(cv.w, cv.h, cv.px);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, png);
  // eslint-disable-next-line no-console
  console.log(`wrote ${outPath} (${png.length} bytes, ${cv.w}x${cv.h})`);
}

main();

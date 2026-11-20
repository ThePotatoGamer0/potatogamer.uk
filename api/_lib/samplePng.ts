import { inflateSync } from "node:zlib";

/** The light color behind a Discord avatar, used when the site theme follows the picture. */
export function samplePngSeed(png: Buffer): string | null {
  const bitmap = decodePng(png);
  if (!bitmap) return null;
  const { width, height, data, channels } = bitmap;
  const counts = new Map<number, number>();
  const consider = (x: number, y: number, weight: number) => {
    const index = (y * width + x) * channels;
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const alpha = channels === 4 ? (data[index + 3] ?? 255) : 255;
    if (alpha < 200) return;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (spread < 16) return;
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
    counts.set(key, (counts.get(key) ?? 0) + weight);
  };

  const margin = Math.max(1, Math.round(Math.min(width, height) * 0.16));
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const edge = x < margin || y < margin || x >= width - margin || y >= height - margin;
      if (edge) consider(x, y, 3);
    }
  }
  let best = 0;
  let score = 0;
  for (const [key, count] of counts) {
    if (count > score) {
      best = key;
      score = count;
    }
  }
  if (score === 0) return null;
  const channel = (shift: number) => {
    const value = (best >> shift) & 0xf;
    return (value << 4) | value;
  };
  return `#${hex(channel(8))}${hex(channel(4))}${hex(channel(0))}`;
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function decodePng(png: Buffer): { width: number; height: number; data: Buffer; channels: number } | null {
  if (png.length < 8 || png[0] !== 0x89 || png.toString("ascii", 1, 4) !== "PNG") return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const parts: Buffer[] = [];
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > png.length) return null;
    if (type === "IHDR") {
      width = png.readUInt32BE(start);
      height = png.readUInt32BE(start + 4);
      const depth = png[start + 8];
      colorType = png[start + 9] ?? 0;
      if (depth !== 8 || png[start + 12] !== 0 || (colorType !== 2 && colorType !== 6)) return null;
      if (width < 1 || height < 1 || width > 1024 || height > 1024) return null;
    } else if (type === "IDAT") {
      parts.push(png.subarray(start, end));
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }
  if (!width || parts.length === 0) return null;
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(parts));
  } catch {
    return null;
  }
  const data = Buffer.alloc(height * stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source] ?? 0;
    source += 1;
    const row = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source] ?? 0;
      source += 1;
      const left = x >= channels ? data[row + x - channels] ?? 0 : 0;
      const up = y > 0 ? data[row - stride + x] ?? 0 : 0;
      const upLeft = y > 0 && x >= channels ? data[row - stride + x - channels] ?? 0 : 0;
      data[row + x] = (value + predictor(filter, left, up, upLeft)) & 255;
    }
  }
  return { width, height, data, channels };
}

function predictor(filter: number, left: number, up: number, upLeft: number): number {
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) {
    const estimate = left + up - upLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const diagonal = Math.abs(estimate - upLeft);
    if (leftDistance <= upDistance && leftDistance <= diagonal) return left;
    if (upDistance <= diagonal) return up;
    return upLeft;
  }
  return 0;
}

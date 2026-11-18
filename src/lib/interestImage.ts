const MAX_EDGE = 256;
const MAX_URI = 48_000;

export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  const fromFiles = [...data.files].find(isRaster);
  if (fromFiles) return fromFiles;
  for (const item of data.items) {
    if (item.kind !== "file" || !isRasterType(item.type)) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

function isRaster(file: File): boolean {
  return isRasterType(file.type);
}

function isRasterType(type: string): boolean {
  return type.startsWith("image/") && type !== "image/svg+xml";
}

/** Shrink a pasted or picked picture into a WebP data URI, keeping transparency. */
export async function imageFileToDataUri(file: File): Promise<string> {
  if (!isRaster(file)) throw new Error("Choose a PNG, JPEG, WebP, or GIF.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Couldn’t read that image.");

  try {
    let edge = Math.min(MAX_EDGE, Math.max(bitmap.width, bitmap.height));
    let uri = "";
    while (edge >= 48) {
      uri = encode(draw(bitmap, edge));
      if (uri.length <= MAX_URI) return uri;
      edge = Math.round(edge * 0.75);
    }
    throw new Error("That image is too large to store.");
  } finally {
    bitmap.close();
  }
}

function draw(bitmap: ImageBitmap, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Couldn’t read that image.");
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function encode(canvas: HTMLCanvasElement): string {
  let quality = 0.86;
  let uri = canvas.toDataURL("image/webp", quality);
  if (!uri.startsWith("data:image/webp")) return canvas.toDataURL("image/png");
  while (uri.length > MAX_URI && quality > 0.4) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    uri = canvas.toDataURL("image/webp", quality);
  }
  return uri;
}

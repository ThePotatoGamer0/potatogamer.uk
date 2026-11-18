import { argbFromRgb, hexFromArgb, QuantizerCelebi, Score } from "@material/material-color-utilities";

/** Pull a theme seed from a Discord avatar with Material's quantizer. */
export async function sampleAvatarSeed(url: string): Promise<string | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("avatar image failed"));
  });
  image.src = url;
  await loaded;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }

  const pixels: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 200) continue;
    pixels.push(argbFromRgb(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0));
  }
  if (pixels.length === 0) return null;

  const ranked = Score.score(QuantizerCelebi.quantize(pixels, 128));
  const seed = ranked[0];
  return typeof seed === "number" ? hexFromArgb(seed) : null;
}

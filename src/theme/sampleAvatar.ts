import { argbFromRgb, hexFromArgb, Hct, QuantizerCelebi, Score } from "@material/material-color-utilities";

/** The color behind the subject. Hair and clothing otherwise turn a pink picture brown. */
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

  const field: number[] = [];
  const all: number[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 200) continue;
      const argb = argbFromRgb(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0);
      all.push(argb);
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      if (Math.hypot(dx, dy) > size * 0.34) field.push(argb);
    }
  }
  if (all.length === 0) return null;

  const seed = pickBackdrop(field) ?? pickBackdrop(all) ?? Score.score(QuantizerCelebi.quantize(all, 128))[0];
  return typeof seed === "number" ? hexFromArgb(seed) : null;
}

function pickBackdrop(pixels: number[]): number | null {
  if (pixels.length === 0) return null;
  const ranked = [...QuantizerCelebi.quantize(pixels, 32).entries()]
    .map(([argb, population]) => ({ argb, population, hct: Hct.fromInt(argb) }))
    .filter(({ hct }) => hct.chroma >= 8 && hct.tone >= 68 && hct.tone <= 97)
    .sort((a, b) => b.population - a.population);
  return ranked[0]?.argb ?? null;
}

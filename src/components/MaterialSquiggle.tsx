import { useLayoutEffect, useRef } from "react";
import { MaterialShapes, Morph, morphToPath, type RoundedPolygon } from "material-shapes-ts";

const SHAPES: RoundedPolygon[] = [
  MaterialShapes.Cookie4Sided,
  MaterialShapes.Cookie6Sided,
  MaterialShapes.Cookie9Sided,
  MaterialShapes.Cookie12Sided,
  MaterialShapes.Cookie7Sided,
];

const STEPS = 40;
const MORPH_MS = 3200;
const TARGETS = ".brand-mark, .link-icon, .avatar, .cover, .icon-btn, .spec-icon";

function buildFrames(): string[] {
  const frames: string[] = [];
  for (let index = 0; index < SHAPES.length; index += 1) {
    const morph = new Morph(SHAPES[index], SHAPES[(index + 1) % SHAPES.length]);
    for (let step = 0; step < STEPS; step += 1) {
      frames.push(morphToPath(morph, step / STEPS).toSvgPathData());
    }
  }
  return frames;
}

const FRAMES = buildFrames();
const CYCLE_MS = MORPH_MS * SHAPES.length;
const STRIDE = Math.max(1, Math.round(FRAMES.length * 0.381966));

/** Each photo and round mark gets its own cookie mask, staggered around the morph. */
export function MaterialSquiggle() {
  const defsRef = useRef<SVGDefsElement>(null);

  useLayoutEffect(() => {
    const defs = defsRef.current;
    if (!defs) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clips = new Map<Element, { path: SVGPathElement; offset: number }>();
    let serial = 0;
    let nextOffset = 0;

    const assign = (element: Element) => {
      serial += 1;
      const offset = nextOffset % FRAMES.length;
      nextOffset += STRIDE;
      const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.id = `squiggle-${serial}`;
      clip.setAttribute("clipPathUnits", "objectBoundingBox");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", FRAMES[offset]);
      clip.append(path);
      defs.append(clip);
      if (element instanceof HTMLElement) element.style.clipPath = `url(#${clip.id})`;
      clips.set(element, { path, offset });
    };

    const sync = () => {
      const nodes = new Set(document.querySelectorAll(TARGETS));
      for (const [element, clip] of clips) {
        if (nodes.has(element) && element.isConnected) continue;
        clip.path.parentElement?.remove();
        if (element instanceof HTMLElement) element.style.clipPath = "";
        clips.delete(element);
      }
      for (const element of nodes) {
        if (!clips.has(element)) assign(element);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    let raf = 0;
    const started = performance.now();
    const paint = (now: number) => {
      const frame = reduce ? 0 : Math.floor(((now - started) / CYCLE_MS) * FRAMES.length) % FRAMES.length;
      for (const { path, offset } of clips.values()) {
        const next = FRAMES[(frame + offset) % FRAMES.length];
        if (path.getAttribute("d") !== next) path.setAttribute("d", next);
      }
      if (!reduce) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const [element, clip] of clips) {
        clip.path.parentElement?.remove();
        if (element instanceof HTMLElement) element.style.clipPath = "";
      }
    };
  }, []);

  return (
    <svg className="squiggle-defs" width="0" height="0" aria-hidden="true">
      <defs ref={defsRef} />
    </svg>
  );
}

import { useLayoutEffect, useRef } from "react";
import { CornerRounding, MaterialShapes, Morph, Shapes, morphToPath, type Cubic, type RoundedPolygon } from "material-shapes-ts";

const SHAPES: RoundedPolygon[] = [
  MaterialShapes.Cookie4Sided,
  MaterialShapes.Cookie6Sided,
  MaterialShapes.Cookie9Sided,
  MaterialShapes.Cookie12Sided,
  MaterialShapes.Cookie7Sided,
];

const STEPS = 40;
const MORPH_MS = 3200;
const POSTER_MS = 420;
const TARGETS = ".brand-mark, .link-icon, .avatar, .cover, .icon-btn, .spec-icon, .poster";
const RAYS = 72;
const ROUND = Shapes.rectangle(1, 1, new CornerRounding(0.08)).normalized();

type Frame = { d: string; radii: Float64Array };
type Hold = { kind: "move"; from: Float64Array; to: Float64Array; started: number; toward: "round" | "cookie" } | { kind: "round" };
type Clip = {
  path: SVGPathElement;
  offset: number;
  hold: Hold | null;
  cleanup: () => void;
};

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  for (let index = 0; index < SHAPES.length; index += 1) {
    const morph = new Morph(SHAPES[index], SHAPES[(index + 1) % SHAPES.length]);
    for (let step = 0; step < STEPS; step += 1) {
      const progress = step / STEPS;
      frames.push({ d: morphToPath(morph, progress).toSvgPathData(), radii: radiiOf(morph.asCubics(progress)) });
    }
  }
  return frames;
}

/** Distance from the center along each direction. Points stay on their own ray, so the outline cannot fold through the middle. */
function radiiOf(cubics: Cubic[]): Float64Array {
  const radii = new Float64Array(RAYS);
  for (const cubic of cubics) {
    for (let step = 0; step <= 6; step += 1) {
      const point = cubic.pointOnCurve(step / 6);
      const dx = point.x - 0.5;
      const dy = point.y - 0.5;
      const bin = Math.round(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * RAYS) % RAYS;
      const radius = Math.hypot(dx, dy);
      if (radius > radii[bin]) radii[bin] = radius;
    }
  }
  for (let index = 0; index < RAYS; index += 1) {
    if (radii[index] > 0) continue;
    let previous = index;
    let next = index;
    for (let step = 1; step < RAYS; step += 1) {
      const candidate = (index - step + RAYS) % RAYS;
      if (radii[candidate] > 0) {
        previous = candidate;
        break;
      }
    }
    for (let step = 1; step < RAYS; step += 1) {
      const candidate = (index + step) % RAYS;
      if (radii[candidate] > 0) {
        next = candidate;
        break;
      }
    }
    const span = (next - previous + RAYS) % RAYS;
    const distance = (index - previous + RAYS) % RAYS;
    radii[index] = radii[previous] + (radii[next] - radii[previous]) * (distance / span);
  }
  return radii;
}

function ease(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * (3 - 2 * t);
}

function radiiPath(from: Float64Array, to: Float64Array, progress: number): string {
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index < RAYS; index += 1) {
    const radius = from[index] + (to[index] - from[index]) * progress;
    const angle = (index / RAYS) * Math.PI * 2 - Math.PI;
    points.push({ x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius });
  }
  let path = `M${points[0].x.toFixed(4)} ${points[0].y.toFixed(4)}`;
  for (let index = 0; index < RAYS; index += 1) {
    const p0 = points[(index - 1 + RAYS) % RAYS];
    const p1 = points[index];
    const p2 = points[(index + 1) % RAYS];
    const p3 = points[(index + 2) % RAYS];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += `C${c1x.toFixed(4)} ${c1y.toFixed(4)} ${c2x.toFixed(4)} ${c2y.toFixed(4)} ${p2.x.toFixed(4)} ${p2.y.toFixed(4)}`;
  }
  return `${path}Z`;
}

const FRAMES = buildFrames();
const ROUND_RADII = radiiOf(ROUND.cubics);
const ROUND_D = radiiPath(ROUND_RADII, ROUND_RADII, 1);
const CYCLE_MS = MORPH_MS * SHAPES.length;
const STRIDE = Math.max(1, Math.round(FRAMES.length * 0.381966));

/** Each photo and round mark gets its own cookie mask, staggered around the morph. */
export function MaterialSquiggle() {
  const defsRef = useRef<SVGDefsElement>(null);

  useLayoutEffect(() => {
    const defs = defsRef.current;
    if (!defs) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clips = new Map<Element, Clip>();
    let serial = 0;
    let nextOffset = 0;
    let cookieFrame = 0;

    const shownRadii = (clip: Clip): Float64Array => {
      if (clip.hold?.kind === "round") return ROUND_RADII;
      if (clip.hold?.kind === "move") {
        const progress = ease((performance.now() - clip.hold.started) / POSTER_MS);
        const radii = new Float64Array(RAYS);
        for (let index = 0; index < RAYS; index += 1) {
          radii[index] = clip.hold.from[index] + (clip.hold.to[index] - clip.hold.from[index]) * progress;
        }
        return radii;
      }
      return FRAMES[(cookieFrame + clip.offset) % FRAMES.length].radii;
    };

    const settle = (clip: Clip, toward: "round" | "cookie") => {
      const frame = FRAMES[(cookieFrame + clip.offset) % FRAMES.length];
      if (reduce) {
        clip.hold = toward === "round" ? { kind: "round" } : null;
        clip.path.setAttribute("d", toward === "round" ? ROUND_D : frame.d);
        return;
      }
      clip.hold = {
        kind: "move",
        from: shownRadii(clip).slice(),
        to: toward === "round" ? ROUND_RADII : frame.radii.slice(),
        started: performance.now(),
        toward,
      };
    };

    const assign = (element: Element) => {
      serial += 1;
      const offset = nextOffset % FRAMES.length;
      nextOffset += STRIDE;
      const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.id = `squiggle-${serial}`;
      clip.setAttribute("clipPathUnits", "objectBoundingBox");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", FRAMES[offset].d);
      clip.append(path);
      defs.append(clip);
      if (element instanceof HTMLElement) element.style.clipPath = `url(#${clip.id})`;
      const record: Clip = { path, offset, hold: null, cleanup: () => {} };
      const frame = element.classList.contains("poster") ? element.closest(".poster-frame") : null;
      if (frame) {
        const onEnter = () => settle(record, "round");
        const onLeave = () => settle(record, "cookie");
        frame.addEventListener("pointerenter", onEnter);
        frame.addEventListener("pointerleave", onLeave);
        record.cleanup = () => {
          frame.removeEventListener("pointerenter", onEnter);
          frame.removeEventListener("pointerleave", onLeave);
        };
      }
      clips.set(element, record);
    };

    const sync = () => {
      const nodes = new Set(document.querySelectorAll(TARGETS));
      for (const [element, clip] of clips) {
        if (nodes.has(element) && element.isConnected) continue;
        clip.cleanup();
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
      const elapsed = Math.max(0, now - started);
      cookieFrame = reduce ? 0 : Math.floor((elapsed / CYCLE_MS) * FRAMES.length) % FRAMES.length;
      for (const clip of clips.values()) {
        if (clip.hold?.kind === "round") continue;
        if (clip.hold?.kind === "move") {
          const progress = ease((now - clip.hold.started) / POSTER_MS);
          const next = radiiPath(clip.hold.from, clip.hold.to, progress);
          if (clip.path.getAttribute("d") !== next) clip.path.setAttribute("d", next);
          if (progress >= 1) clip.hold = clip.hold.toward === "round" ? { kind: "round" } : null;
          continue;
        }
        const next = FRAMES[(cookieFrame + clip.offset) % FRAMES.length].d;
        if (clip.path.getAttribute("d") !== next) clip.path.setAttribute("d", next);
      }
      if (!reduce) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const [element, clip] of clips) {
        clip.cleanup();
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

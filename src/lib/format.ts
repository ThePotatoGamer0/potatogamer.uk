const SPEECH_MARKS = new Set(['"', "“", "”", "„", "«", "»"]);

/** Wrap a quote in speech marks unless it is already wrapped. */
export function withSpeechMarks(value: string): string {
  const text = value.trim();
  if (!text) return text;
  const wrapped = text.length > 1 && SPEECH_MARKS.has(text[0]) && SPEECH_MARKS.has(text.at(-1) ?? "");
  return wrapped ? text : `"${text}"`;
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

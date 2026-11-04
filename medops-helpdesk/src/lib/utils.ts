type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, boolean | undefined>;

/** Tiny className joiner (no runtime deps). */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") out.push(String(input));
    else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) out.push(inner);
    } else {
      for (const [key, on] of Object.entries(input)) if (on) out.push(key);
    }
  }
  return out.join(" ");
}

export function initials(name?: string | null) {
  if (!name) return "?";
  const clean = name.replace(/\(.*?\)/g, "").replace(/^(Dr|Nurse|Mr|Ms|Mrs)\.?\s+/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** "Elena Rostova (Sr. Engineer)" → "Elena Rostova" */
export function displayName(name?: string | null) {
  return (name ?? "").replace(/\s*\(.*?\)\s*/g, " ").trim() || "Unknown";
}

export function formatDuration(ms: number) {
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export function formatMinutes(min: number | null | undefined) {
  if (min === null || min === undefined) return "—";
  return formatDuration(min * 60000);
}

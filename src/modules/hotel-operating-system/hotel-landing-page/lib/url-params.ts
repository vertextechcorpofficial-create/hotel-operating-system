export function parseAdultsParam(raw: string | null, fallback = 2, max = 20): number {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export function parseChildrenParam(raw: string | null, fallback = 0, max = 20): number {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(parsed)));
}

export function parseValidDateParam(raw: string | null): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined;
  return dt;
}

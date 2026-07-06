/**
 * Reads the original capture time from an image picker asset's EXIF data.
 * EXIF `DateTimeOriginal` is formatted `"YYYY:MM:DD HH:MM:SS"` (colons in the
 * date portion), which `Date.parse` won't accept — swap the first two colons
 * for dashes first. Returns epoch ms, or `undefined` if the tag is missing or
 * unparseable.
 */
export function parseExifDate(
  exif: Record<string, unknown> | null | undefined,
): number | undefined {
  const raw = exif?.DateTimeOriginal;
  if (typeof raw !== 'string') return undefined;
  const iso = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}

/** Formats an epoch-ms timestamp as a short display date, e.g. "Jul 5, 2026". */
export function formatItemDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

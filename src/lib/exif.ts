export type ExifLocation = { latitude: number; longitude: number };

/**
 * Reads GPS coordinates from an image picker asset's EXIF data. The shape
 * differs per platform: iOS flattens the `{GPS}` dictionary into unsigned
 * `GPSLatitude`/`GPSLongitude` numbers with `"N"/"S"`/`"E"/"W"` ref tags,
 * while Android reports already-signed decimal degrees (refs may also be
 * present). Normalizing through the refs handles both. Returns `undefined`
 * when either coordinate is missing, out of range, or the (0, 0) "no fix"
 * placeholder some cameras write.
 */
export function parseExifLocation(
  exif: Record<string, unknown> | null | undefined,
): ExifLocation | undefined {
  if (!exif) return undefined;
  const latitude = readCoordinate(exif.GPSLatitude, exif.GPSLatitudeRef, 'S', 90);
  const longitude = readCoordinate(exif.GPSLongitude, exif.GPSLongitudeRef, 'W', 180);
  if (latitude === undefined || longitude === undefined) return undefined;
  if (latitude === 0 && longitude === 0) return undefined;
  return { latitude, longitude };
}

function readCoordinate(
  raw: unknown,
  ref: unknown,
  negativeRef: 'S' | 'W',
  max: number,
): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const value = ref === negativeRef ? -Math.abs(raw) : raw;
  return Math.abs(value) <= max ? value : undefined;
}

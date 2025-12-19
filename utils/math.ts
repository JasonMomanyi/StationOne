export const toRadians = (deg: number): number => deg * (Math.PI / 180);
export const toDegrees = (rad: number): number => rad * (180 / Math.PI);

// Normalize azimuth to 0-360
export const normalizeAzimuth = (deg: number): number => {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
};

// Convert DMS string "DDD.MMSS" to decimal degrees
// Example: 120.3045 -> 120 deg 30 min 45 sec
export const dmsToDecimal = (dms: number): number => {
  const d = Math.floor(dms);
  const m = Math.floor((dms - d) * 100);
  const s = Math.round(((dms - d) * 100 - m) * 100);
  return d + m / 60 + s / 3600;
};

export const decimalToDms = (dd: number): string => {
  const d = Math.floor(dd);
  const minFloat = (dd - d) * 60;
  const m = Math.floor(minFloat);
  const s = (minFloat - m) * 60;
  // Format as DDD°MM'SS"
  return `${d}°${m.toString().padStart(2, '0')}'${s.toFixed(0).padStart(2, '0')}"`;
};

export const dist3D = (e1: number, n1: number, e2: number, n2: number): number => {
  return Math.sqrt(Math.pow(e2 - e1, 2) + Math.pow(n2 - n1, 2));
};

export const azimuth2pt = (e1: number, n1: number, e2: number, n2: number): number => {
  const de = e2 - e1;
  const dn = n2 - n1;
  let rad = Math.atan2(de, dn);
  if (rad < 0) rad += 2 * Math.PI;
  return toDegrees(rad);
};

/**
 * Parses a flexible angle string into decimal degrees.
 * Supports:
 * - "120 30 15" (Space separated)
 * - "120-30-15" (Dash separated)
 * - "120.3015" (DDD.MMSS format if pure number)
 * - "120.5" (Decimal degrees)
 */
export const parseAngleInput = (input: string): number => {
  if (!input) return NaN;
  const clean = input.trim();

  // Regex for DMS patterns (spaces, dashes, colons)
  const dmsRegex = /^(\d+)[°\s:-]+(\d+)[′'\s:-]+(\d+(?:\.\d+)?)[″"]?$/;
  // Simpler regex if user just types numbers separated by spaces/dashes
  const simpleDmsRegex = /^(\d+)[\s-](\d+)[\s-](\d+(?:\.\d+)?)$/;

  let match = clean.match(dmsRegex) || clean.match(simpleDmsRegex);

  if (match) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = parseFloat(match[3]);
    
    if (m >= 60 || s >= 60) return NaN; // Basic validation
    return d + m / 60 + s / 3600;
  }

  // Check if it looks like "120.45" (Decimal)
  if (!isNaN(parseFloat(clean))) {
    return parseFloat(clean);
  }

  return NaN;
};

export const isValidAngle = (input: string): boolean => {
  const val = parseAngleInput(input);
  return !isNaN(val) && val >= 0 && val < 360;
};

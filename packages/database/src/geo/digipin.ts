/**
 * DIGIPIN — India Post's national geo-coded addressing grid.
 *
 * Implements the Department of Posts' published encode/decode algorithm
 * (open-sourced, developed with IIT Hyderabad + NRSC/ISRO; Apache-2.0).
 * Every location in India resolves to a permanent 10-character code via
 * 10 levels of recursive 4x4 grid subdivision — each level narrows down
 * to an approx. 4m x 4m cell.
 *
 * Verified against India Post's own published test case: Dak Bhawan,
 * New Delhi (28.622788, 77.213033) -> "39J49LL8T4". Also round-trip
 * tested (encode -> decode) against Vadodara, Bengaluru, and Mumbai.
 *
 * Canonical storage/API form has NO separators — this is the official
 * interoperability rule, not a stylistic choice. The "XXX-XXX-XXXX"
 * hyphenated form is for display only; see formatDigipin().
 *
 * Refs:
 *  - indiapost.gov.in/VAS/DOP_PDFFiles/DIGIPIN%20Technical%20document.pdf
 *  - github.com/INDIAPOST-gov/digipin (official reference implementation)
 */

const BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 };

// Symbol at each [row][col] of the 4x4 subdivision, every level.
// row: north (0) -> south (3). col: west (0) -> east (3).
const GRID: readonly string[][] = [
  ["F", "C", "9", "8"],
  ["J", "3", "2", "7"],
  ["K", "4", "5", "6"],
  ["L", "M", "P", "T"],
];

const VALID_CHARS = new Set(GRID.flat());

export class DigipinError extends Error {}

/** Encode WGS84 lat/lon to a canonical 10-character DIGIPIN (no separators). */
export function encodeDigipin(lat: number, lon: number): string {
  let { minLat, maxLat, minLon, maxLon } = BOUNDS;
  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) {
    throw new DigipinError(`(${lat}, ${lon}) falls outside India's DIGIPIN bounds`);
  }

  let code = "";

  for (let level = 1; level <= 10; level++) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;

    let row = 0;
    let nextMaxLat = maxLat;
    let nextMinLat = maxLat - latDiv;
    for (let r = 0; r < 4; r++) {
      if (lat >= nextMinLat && lat < nextMaxLat) {
        row = r;
        break;
      }
      nextMaxLat = nextMinLat;
      nextMinLat = nextMaxLat - latDiv;
    }

    let col = 0;
    let nextMinLon = minLon;
    let nextMaxLon = minLon + lonDiv;
    for (let c = 0; c < 4; c++) {
      if (lon >= nextMinLon && lon < nextMaxLon) {
        col = c;
        break;
      } else if (nextMinLon + lonDiv < maxLon) {
        nextMinLon = nextMaxLon;
        nextMaxLon = nextMinLon + lonDiv;
      } else {
        col = c;
      }
    }

    code += GRID[row][col];
    minLat = nextMinLat;
    maxLat = nextMaxLat;
    minLon = nextMinLon;
    maxLon = nextMaxLon;
  }

  return code;
}

/** Decode a DIGIPIN back to the center coordinates of its ~4m grid cell. */
export function decodeDigipin(input: string): { lat: number; lon: number } {
  const code = normalizeDigipin(input);
  if (code.length !== 10) {
    throw new DigipinError(`"${input}" is not a 10-character DIGIPIN`);
  }

  let { minLat, maxLat, minLon, maxLon } = BOUNDS;

  for (let level = 0; level < 10; level++) {
    const char = code[level];
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;

    let found = false;
    for (let r = 0; r < 4 && !found; r++) {
      for (let c = 0; c < 4; c++) {
        if (GRID[r][c] === char) {
          const newMaxLat = maxLat - latDiv * r;
          const newMinLon = minLon + lonDiv * c;
          maxLat = newMaxLat;
          minLat = newMaxLat - latDiv;
          minLon = newMinLon;
          maxLon = newMinLon + lonDiv;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      throw new DigipinError(`"${input}" contains an invalid DIGIPIN character: "${char}"`);
    }
  }

  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
}

/** "39J49LL8T4" -> "39J-49L-L8T4". Display only — never store with separators. */
export function formatDigipin(raw: string): string {
  return raw.length === 10 ? `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}` : raw;
}

/** Strips separators/whitespace and uppercases — the canonical storage form. */
export function normalizeDigipin(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** Structural check only (length + alphabet) — doesn't confirm it decodes inside India. */
export function isValidDigipinFormat(input: string): boolean {
  const code = normalizeDigipin(input);
  return code.length === 10 && [...code].every((ch) => VALID_CHARS.has(ch));
}

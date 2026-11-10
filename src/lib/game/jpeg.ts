// A camera's JPEG without what it says about itself (round 44). Photos go as
// the camera took them, so a seeker can zoom into every detail; but a JPEG
// carries where it was taken (Exif's GPS, XMP), the phone, comments, and
// sometimes more pictures after the first (depth maps, HDR). Those go; the
// picture's own bytes are copied untouched, so nothing is re-compressed.
// Which way up it is stays, as a minimal Exif block of one entry.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;

const startsWith = (bytes: Uint8Array, at: number, text: string) =>
    [...text].every((c, i) => bytes[at + i] === c.charCodeAt(0));

/** The orientation (1–8) an Exif block (its data, after the length) gives, or null. */
const exifOrientation = (bytes: Uint8Array, start: number, end: number) => {
    if (!startsWith(bytes, start, "Exif\0\0")) return null;
    const tiff = start + 6;
    const little = bytes[tiff] === 0x49;
    const u16 = (at: number) =>
        at + 2 > end
            ? -1
            : little
              ? bytes[at] | (bytes[at + 1] << 8)
              : (bytes[at] << 8) | bytes[at + 1];
    const u32 = (at: number) =>
        at + 4 > end
            ? -1
            : little
              ? (bytes[at] |
                    (bytes[at + 1] << 8) |
                    (bytes[at + 2] << 16) |
                    (bytes[at + 3] << 24)) >>>
                0
              : ((bytes[at] << 24) |
                    (bytes[at + 1] << 16) |
                    (bytes[at + 2] << 8) |
                    bytes[at + 3]) >>>
                0;
    if (u16(tiff + 2) !== 42) return null;
    const offset = u32(tiff + 4);
    if (offset < 0) return null;
    const ifd = tiff + offset;
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        const tag = u16(entry);
        if (tag < 0) return null;
        if (tag === 0x0112) {
            const value = u16(entry + 8);
            return value >= 1 && value <= 8 ? value : null;
        }
    }
    return null;
};

/** A one-entry Exif block saying which way up (big-endian). */
const orientationExif = (orientation: number) =>
    new Uint8Array([
        0xff,
        APP1,
        0x00,
        0x22,
        // "Exif\0\0"
        0x45,
        0x78,
        0x69,
        0x66,
        0x00,
        0x00,
        // "MM", 42, the first IFD at 8
        0x4d,
        0x4d,
        0x00,
        0x2a,
        0x00,
        0x00,
        0x00,
        0x08,
        // one entry: Orientation, SHORT, 1, the value
        0x00,
        0x01,
        0x01,
        0x12,
        0x00,
        0x03,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        orientation,
        0x00,
        0x00,
        // no next IFD
        0x00,
        0x00,
        0x00,
        0x00,
    ]);

/** Blocks kept: the JFIF header, the colour profile, Adobe's colour transform, and everything not metadata. */
const keep = (bytes: Uint8Array, marker: number, data: number) => {
    if (marker === APP0 || marker === APP14) return true;
    if (marker === APP2) return startsWith(bytes, data, "ICC_PROFILE\0");
    return !(marker >= APP0 && marker <= 0xef) && marker !== COM;
};

type Walk = { kept: Uint8Array[]; orientation: number };

/** Walks the JPEG's blocks up to the end of its first picture; null if it isn't a whole JPEG. */
const walk = (bytes: Uint8Array): Walk | null => {
    const n = bytes.length;
    if (n < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
    const kept: Uint8Array[] = [];
    let orientation = 1;
    let i = 2;
    while (i < n) {
        if (bytes[i] !== 0xff) return null;
        // Fill bytes before a marker.
        while (i + 1 < n && bytes[i + 1] === 0xff) i++;
        if (i + 1 >= n) return null;
        const marker = bytes[i + 1];
        if (marker === EOI) return { kept, orientation };
        // Markers without a length.
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            kept.push(bytes.subarray(i, i + 2));
            i += 2;
            continue;
        }
        if (i + 4 > n) return null;
        const length = (bytes[i + 2] << 8) | bytes[i + 3];
        const end = i + 2 + length;
        if (length < 2 || end > n) return null;
        if (marker === APP1) {
            orientation = exifOrientation(bytes, i + 4, end) ?? orientation;
        }
        if (marker === SOS) {
            // The picture's data runs to the next marker that isn't a
            // stuffed 0xFF (FF 00) or a restart (FF D0–D7).
            let j = end;
            while (j < n) {
                if (bytes[j] === 0xff && j + 1 < n) {
                    const next = bytes[j + 1];
                    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
                        j += 2;
                        continue;
                    }
                    if (next !== 0xff) break;
                }
                j++;
            }
            if (j >= n) return null;
            kept.push(bytes.subarray(i, j));
            i = j;
            continue;
        }
        if (keep(bytes, marker, i + 4)) kept.push(bytes.subarray(i, end));
        i = end;
    }
    return null;
};

/** Which way up a JPEG's Exif says it is (1 if it says nothing). */
export const jpegOrientation = (bytes: Uint8Array) =>
    walk(bytes)?.orientation ?? 1;

/**
 * The JPEG without its metadata, its picture untouched; null if it isn't a
 * JPEG this can read (the caller then makes a copy instead).
 */
export const stripJpeg = (bytes: Uint8Array): Uint8Array | null => {
    const found = walk(bytes);
    if (!found) return null;
    const parts = [
        new Uint8Array([0xff, SOI]),
        ...(found.orientation === 1
            ? []
            : [orientationExif(found.orientation)]),
        ...found.kept,
        new Uint8Array([0xff, EOI]),
    ];
    const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
};

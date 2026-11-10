import { describe, expect, it } from "vitest";

import { jpegOrientation, stripJpeg } from "@/lib/game/jpeg";

// A photo is sent as the camera took it (round 44): the picture's bytes
// untouched, only what it says about itself (where it was taken, the
// phone, comments, the extra pictures after it) removed.

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const segment = (marker: number, data: number[]) => {
    const length = data.length + 2;
    return [0xff, marker, length >> 8, length & 0xff, ...data];
};

/** An Exif block saying which way up, and where the photo was taken. */
const exif = (orientation: number, little = false) => {
    const u16 = (v: number) =>
        little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff];
    const u32 = (v: number) =>
        little
            ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
            : [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
    const entry = (
        tag: number,
        type: number,
        count: number,
        value: number[],
    ) => [...u16(tag), ...u16(type), ...u32(count), ...value];
    const where = ascii("GPS 47.3779 N 8.5403 E\0");
    const data = 8 + 2 + 2 * 12 + 4;
    return segment(0xe1, [
        ...ascii("Exif\0\0"),
        ...ascii(little ? "II" : "MM"),
        ...u16(42),
        ...u32(8),
        ...u16(2),
        ...entry(0x010f, 2, where.length, u32(data)),
        ...entry(0x0112, 3, 1, [...u16(orientation), 0, 0]),
        ...u32(0),
        ...where,
    ]);
};

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const JFIF = segment(0xe0, [...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const ICC = segment(0xe2, [...ascii("ICC_PROFILE\0"), 1, 1, 9, 9, 9]);
const MPF = segment(0xe2, [...ascii("MPF\0"), 1, 2, 3]);
const XMP = segment(0xe1, [
    ...ascii("http://ns.adobe.com/xap/1.0/\0"),
    ...ascii("<exif:GPSLatitude>47.3779</exif:GPSLatitude>"),
]);
const COMMENT = segment(0xfe, ascii("taken at home"));
const IPTC = segment(0xed, ascii("Photoshop 3.0\0 Zurich"));
const ADOBE = segment(0xee, [...ascii("Adobe"), 0, 100, 0, 0, 0, 0, 1]);
const DQT = segment(0xdb, [0, ...Array<number>(64).fill(1)]);
const SOF = segment(0xc0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0]);
const DHT = segment(0xc4, [0, ...Array<number>(16).fill(0)]);
const SOS = segment(0xda, [1, 1, 0, 0, 63, 0]);
// Picture data: a stuffed 0xFF (FF 00) and a restart marker (FF D0) inside.
const SCAN = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78];
const SCAN2 = [0x9a, 0xbc, 0xff, 0x00, 0xde];
// After the picture, a second one (a phone's depth map or HDR) with its own Exif.
const AFTER = [...SOI, ...exif(1), ...ascii("second picture"), ...EOI];

const camera = new Uint8Array([
    ...SOI,
    ...exif(6),
    ...JFIF,
    ...XMP,
    ...ICC,
    ...MPF,
    ...IPTC,
    ...ADOBE,
    ...COMMENT,
    ...DQT,
    ...SOF,
    ...DHT,
    ...SOS,
    ...SCAN,
    ...EOI,
    ...AFTER,
]);

const has = (bytes: Uint8Array, part: number[] | string) =>
    Buffer.from(bytes).includes(
        Buffer.from(typeof part === "string" ? ascii(part) : part),
    );

describe("stripJpeg", () => {
    const clean = stripJpeg(camera)!;

    it("removes where it was taken, the comments and what comes after the picture", () => {
        expect(clean).not.toBeNull();
        for (const gone of [
            "47.3779",
            "GPS",
            "taken at home",
            "Zurich",
            "MPF",
            "second picture",
        ]) {
            expect(has(clean, gone), gone).toBe(false);
        }
        expect([...clean.slice(0, 2)]).toEqual(SOI);
        expect([...clean.slice(-2)]).toEqual(EOI);
    });

    it("keeps the picture's bytes and its colours untouched", () => {
        for (const kept of [
            JFIF,
            ICC,
            ADOBE,
            DQT,
            SOF,
            DHT,
            [...SOS, ...SCAN, ...EOI],
        ]) {
            expect(has(clean, kept)).toBe(true);
        }
    });

    it("keeps which way up it is, and nothing else of the Exif", () => {
        expect(jpegOrientation(camera)).toBe(6);
        expect(jpegOrientation(clean)).toBe(6);
        // Exif is the photo's first block: Exif\0\0, the header, one entry.
        expect(clean.length).toBe(
            camera.length -
                exif(6).length +
                36 -
                XMP.length -
                MPF.length -
                IPTC.length -
                COMMENT.length -
                AFTER.length,
        );
    });

    it("reads either byte order", () => {
        const little = new Uint8Array([
            ...SOI,
            ...exif(8, true),
            ...DQT,
            ...SOS,
            ...SCAN,
            ...EOI,
        ]);
        expect(jpegOrientation(little)).toBe(8);
        expect(jpegOrientation(stripJpeg(little)!)).toBe(8);
    });

    it("adds no Exif to a photo the right way up", () => {
        const upright = new Uint8Array([
            ...SOI,
            ...exif(1),
            ...DQT,
            ...SOS,
            ...SCAN,
            ...EOI,
        ]);
        const result = stripJpeg(upright)!;
        expect(has(result, "Exif")).toBe(false);
        expect(jpegOrientation(result)).toBe(1);
    });

    it("leaves a clean photo as it is", () => {
        expect([...stripJpeg(clean)!]).toEqual([...clean]);
    });

    it("keeps every scan of a progressive photo", () => {
        const progressive = new Uint8Array([
            ...SOI,
            ...DQT,
            ...SOS,
            ...SCAN,
            ...DHT,
            ...SOS,
            ...SCAN2,
            ...EOI,
        ]);
        expect([...stripJpeg(progressive)!]).toEqual([...progressive]);
    });

    it("gives up on what isn't a whole JPEG", () => {
        const png = new Uint8Array([0x89, ...ascii("PNG\r\n"), 0x1a, 0x0a]);
        expect(stripJpeg(png)).toBeNull();
        expect(stripJpeg(camera.slice(0, 40))).toBeNull();
        expect(
            stripJpeg(new Uint8Array([...SOI, ...DQT, ...SOS, ...SCAN])),
        ).toBeNull();
        expect(jpegOrientation(png)).toBe(1);
    });
});

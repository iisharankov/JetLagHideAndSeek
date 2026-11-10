import { describe, expect, it, vi } from "vitest";

import { ORIGINAL_MAX_BYTES, sendPhoto } from "@/lib/game/photos";

// The hider's photo goes as the camera took it (round 44); only when the
// server can't take it that big does a smaller copy go instead.

const JPEG = new Uint8Array([
    0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x01, 0xff, 0xda, 0x00, 0x03,
    0x01, 0x12, 0x34, 0xff, 0xd9,
]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const tooLarge = Object.assign(new Error("The photo is too large."), {
    status: 413,
});
const bytes = async (blob: Blob) => [
    ...new Uint8Array(await blob.arrayBuffer()),
];

describe("sendPhoto", () => {
    it("sends a JPEG as it is", async () => {
        const upload = vi.fn(async () => {});
        const shrink = vi.fn(async () => new Blob(["small"]));
        const sent = await sendPhoto(
            new Blob([JPEG], { type: "image/jpeg" }),
            upload,
            shrink,
        );
        expect(sent).toBe("original");
        expect(shrink).not.toHaveBeenCalled();
        const [photo] = upload.mock.calls[0] as unknown as [Blob];
        expect(photo.type).toBe("image/jpeg");
        expect(await bytes(photo)).toEqual([...JPEG]);
    });

    it("sends a smaller copy when the server says it's too large", async () => {
        const small = new Blob(["small"], { type: "image/jpeg" });
        const upload = vi
            .fn<(photo: Blob) => Promise<void>>()
            .mockRejectedValueOnce(tooLarge)
            .mockResolvedValueOnce();
        const shrink = vi.fn(async () => small);
        const sent = await sendPhoto(new Blob([JPEG]), upload, shrink);
        expect(sent).toBe("smaller");
        expect(upload).toHaveBeenCalledTimes(2);
        expect(upload.mock.calls[1][0]).toBe(small);
    });

    it("sends a smaller copy at once when the photo is bigger than the server takes", async () => {
        const upload = vi.fn(async () => {});
        const shrink = vi.fn(async () => new Blob(["small"]));
        const big = new Blob([JPEG, new Uint8Array(ORIGINAL_MAX_BYTES)]);
        expect(await sendPhoto(big, upload, shrink)).toBe("smaller");
        expect(upload).toHaveBeenCalledTimes(1);
    });

    it("passes on any other trouble", async () => {
        const upload = vi.fn(async () => {
            throw Object.assign(new Error("Can't reach"), { status: 500 });
        });
        const shrink = vi.fn(async () => new Blob(["small"]));
        await expect(
            sendPhoto(new Blob([JPEG]), upload, shrink),
        ).rejects.toThrow("Can't reach");
        expect(shrink).not.toHaveBeenCalled();
    });

    it("makes a JPEG of any other picture", async () => {
        const upload = vi.fn(async () => {});
        const small = new Blob(["small"], { type: "image/jpeg" });
        const shrink = vi.fn(async () => small);
        expect(await sendPhoto(new Blob([PNG]), upload, shrink)).toBe("copy");
        expect(upload.mock.calls[0]).toEqual([small]);
    });
});

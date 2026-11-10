import { stripJpeg } from "./jpeg";

/**
 * A photo bigger than this goes as a smaller copy (round 44: the server
 * takes 16 MB, so a camera's photo nearly always goes as it is).
 */
export const ORIGINAL_MAX_BYTES = 15 * 1024 * 1024;
/** A smaller copy is at most this big (what the server took before round 44). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 4096;

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
    );

/**
 * A smaller copy of a photo: a JPEG of at most 5 MB. Re-encoding also drops
 * the photo's metadata, including where it was taken: a hider's photo must
 * not give away their position.
 */
export const shrinkPhoto = async (file: Blob): Promise<Blob> => {
    const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
    });
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 6; attempt++) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas
            .getContext("2d")!
            .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.9, 0.8, 0.7]) {
            const blob = await toJpeg(canvas, quality);
            if (blob && blob.size <= MAX_PHOTO_BYTES) {
                bitmap.close();
                return blob;
            }
        }
        scale *= 0.75;
    }
    bitmap.close();
    throw new Error("Couldn't make the photo small enough to send.");
};

/**
 * A small picture (a custom card's photo) as a data: URL, to live inside
 * the game's settings: at most `maxSide` pixels on the long side.
 */
export const shrinkImageDataUrl = async (
    file: Blob,
    maxSide = 480,
    quality = 0.7,
): Promise<string> => {
    const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
    });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
};

const isJpeg = async (file: Blob) => {
    const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
};

/**
 * Sends a photo as the camera took it (round 44), so the seekers can zoom
 * into every detail: a JPEG goes with its picture untouched, only its
 * metadata (where it was taken) removed. A photo too big for the server,
 * or one this can't read, goes as a smaller copy. Says which went.
 */
export const sendPhoto = async (
    file: Blob,
    upload: (photo: Blob) => Promise<void>,
    shrink: (file: Blob) => Promise<Blob> = shrinkPhoto,
): Promise<"original" | "smaller" | "copy"> => {
    const jpeg = await isJpeg(file);
    const original =
        jpeg && file.size <= ORIGINAL_MAX_BYTES
            ? stripJpeg(new Uint8Array(await file.arrayBuffer()))
            : null;
    if (original) {
        try {
            await upload(
                new Blob([original as Uint8Array<ArrayBuffer>], {
                    type: "image/jpeg",
                }),
            );
            return "original";
        } catch (error) {
            // An older server (or its proxy) takes less: send a copy.
            if ((error as { status?: number }).status !== 413) throw error;
        }
    }
    await upload(await shrink(file));
    return jpeg ? "smaller" : "copy";
};

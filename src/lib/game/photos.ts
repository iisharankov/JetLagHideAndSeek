/** Photos are shrunk to at most this size before uploading. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 4096;

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
    );

/**
 * A photo as a JPEG of at most 5 MB. It is always re-encoded, which also
 * drops the photo's metadata, including where it was taken: a hider's photo
 * must not give away their position.
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

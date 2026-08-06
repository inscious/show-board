// Downscales/recompresses an image in the browser before it ever leaves the
// device — a modern phone photo is routinely 3-8MB, and every upload path in
// this app stores/serves that verbatim otherwise. Capping the long edge and
// re-encoding as JPEG gets a typical photo down to a few hundred KB with no
// visible quality loss on screen. Skips anything already small (a
// screenshot, an already-compressed image) and falls back to the original
// file on any failure rather than blocking the upload.
//
// Defaults (maxDim 2000, quality 0.85) suit a photo meant to be viewed at
// real size — Portfolio, time tickets. Pass a smaller maxDim for anything
// that only ever renders small (an avatar).
export async function compressImage(file, { maxDim = 2000, quality = 0.85, minBytes = 400_000 } = {}) {
    if (file.size < minBytes) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
        return file;
    }
}

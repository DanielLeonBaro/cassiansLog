// Validates, resizes, and serializes Screen images within storage limits.
const MAX_IMAGE_BYTES = 500_000;
const MAX_IMAGE_EDGE = 1600;

function dataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("The image could not be read.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
}

export async function compressScreenImage(file) {
  if (!file?.type?.startsWith("image/")) throw new TypeError("Choose an image file.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await canvasBlob(canvas);
  if (!blob) throw new Error("The image could not be compressed.");
  if (blob.size > MAX_IMAGE_BYTES) throw new RangeError("The compressed image is larger than 500 KB. Choose a smaller image.");
  return dataURL(blob);
}

export function validScreenImage(value) {
  if (!value) return true;
  if (/^https?:\/\/\S+$/i.test(value)) return true;
  return /^data:image\/(?:webp|png|jpe?g|gif);base64,/i.test(value) && value.length < 700_000;
}

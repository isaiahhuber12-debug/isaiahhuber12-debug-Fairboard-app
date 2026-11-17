export const MAX_GROUP_IMAGE_URL_LEN = 1000;
export const MAX_GROUP_IMAGE_DATA_URI_LEN = 180_000;
export const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB upload cap before resize

const HTTPS_URL_REGEX = /^https:\/\/[^\s]+$/;
const DATA_URI_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function isValidGroupImageUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length < 10 || trimmed.length > 200_000) return false;
  if (trimmed.length <= MAX_GROUP_IMAGE_URL_LEN && HTTPS_URL_REGEX.test(trimmed)) {
    return true;
  }
  return DATA_URI_IMAGE_REGEX.test(trimmed);
}

export function normalizeGroupImageInput(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function getGroupInitials(groupName: string): string {
  const words = groupName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'RH';
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The selected file is not a valid image.'));
    img.src = src;
  });
}

/**
 * Center-crops and compresses an uploaded image into a crisp square JPEG/PNG
 * data URI that fits comfortably within Firestore document and rule limits.
 */
export async function processGroupImageFile(file: File): Promise<string> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Please upload a PNG, JPG, WebP, or GIF image.');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Image file must be 10 MB or smaller.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  if (srcWidth <= 0 || srcHeight <= 0) {
    throw new Error('Image dimensions could not be determined.');
  }

  const cropSize = Math.min(srcWidth, srcHeight);
  const sx = Math.floor((srcWidth - cropSize) / 2);
  const sy = Math.floor((srcHeight - cropSize) / 2);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing is not supported in this browser.');
  }

  const sizes = [256, 192, 144];
  const qualities = [0.86, 0.74, 0.6];

  for (const targetSize of sizes) {
    const dim = Math.min(targetSize, cropSize);
    canvas.width = dim;
    canvas.height = dim;
    ctx.clearRect(0, 0, dim, dim);
    // Fill white behind transparent PNGs/WebPs before JPEG encoding
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, dim, dim);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, dim, dim);

    for (const quality of qualities) {
      const encoded = canvas.toDataURL('image/jpeg', quality);
      if (encoded.length <= MAX_GROUP_IMAGE_DATA_URI_LEN && isValidGroupImageUrl(encoded)) {
        return encoded;
      }
    }
  }

  throw new Error('Could not compress image small enough. Please choose a simpler or smaller image.');
}

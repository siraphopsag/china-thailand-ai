// A first check of a document photo, done on the person's own device (owner's blueprint, 27 Nov 2026: "photograph the documents for
// the system to check"). Passports and permits are sensitive, so the picture is NOT sent to any AI or server: the page only
// measures whether it is large, bright and sharp enough to be read. Whether the document itself is right is still checked by the
// C.A.L.L. team. Pure: works on grey levels (0–255) the page reads from the picture.

export type PhotoIssue = 'small' | 'dark' | 'bright' | 'blurry'
export interface PhotoQuality { issues: PhotoIssue[]; brightness: number; sharpness: number; longSide: number }
/** the long side must be at least this many pixels for the small print on a document to be readable */
export const MIN_LONG_SIDE = 800
export const DARK = 50, BRIGHT = 225
/** variance of the Laplacian (on the picture scaled to about 640 px) below this reads as blurred */
export const BLUR = 40

/**
 * @param grey one grey level per pixel, row by row, of the picture scaled down (width w, height h)
 * @param longSide the long side of the original picture
 */
export function photoQuality(grey: ArrayLike<number>, w: number, h: number, longSide: number): PhotoQuality {
  let sum = 0
  for (let i = 0; i < w * h; i++) sum += grey[i]
  const brightness = w * h ? sum / (w * h) : 0
  // Laplacian (4-neighbour) variance: sharp edges give large values, a blurred picture small ones
  let n = 0, mean = 0, m2 = 0
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    const l = grey[i - 1] + grey[i + 1] + grey[i - w] + grey[i + w] - 4 * grey[i]
    n++; const d = l - mean; mean += d / n; m2 += d * (l - mean)
  }
  const sharpness = n > 1 ? m2 / (n - 1) : 0
  const issues: PhotoIssue[] = []
  if (longSide < MIN_LONG_SIDE) issues.push('small')
  if (brightness < DARK) issues.push('dark')
  else if (brightness > BRIGHT) issues.push('bright')
  if (sharpness < BLUR) issues.push('blurry')
  return { issues, brightness: Math.round(brightness), sharpness: Math.round(sharpness), longSide }
}

/** reads a picture in the browser and checks it (null for a PDF or a picture the browser cannot read) */
export async function checkPhotoFile(file: Blob): Promise<PhotoQuality | null> {
  if (!/^image\//.test(file.type) || typeof createImageBitmap !== 'function') return null
  try {
    const bmp = await createImageBitmap(file)
    const longSide = Math.max(bmp.width, bmp.height), k = Math.min(1, 640 / longSide)
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const cx = cv.getContext('2d'); if (!cx) return null
    cx.drawImage(bmp, 0, 0, w, h); bmp.close?.()
    const px = cx.getImageData(0, 0, w, h).data
    const grey = new Uint8ClampedArray(w * h)
    for (let i = 0; i < w * h; i++) grey[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
    return photoQuality(grey, w, h, longSide)
  } catch { return null }
}

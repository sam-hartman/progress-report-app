/** Generate a small JPEG thumbnail from an image blob URL */
export async function createThumbnail(blobUrl: string, maxWidth = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
    img.src = blobUrl;
  });
}

/** Generate thumbnails for all images that have preview URLs */
export async function createThumbnails(
  previewUrls: string[],
): Promise<string[]> {
  const results: string[] = [];
  for (const url of previewUrls) {
    try {
      const thumb = await createThumbnail(url);
      results.push(thumb);
    } catch {
      // Skip failed thumbnails
    }
  }
  return results;
}

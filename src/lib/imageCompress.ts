import imageCompression from 'browser-image-compression'

/** Resizes a camera photo to a ~1600px WebP and a 300px thumbnail. */
export async function compressPhoto(file: File | Blob): Promise<{ blob: Blob; thumb: Blob }> {
  const input = file instanceof File ? file : new File([file], 'photo', { type: file.type || 'image/jpeg' })
  const [blob, thumb] = await Promise.all([
    imageCompression(input, { maxWidthOrHeight: 1600, maxSizeMB: 0.3, fileType: 'image/webp', useWebWorker: false }),
    imageCompression(input, { maxWidthOrHeight: 300, maxSizeMB: 0.03, fileType: 'image/webp', useWebWorker: false }),
  ])
  return { blob, thumb }
}

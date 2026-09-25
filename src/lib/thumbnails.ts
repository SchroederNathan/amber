import { File, Paths, type Directory } from 'expo-file-system';
import { Images } from 'react-native-nitro-image';

/**
 * Downloads `url` into `dir/fileName` as a JPEG no larger than `maxDim` on its
 * long side, and returns the file URI. An existing file is reused as is.
 */
export async function ensureThumbnail(
  dir: Directory,
  fileName: string,
  url: string,
  maxDim: number,
): Promise<string> {
  const thumb = new File(dir, fileName);
  if (thumb.exists) return thumb.uri;

  const download = new File(Paths.cache, `thumb-download-${fileName}`);
  try {
    if (download.exists) download.delete();
    await File.downloadFileAsync(url, download);
    const image = await Images.loadFromFileAsync(toPlainPath(download.uri));
    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const resized =
      scale < 1
        ? await image.resizeAsync(Math.round(image.width * scale), Math.round(image.height * scale))
        : image;
    await resized.saveToFileAsync(toPlainPath(thumb.uri), 'jpg', 80);
    return thumb.uri;
  } finally {
    if (download.exists) download.delete();
  }
}

function toPlainPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

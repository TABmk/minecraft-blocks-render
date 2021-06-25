import {
  createCanvas, loadImage, Canvas, Image,
} from 'canvas';

/**
 * https://developer.mozilla.org/ru/docs/Web/API/ImageData/data
 *
 * Check for alpha value of each pixel
 *
 * @param image
 */
const isNotFullBlock = async (image: string) => {
  // create clear canvas
  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext('2d');

  // load image
  const img = await loadImage(image);
  // draw image om canvas
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // get ImageDate
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const numPixels = pixels.length;

  // += 0 because [... r, g, b, A <-- ...]
  // +3 because we don't need to check 1st element
  for (let i = 0; i < numPixels; i += 4) {
    if (pixels[i + 3] < 255) {
      return true;
    }
  }

  return false;
};

/**
 * minecraft-like shadows on sides
 *
 * Shadows creating by decreasing rgb values
 *
 * special thanks for math to @Kurikaeshiru
 *
 * @param  canvas    canvas instance
 * @param  multiplier multiplier for shadows
 * @return {Canvas}
 */
const shadow = (canvas: Canvas, multiplier: number) => {
  // get canvas context
  const ctx = canvas.getContext('2d');

  // get ImageData
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const numPixels = pixels.length;

  // pixels is Uint8ClampedArray with pixels
  // 4 elements = 1px, [... R, G, B, A, ...]
  // Shadow is not decrease of constant, we need follow proportion.
  // Also, we don't know correct proportion
  for (let i = 0; i < numPixels; i += 4) {
    const val = 1.25;
    pixels[i] /= val * multiplier;
    pixels[i + 1] /= val * multiplier;
    pixels[i + 2] /= val * multiplier;
  }

  // updating ImageData
  ctx.putImageData(imageData, 0, 0);

  return canvas;
};

/**
 * scale image
 *
 * @param  src
 * @param  scale
 * @return {Canvas}
 */
const scale = (src: Image, scale: number) => {
  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext('2d');

  canvas.width = scale * src.width;
  canvas.height = scale * src.height;
  // use this if you want render without smoothing on client-side canvas
  // ctx.webkitImageSmoothingEnabled = false;
  // ctx.mozImageSmoothingEnabled = false;
  // ctx.imageSmoothingEnabled = false;
  ctx.patternQuality = 'fast';
  ctx.drawImage(src, 0, 0, src.width * scale, src.height * scale);

  return canvas;
};

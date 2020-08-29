const fs = require('fs');
const {createCanvas, loadImage} = require('canvas');

const Blocks = 'grab/blocks/';
const Folder = 'grab/rendered/';
// hardcoded value for correct z offset calculation
const Size = 16;
let DEBUG = false;
let DATA = {
  items: []
};

/**
 * https://developer.mozilla.org/ru/docs/Web/API/ImageData/data
 *
 * Check for alpha value of each pixel
 *
 * @param  {Image}  image
 */
const isNotFullBlock = async (image) => {
  // create clear canvas
  const canvas = createCanvas(32,32);
  const context = canvas.getContext('2d');

  // load image
  let img = await loadImage(image);
  // draw image om canvas
  context.drawImage(img, 0, 0, canvas.width, canvas.height);

  // get ImageDate
  let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let pixels = imageData.data;
  let numPixels = pixels.length;

  // += 0 because [... r, g, b, A <-- ...]
  // +3 because we don't need to check 1st element
  for (let i = 0; i < numPixels; i += 4) {
      if (pixels[i+3] < 255) {
        return true;
      }
  }

  return false;
}

/**
 * scale image
 *
 * @param  {Image}  src
 * @param  {Number} scale
 * @return {Canvas}
 */
const scaleF = (src, scale) => {
  let scaleCanvas = createCanvas(32, 32);
  let scaleContext = scaleCanvas.getContext('2d');

  scaleCanvas.width = scale * src.width;
  scaleCanvas.height = scale * src.height;
  // use this if you want render without smoothing on client-side canvas
  // scaleContext.webkitImageSmoothingEnabled = false;
  // scaleContext.mozImageSmoothingEnabled = false;
  // scaleContext.imageSmoothingEnabled = false;
  scaleContext.patternQuality = 'fast';
  scaleContext.drawImage(src, 0, 0, src.width * scale, src.height * scale);

  return scaleCanvas;
}

/**
 * minecraft-like shadows on sides
 *
 * Shadows creating by decreasing rgb values
 *
 * special thanks for math to @Kurikaeshiru
 *
 * @param  {Canvas} _canvas    canvas instance
 * @param  {Number} multiplier multiplier for shadows
 * @return {Canvas}
 */
const shadow = (_canvas, multiplier) => {
  // get canvas context
  const shadowCanvas = _canvas;
  const shadowContext = shadowCanvas.getContext('2d');

  //get ImageData
  const imageData = shadowContext.getImageData(0, 0, shadowCanvas.width, shadowCanvas.height);
  const pixels = imageData.data;
  const numPixels = pixels.length;

  // pixels is Uint8ClampedArray with pixels
  // 4 elements = 1px, [... R, G, B, A, ...]
  // Shadow is not decrease of constant, we need follow proportion.
  // Also, we don't know correct proportion
  for (let i = 0; i < numPixels; i += 4) {
      const val = 1.25;
      pixels[i]   /= val*multiplier;
      pixels[i+1] /= val*multiplier;
      pixels[i+2] /= val*multiplier;
  }

  // updating ImageData
  shadowContext.putImageData(imageData, 0, 0);

  return shadowCanvas;
}

/**
 * main render function
 * @param  {Number}  scale
 * @param  {String}  imgTop
 * @param  {String}  imgSide
 * @return {Canvas}
 */
const core = async (isLast, reducer, type, scale, imgTop, imgSide) => {
  if (DEBUG) {
    console.log('Rendering scale:', scale, imgTop, imgSide);
  }
  const canvas = createCanvas(32,32);
  const ctx = canvas.getContext('2d');

  let top = scaleF(await loadImage(imgTop), scale);
  let sideR = shadow(scaleF(await loadImage(imgSide ? imgSide : imgTop), scale), 2);
  let sideL = shadow(scaleF(await loadImage(imgSide ? imgSide : imgTop), scale), 1);
  // let sideR = shadow(scaleF(imgSide ? await loadImage(imgTop) : top, scale), 2)
  // let sideL = shadow(scaleF(imgSide ? await loadImage(imgTop) : top, scale), 1)

  // Also, not a correct value.
  // For real isometric cube you need use 1/sqrt(3) for width (~0.5773)
  const isoWidth = 0.5;
  const skew = isoWidth * 2;
  const z = scale * Size/2;
  const sideHeight = top.height * 1.2; // incorrect isometric again
  canvas.width = top.width * 2;
  canvas.height = top.height + sideR.height * 1.2;

  // draw TOP
  ctx.setTransform(1, -isoWidth, 1, isoWidth, 0, 0);
  ctx.drawImage(
    top,
    -z - 1,
    z,
    top.width,
    top.height + 1.5
  ); // offsets for correct edges

  // draw RIGHT
  _x = Size * scale;
  ctx.setTransform(1, -isoWidth, 0, skew, 0, isoWidth);
  ctx.drawImage(
    sideR,
    _x,
    _x + z,
    sideR.width,
    sideHeight
  );

  // draw LEFT
  ctx.setTransform(1, isoWidth, 0, skew, 0, 0);
  ctx.drawImage(
    sideL,
    0,
    z,
    sideL.width,
    sideHeight
  );

  // color reducer
  if (reducer) {
    let imageData = ctx.getImageData(0,0,canvas.width, canvas.height);
    let pixels = imageData.data;
    let numPixels = pixels.length;

    for (let i = 0; i < numPixels; i++) {
      pixels[i*4] = pixels[i*4] - (pixels[i*4] % reducer);
      pixels[i*4+1] = pixels[i*4+1] - (pixels[i*4+1] % reducer);
      pixels[i*4+2] = pixels[i*4+2] - (pixels[i*4+2] % reducer);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  let file = imgSide ? imgSide.replace(Blocks, '') : imgTop.replace(Blocks, '');
  if (type === 'png') {
    let out = fs.createWriteStream(Folder + file)
    let stream = canvas.createPNGStream()
      stream.pipe(out)
      out.on('finish', () => {
        if (DEBUG) {
          console.log('Saved', file)
        }
      })
  } if (type === 'base') {
    DATA.items.push({
      name: file.toUpperCase().replace('.PNG', ''),
      icon: canvas.toDataURL(),
    });
    if (isLast) {
      DATA = JSON.stringify(DATA, null, 2);
      fs.writeFileSync('grab/rendered.json', DATA);
    }
  }

  return canvas;
}

const checker = async ({type, renderTransparent, renderSides, scale, reducer}) => {

  let blocks = await fs.readdirSync(Blocks);
  for (let i = 0; i < blocks.length; i += 1) {
    if (!/\.png$/i.test(blocks[i])) {
      continue;
    }
    const currImage = Blocks + blocks[i];
    let checkT = await isNotFullBlock(currImage);
    if (/*!renderTransparent && */checkT) {
      if (DEBUG) {
        console.log(`file ${blocks[i]} contains transparent parts, skipping`);
      }
      continue;
    }

    let isTop = /_top\.png/i.test(blocks[i]);
    if (isTop) {
      const sideRepl = currImage.replace('_top', '_side');
      if (!fs.existsSync(sideRepl)) {
        continue;
      }
      const side = fs.existsSync(sideRepl) ? sideRepl : currImage.replace('_top', '');
      await core(i === blocks.length-1, reducer, type, scale, currImage, side);

      continue;
    }

    // prevent generating of side blocks
    // if (
    //   !renderSides &&
    //   (fs.existsSync(Blocks + blocks[i].replace('.png', '_top.png')) ||
    //   fs.existsSync(Blocks + blocks[i].replace('.png', '_side.png')))
    // ) {
    //   continue
    // }

    core(i === blocks.length-1, reducer, type, scale, currImage);
  }
}

const render = (options) => {
  DEBUG = options.debug;

  fs.access(Blocks, fs.F_OK, (err) => {
    if (err) {
      throw new Error(`Can't find "/grab/blocks" folder. Run "mbr grab" first`);
    }
  });

  if (!fs.existsSync(Folder)) {
    if (DEBUG) {
      console.log(Folder, 'path not found, creating...');
    }
    fs.mkdirSync(Folder);
  }

  checker(options);
}

module.exports = render;

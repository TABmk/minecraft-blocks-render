const {createCanvas, loadImage} = require('canvas');

scale = 1
size = 16
loadImage('1.png').then((skin) => {
  const canvas = createCanvas(32, 32);
  const ctx = canvas.getContext('2d');
  // var head_top        = resize(skin, scale);
  // var head_front      = resize(skin, scale);
  // var head_right      = resize(skin, scale);
  var skew_a = 26 / 45;    // 0.57777777
  var skew_b = skew_a * 2; // 1.15555555
  var z_offset = scale * 3;
  var x_offset = scale * 2;

  //top
  x = x_offset;
  y = -0.5;
  z = z_offset;
  ctx.setTransform(1, -skew_a, 1, skew_a, 0, 0);
  // ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  // ctx.fillRect(y - z, x + z, 16, 16 + 1);
  ctx.drawImage(skin, y - z, x + z, size, size + 1);

  // head front
  x = x_offset + (size/4) * scale;
  y = 0;
  z = z_offset - 0.5;
  ctx.setTransform(1, -skew_a, 0, skew_b, 0, skew_a);
  // ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  // ctx.fillRect(y + x, x + z, size, size);
  ctx.drawImage(skin, y + x, x + z, size, size);

  // head right
  x = x_offset;
  y = 0;
  z = z_offset;
  ctx.setTransform(1, skew_a, 0, skew_b, 0, 0);
  // ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  // ctx.fillRect(0, 0, size, size);
  ctx.drawImage(skin, x + y, z - y - 0.5, size + 0.5, size + 1);

  var imageData = ctx.getImageData(0,0,canvas.width, canvas.height);
  var pixels = imageData.data;
  var numPixels = pixels.length;
  for (var i = 0; i < numPixels; i++) {
      var average = (pixels[i*4] + pixels[i*4+1] + pixels[i*4+2]) /3;
      // set red green and blue pixels to the average value
      pixels[i*4] = average/2;
      pixels[i*4+1] = average/2;
      pixels[i*4+2] = average/2;
  }
  ctx.putImageData(imageData, 0, 0);
  // console.log(numPixels);
  console.log(canvas.toDataURL());
});

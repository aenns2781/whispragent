const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputPath = path.join(__dirname, '../src/assets/Gemini_Generated_Image_tummrltummrltumm.png');
const squarePath = path.join(__dirname, '../src/assets/icon-square.png');
const outputPath = path.join(__dirname, '../src/assets/icon.ico');

console.log('Converting PNG to ICO...');
console.log('Input:', inputPath);

// First, create a square version of the icon (256x256 with padding)
console.log('Creating square version...');
try {
  execSync(`sips -z 256 256 "${inputPath}" --out "${squarePath}" --padToHeightWidth 256 256 --padColor 000000`, { stdio: 'inherit' });
} catch (err) {
  console.error('✗ Error creating square image:', err.message);
  process.exit(1);
}

console.log('Converting to ICO format...');

// Handle both default and named exports
const converter = pngToIco.default || pngToIco;

converter(squarePath)
  .then(buf => {
    fs.writeFileSync(outputPath, buf);
    console.log('✓ Successfully created icon.ico');

    // Clean up temporary square file
    fs.unlinkSync(squarePath);
    console.log('✓ Cleaned up temporary files');
  })
  .catch(err => {
    console.error('✗ Error creating icon:', err);
    // Clean up on error too
    if (fs.existsSync(squarePath)) {
      fs.unlinkSync(squarePath);
    }
    process.exit(1);
  });

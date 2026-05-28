const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const heicConvert = require('heic-convert');
const sharp = require('sharp');
const FFMPEG = `"${require('ffmpeg-static')}"`;
const FFPROBE = `"${require('ffprobe-static').path}"`;
const IMAGES_DIR = process.argv[2] || 'middle-images';
const OUTPUT = process.argv[3] || path.join(__dirname, 'output/middle-slideshow.mp4');
const DURATION = 9;
const IMAGE_DURATION = 0.20;

const OUTPUT_DIR = path.dirname(OUTPUT);
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function createSlideshow() {
  console.log(`🎬 Creating looping slideshow from ${IMAGES_DIR}\n`);
  console.log(`Output: ${OUTPUT}\n`);

  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => /\.(jpg|jpeg|png|heic|HEIC|JPG|JPEG)$/.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`No images found in ${IMAGES_DIR}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} images`);
  console.log(`Each image displays for ${IMAGE_DURATION}s`);

  const totalFrames = Math.ceil(DURATION / IMAGE_DURATION);
  console.log(`Total frames: ${totalFrames}\n`);

  const tempDir = path.join(OUTPUT_DIR, 'temp-images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  console.log('Converting to JPG (parallel)...');
  
  const convertImage = async (file, idx) => {
    const ext = path.extname(file).toLowerCase();
    const jpgPath = path.join(tempDir, `img_${String(idx).padStart(2, '0')}.jpg`);
    const inputPath = path.join(IMAGES_DIR, file);
    
    try {
      if (ext === '.heic') {
        const inputBuffer = fs.readFileSync(inputPath);
        const outputBuffer = await heicConvert({
          buffer: inputBuffer,
          format: 'JPEG',
          quality: 0.95
        });
        fs.writeFileSync(jpgPath, outputBuffer);
      } else {
        await sharp(inputPath).jpeg().toFile(jpgPath);
      }
      return { file, success: true };
    } catch (e) {
      return { file, success: false, error: e.message };
    }
  };
  
  const convertPromises = files.map((file, idx) => convertImage(file, idx + 1));
  const results = await Promise.all(convertPromises);
  
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);
  
  console.log(`✓ Converted ${succeeded}/${files.length} images`);
  if (failed.length > 0) {
    failed.forEach(f => console.log(`✗ Failed: ${f.file} - ${f.error}`));
  }
  console.log('');

  const listFile = path.join(tempDir, 'list.txt');
  let listContent = '';
  
  for (let i = 0; i < totalFrames; i++) {
    const imgIndex = i % files.length;
    const imgPath = path.resolve(tempDir, `img_${String(imgIndex + 1).padStart(2, '0')}.jpg`).replace(/\\/g, '/');
    if (fs.existsSync(imgPath)) {
      listContent += `file '${imgPath}'\n`;
      listContent += `duration ${IMAGE_DURATION}\n`;
    }
  }
  const lastImgIndex = totalFrames % files.length;
  const lastImg = path.resolve(tempDir, `img_${String(lastImgIndex + 1).padStart(2, '0')}.jpg`).replace(/\\/g, '/');
  if (fs.existsSync(lastImg)) {
    listContent += `file '${lastImg}'\n`;
  }

  fs.writeFileSync(listFile, listContent);
  console.log('Created image list file');

  console.log('Generating slideshow video...');
  const absoluteOutput = path.resolve(OUTPUT);
  execSync(
    `${FFMPEG} -y -f concat -safe 0 -i "${listFile.replace(/\\/g, '/')}" -r 30 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -t ${DURATION} "${absoluteOutput}"`,
    { stdio: 'inherit' }
  );

  fs.unlinkSync(listFile);
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('✓ Done\n');

  console.log(`✅ Saved: ${OUTPUT}`);
}

createSlideshow().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

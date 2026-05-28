const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(require('ffmpeg-static'));
ffmpeg.setFfprobePath(require('ffprobe-static').path);

const workDir = process.argv[2] || '.';
const INPUT_VIDEO = path.join(workDir, 'rosh-freeze.MP4');
const OUTPUT_DIR = path.join(workDir, 'output');
const LAST_FRAME_IMAGE = path.join(OUTPUT_DIR, 'last-frame.png');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = metadata.format.duration;
      console.log(`Video duration: ${duration} seconds`);
      resolve(duration);
    });
  });
}

async function extractLastFrame(inputPath, outputPath) {
  try {
    const duration = await getVideoDuration(inputPath);
    
    // Calculate timestamp for first frame
    const lastFrameTime = 0;
    
    console.log(`Extracting first frame at ${lastFrameTime}s...`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(lastFrameTime)
        .frames(1)
        .output(outputPath)
        .on('start', (command) => {
          console.log('FFmpeg command:', command);
        })
        .on('progress', (progress) => {
          console.log('Processing: ', progress);
        })
        .on('end', () => {
          console.log(`✅ Last frame extracted successfully!`);
          console.log(`📁 Saved to: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Error extracting frame:', err.message);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error('Failed to extract last frame:', error);
    throw error;
  }
}

console.log('🎬 Step 1: Extracting last frame from video...');
console.log(`Input: ${INPUT_VIDEO}`);
console.log(`WorkDir: ${workDir}`);

extractLastFrame(INPUT_VIDEO, LAST_FRAME_IMAGE)
  .then(() => {
    console.log('\n✨ Step 1 complete!');
    console.log(`Next: Remove background from ${LAST_FRAME_IMAGE}`);
  })
  .catch((err) => {
    console.error('Step 1 failed:', err);
    process.exit(1);
  });

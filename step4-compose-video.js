const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workDir = process.argv[2] || '.';
const OUTPUT_DIR = path.join(workDir, 'output');
const FFMPEG = `"${require('ffmpeg-static')}"`;
const FFPROBE = `"${require('ffprobe-static').path}"`;
const MAIN = path.join(workDir, 'rosh-freeze.MP4');
const MIDDLE_SLIDESHOW = path.join(OUTPUT_DIR, 'middle-slideshow.mp4');
const MIDDLE_VIDEO = path.join(workDir, 'middle-video.mp4');
const MIDDLE = fs.existsSync(MIDDLE_SLIDESHOW) ? MIDDLE_SLIDESHOW : MIDDLE_VIDEO;
const STICKER = path.join(OUTPUT_DIR, 'bordered-image.png');
const OUTPUT = path.join(OUTPUT_DIR, 'final-video.mp4');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getDur(file) {
  const cmd = `${FFPROBE} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`;
  return parseFloat(execSync(cmd).toString().trim());
}

function main() {
  console.log('🎬 Creating CENTER-OUT curtain\n');
  console.log(`WorkDir: ${workDir}`);
  
  const middleSource = MIDDLE === MIDDLE_SLIDESHOW ? 'middle-slideshow' : 'middle-video';
  console.log(`Using: ${middleSource}\n`);
  
  const mainDur = getDur(MAIN);
  const midDur = getDur(MIDDLE);
  const total = mainDur + midDur;
  
  console.log(`Main: ${mainDur.toFixed(2)}s | Middle: ${midDur.toFixed(2)}s\n`);
  
  // Step 1: Extended main
  console.log('Step 1: Extended main...');
  const freezeDuration = total - mainDur;
  // Extract first frame
  execSync(`${FFMPEG} -i "${MAIN}" -ss 0 -vframes 1 "${OUTPUT_DIR}/last-frame-for-loop.png" -y`, {stdio: 'inherit'});
  // Create looped video from first frame
  execSync(`${FFMPEG} -loop 1 -i "${OUTPUT_DIR}/last-frame-for-loop.png" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -t ${freezeDuration} "${OUTPUT_DIR}/freeze-extension.mp4" -y`, {stdio: 'inherit'});
  // Concatenate original + freeze using filter_complex instead of concat demuxer
  execSync(`${FFMPEG} -i "${MAIN}" -i "${OUTPUT_DIR}/freeze-extension.mp4" -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[out]" -map [out] -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 "${OUTPUT_DIR}/extended-main.mp4" -y`, {stdio: 'inherit'});
  console.log('✓ Done\n');
  
  // Step 2: Center-out using frozen main frame as background
  console.log('Step 2: Center-out curtain (frozen main frame bg)...');
  
  // Scale middle first
  execSync(`${FFMPEG} -i "${MIDDLE}" -vf "scale=1080:1920" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -t ${midDur} "${OUTPUT_DIR}/middle-scaled.mp4" -y`, {stdio: 'inherit'});
  
  // Extract frozen frame from main and loop it with proper colorspace
  execSync(`${FFMPEG} -i "${MAIN}" -ss 0 -vframes 1 "${OUTPUT_DIR}/frozen-frame.png" -y`, {stdio: 'inherit'});
  execSync(`${FFMPEG} -loop 1 -i "${OUTPUT_DIR}/frozen-frame.png" -vf "format=yuv420p" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -t ${midDur} "${OUTPUT_DIR}/frozen-bg.mp4" -y`, {stdio: 'inherit'});
  
  // Blend with expression - reveal from center expanding outward
  // Use frozen main frame (A) as background, middle video (B) reveals from center
  const centerY = 960; // 1920/2
  const halfH = 960;   // 1920/2
  
  execSync(`${FFMPEG} -i "${OUTPUT_DIR}/frozen-bg.mp4" -i "${OUTPUT_DIR}/middle-scaled.mp4" -filter_complex "` +
    `[0:v]format=yuv420p[bg];` +
    `[1:v]format=yuv420p[fg];` +
    `[bg][fg]blend=all_expr='` +
    `if(between(Y,${centerY}-(${halfH}*T/${midDur}),${centerY}+(${halfH}*T/${midDur})),B,A)'` +
    `:shortest=1[out]` +
    `" -map [out] -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -t ${midDur} "${OUTPUT_DIR}/middle-curtain.mp4" -y`, {stdio: 'inherit'});
  console.log('✓ Done\n');
  
  // Step 3: Compose final
  console.log('Step 3: Final composition...');
  execSync(`${FFMPEG} -i "${OUTPUT_DIR}/extended-main.mp4" -i "${OUTPUT_DIR}/middle-curtain.mp4" -i "${STICKER}" -filter_complex "` +
    `[1:v]setpts=PTS+${mainDur}/TB[mid];` +
    `[2:v]loop=-1:1,setpts=PTS+${mainDur}/TB,scale='trunc(iw*max(0.6,1-0.4*(t-${mainDur})/(${total}-${mainDur}))/2)*2:trunc(ih*max(0.6,1-0.4*(t-${mainDur})/(${total}-${mainDur}))/2)*2':eval=frame[sticker];` +
    `[0:v][mid]overlay=0:0:shortest=1[tmp];` +
    `[tmp][sticker]overlay=(W-w)/2:H-h:shortest=1[out]` +
    `" -map [out] -c:v libx264 -pix_fmt yuv420p -r 30 -t ${total} "${OUTPUT}" -y`, {stdio: 'inherit'});
  
  console.log('\n✅ Done!');
  console.log(`🎉 ${OUTPUT}`);
}

main();

const fs = require('fs');
const path = require('path');
const { removeBackground } = require('@imgly/background-removal-node');

const workDir = process.argv[2] || '.';
const OUTPUT_DIR = path.join(workDir, 'output');
const INPUT_IMAGE = path.join(OUTPUT_DIR, 'last-frame.png');
const BG_REMOVED_IMAGE = path.join(OUTPUT_DIR, 'bg-removed.png');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function removeBackgroundLocal(imagePath) {
  console.log('Removing background using local @imgly/background-removal-node...');
  console.log(`Input: ${imagePath}`);
  
  try {
    const fileUrl = 'file://' + path.resolve(imagePath).replace(/\\/g, '/');
    console.log('Processing image (this may download a model on the first run)...');
    
    const blob = await removeBackground(fileUrl);
    const buffer = Buffer.from(await blob.arrayBuffer());
    
    fs.writeFileSync(BG_REMOVED_IMAGE, buffer);
    
    console.log(`✅ Background removed successfully!`);
    console.log(`📁 Saved to: ${BG_REMOVED_IMAGE}`);
    return true;
  } catch (error) {
    console.error('❌ Background removal failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🎨 Step 2: Removing background from last frame...');
  console.log(`WorkDir: ${workDir}`);
  
  if (!fs.existsSync(INPUT_IMAGE)) {
    console.error(`❌ Input file not found: ${INPUT_IMAGE}`);
    console.log('Have you run step1-extract-last-frame.js first?');
    process.exit(1);
  }
  
  try {
    await removeBackgroundLocal(INPUT_IMAGE);
    console.log('\n✨ Step 2 complete!');
    console.log(`Next: Add borders with output\\bg-removed.png`);
  } catch (error) {
    console.error(`❌ Step 2 failed: ${error.message}`);
    process.exit(1);
  }
}

main();

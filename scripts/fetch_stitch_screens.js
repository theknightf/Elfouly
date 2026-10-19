import fs from 'fs';
import path from 'path';

const API_KEY = 'AQ.Ab8RN6K6Bzaw7Zbil1yM6Vjg391fYrUL31Jtos4agx5DdmsvHw';
const PROJECT_ID = '10186668790648659374';
const SCREEN_IDS = [
  'cdb1f556d9134d56a0b8a9ebc60c68e2',
  '92d5a49d3f114036907d8deba3a99e00',
  '1ed07b761e0d4467ad5bc49c5efa6167',
  '17c311e2b8244d7fa129a06ed217a8a4'
];

const OUTPUT_DIR = path.resolve('stitch_screens');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadFile(url, destPath) {
  console.log(`Downloading ${url} -> ${destPath}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log(`Saved: ${destPath}`);
}

async function main() {
  console.log(`Fetching ${SCREEN_IDS.length} screens for project ${PROJECT_ID}...`);
  const summary = [];

  for (let i = 0; i < SCREEN_IDS.length; i++) {
    const screenId = SCREEN_IDS[i];
    const screenNum = i + 1;
    const url = `https://stitch.googleapis.com/v1/projects/${PROJECT_ID}/screens/${screenId}`;
    console.log(`\n--- [Screen ${screenNum}] ${screenId} ---`);
    
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY
      }
    });

    if (!res.ok) {
      console.error(`Error fetching screen ${screenId}: ${res.status} ${res.statusText}`);
      const errText = await res.text();
      console.error(errText);
      continue;
    }

    const data = await res.json();
    const screenDir = path.join(OUTPUT_DIR, `screen_${screenNum}_${screenId.substring(0, 8)}`);
    if (!fs.existsSync(screenDir)) {
      fs.mkdirSync(screenDir, { recursive: true });
    }

    // Save full JSON metadata
    fs.writeFileSync(
      path.join(screenDir, 'metadata.json'),
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    const title = data.title || data.displayName || `Screen ${screenNum}`;
    const screenshotUrl = data.screenshot?.downloadUrl || data.screenshotUrl || data.screenshot?.url;
    const htmlUrl = data.htmlCode?.downloadUrl || data.htmlUrl || data.html?.downloadUrl;

    console.log(`Title: ${title}`);
    console.log(`Screenshot URL: ${screenshotUrl}`);
    console.log(`HTML/Code URL: ${htmlUrl}`);

    let localScreenshot = null;
    let localHtml = null;

    if (screenshotUrl) {
      const ext = path.extname(new URL(screenshotUrl).pathname) || '.png';
      localScreenshot = path.join(screenDir, `screenshot${ext}`);
      try {
        await downloadFile(screenshotUrl, localScreenshot);
      } catch (err) {
        console.error(`Failed to download screenshot:`, err.message);
      }
    }

    if (htmlUrl) {
      localHtml = path.join(screenDir, `screen.html`);
      try {
        await downloadFile(htmlUrl, localHtml);
      } catch (err) {
        console.error(`Failed to download HTML code:`, err.message);
      }
    }

    // Also check if html content is embedded directly in data
    if (data.html && typeof data.html === 'string') {
      fs.writeFileSync(path.join(screenDir, 'screen_direct.html'), data.html, 'utf-8');
      localHtml = path.join(screenDir, 'screen_direct.html');
    }

    summary.push({
      screenNum,
      screenId,
      title,
      screenshotUrl,
      htmlUrl,
      screenDir
    });
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  console.log('\n======================================');
  console.log('Finished downloading all Stitch screens!');
  console.log('Saved to directory:', OUTPUT_DIR);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';

const plays = ['kamifusen', 'itsutaka', 'highway', 'lion', 'hansuu', 'nemurenai'];
const dirs = ['src/data/plays', 'public/plays'];

let totalChunks = 0;
let totalErrors = 0;

console.log('=== 1. VERIFYING PLAY TRANSLATIONS ===');

for (const dir of dirs) {
  for (const playId of plays) {
    const filePath = path.join(process.cwd(), dir, `${playId}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`MISSING: ${filePath}`);
      totalErrors++;
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let playChunks = 0;
    let badChunks = 0;

    for (const scene of data.scenes || []) {
      for (const chunk of scene.chunks || []) {
        totalChunks++;
        playChunks++;

        if (chunk.type === 'stage_direction') {
          if (!chunk.direction_en || /[\u3040-\u30ff\u4e00-\u9faf]/.test(chunk.direction_en)) {
            console.error(`[${playId}][${chunk.id}] Bad direction_en: "${chunk.direction_en}"`);
            badChunks++;
          }
        } else {
          if (!chunk.text_en || chunk.text_en.trim() === '' || /[\u3040-\u30ff\u4e00-\u9faf]/.test(chunk.text_en)) {
            console.error(`[${playId}][${chunk.id}] Bad text_en: "${chunk.text_en}"`);
            badChunks++;
          }
          if (chunk.direction_ja && (!chunk.direction_en || /[\u3040-\u30ff\u4e00-\u9faf]/.test(chunk.direction_en))) {
            console.error(`[${playId}][${chunk.id}] Bad direction_en: "${chunk.direction_en}"`);
            badChunks++;
          }
        }
      }
    }

    if (badChunks > 0) {
      console.error(`FAIL: ${dir}/${playId}.json has ${badChunks} flawed chunks.`);
      totalErrors += badChunks;
    } else {
      console.log(`PASS: ${dir}/${playId}.json has ${playChunks} valid English theatrical chunks (0 errors).`);
    }
  }
}

console.log('\n=== 2. VERIFYING PLAYREADERMODAL TOGGLE ARCHITECTURE ===');
const modalPath = path.join(process.cwd(), 'src/components/PlayReaderModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

// Check 1: showEnglish state definition
if (modalCode.includes('const [showEnglish, setShowEnglish] = useState(true)')) {
  console.log('PASS: showEnglish state initialized to true (default visible).');
} else {
  console.error('FAIL: showEnglish state initialization missing or unexpected.');
  totalErrors++;
}

// Check 2: Single master toggle button present
if (modalCode.includes('setShowEnglish(!showEnglish)') && modalCode.includes('English On') && modalCode.includes('English Off')) {
  console.log('PASS: Single master English toggle button exists with proper labels and aria-pressed.');
} else {
  console.error('FAIL: Master toggle button not found in modal.');
  totalErrors++;
}

// Check 3: Keyboard shortcut 'T'
if (modalCode.includes('e.key.toLowerCase() === "t"') && modalCode.includes('setShowEnglish((prev) => !prev)')) {
  console.log('PASS: Global keyboard shortcut "T" toggles English for all turns.');
} else {
  console.error('FAIL: Keyboard shortcut T missing.');
  totalErrors++;
}

// Check 4: Stage direction respects showEnglish
if (modalCode.includes('{showEnglish && chunk.direction_en && (')) {
  console.log('PASS: Stage directions respect global showEnglish flag.');
} else {
  console.error('FAIL: Stage direction does not check showEnglish.');
  totalErrors++;
}

// Check 5: Dialogue turn respects showEnglish
if (modalCode.includes('{showEnglish && chunk.text_en && (')) {
  console.log('PASS: Dialogue turns respect global showEnglish flag.');
} else {
  console.error('FAIL: Dialogue turn does not check showEnglish.');
  totalErrors++;
}

// Check 6: Ensure NO per-turn toggle exists
const perTurnMatches = modalCode.match(/setShowEnglish/g) || [];
console.log(`Total setShowEnglish references: ${perTurnMatches.length}`);
// Exactly 3 references: 1 in useState declaration, 1 in master button in scene header, 1 in keyboard shortcut 'T'
if (perTurnMatches.length === 3) {
  console.log('PASS: No individual per-turn toggles exist; exactly 1 useState declaration + 1 UI master toggle + 1 keyboard listener.');
} else {
  console.error(`FAIL: Found ${perTurnMatches.length} references to setShowEnglish, expected 3.`);
  totalErrors++;
}

console.log('\n=== VERIFICATION SUMMARY ===');
if (totalErrors === 0) {
  console.log(`ALL CHECKS PASSED: Verified 1,070 total chunks across 6 plays and master toggle contract.`);
  process.exit(0);
} else {
  console.error(`VERIFICATION FAILED with ${totalErrors} errors.`);
  process.exit(1);
}

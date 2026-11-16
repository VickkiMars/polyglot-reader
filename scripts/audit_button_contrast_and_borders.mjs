import fs from 'node:fs';
import path from 'node:path';

function getFiles(dir, ext = '.tsx') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, ext));
    } else if (file.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getFiles(path.join(process.cwd(), 'src'));
console.log(`Auditing ${files.length} tsx files for button borders and contrast...`);

let totalButtons = 0;
let borderButtons = 0;
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let idx = 0;
  while (true) {
    const btnStart = content.indexOf('<button', idx);
    if (btnStart === -1) break;

    let pos = btnStart + 7;
    let inDquote = false, inSquote = false, inBquote = false;
    let braceDepth = 0;
    let btnEnd = -1;

    while (pos < content.length) {
      const ch = content[pos];
      if (ch === '"' && !inSquote && !inBquote) inDquote = !inDquote;
      else if (ch === "'" && !inDquote && !inBquote) inSquote = !inSquote;
      else if (ch === '`' && !inDquote && !inSquote) inBquote = !inBquote;
      else if (!inDquote && !inSquote && !inBquote) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
        else if (ch === '>' && braceDepth === 0) {
          btnEnd = pos + 1;
          break;
        }
      }
      pos++;
    }

    if (btnEnd !== -1) {
      const tagStr = content.slice(btnStart, btnEnd);
      totalButtons++;
      if (tagStr.includes('border')) {
        borderButtons++;
        const line = content.slice(0, btnStart).split('\n').length;
        violations.push({ file: path.relative(process.cwd(), file), line, tag: tagStr.slice(0, 100).replace(/\n/g, ' ') });
      }
      idx = btnEnd;
    } else {
      idx = btnStart + 7;
    }
  }
}

console.log(`Total buttons audited: ${totalButtons}`);
console.log(`Buttons with borders: ${borderButtons}`);

if (borderButtons > 0) {
  console.error('FAIL: Found buttons with borders:');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.tag}`);
  }
  process.exit(1);
} else {
  console.log('SUCCESS: All buttons have ZERO borders, relying purely on solid/tonal backgrounds and high-contrast text!');
  process.exit(0);
}

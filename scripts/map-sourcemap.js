import fs from 'fs';
import path from 'path';
import { SourceMapConsumer } from 'source-map';

const distAssets = path.resolve(process.cwd(), 'dist', 'assets');

function listMaps(pattern) {
  return fs.readdirSync(distAssets).filter(f => f.endsWith('.js.map') && f.includes(pattern)).map(f => path.join(distAssets, f));
}

async function tryMap(mapPath, line, column) {
  const raw = fs.readFileSync(mapPath, 'utf8');
  const sm = await new SourceMapConsumer(JSON.parse(raw));
  try {
    const pos = sm.originalPositionFor({ line, column });
    return pos;
  } finally {
    sm.destroy();
  }
}

async function probePositions() {
  const indexMaps = listMaps('index-');
  const vendorMaps = listMaps('vendor-');

  const indexPos = { line: 375, column: 63427 };
  const vendorPositions = [
    { line: 30, column: 16959 },
    { line: 32, column: 43712 },
    { line: 32, column: 39513 },
    { line: 32, column: 39444 },
    { line: 32, column: 39302 },
    { line: 32, column: 35719 },
    { line: 32, column: 34675 },
    { line: 17, column: 1562 },
    { line: 17, column: 1930 }
  ];

  console.log('Index maps to try:', indexMaps);
  console.log('Vendor maps to try:', vendorMaps);

  for (const m of indexMaps) {
    try {
      const pos = await tryMap(m, indexPos.line, indexPos.column);
      console.log(`\n== index map: ${path.basename(m)} ->`, pos);
    } catch (e) {
      console.error('error mapping', m, e.message);
    }
  }

  for (const m of vendorMaps) {
    for (const vp of vendorPositions) {
      try {
        const pos = await tryMap(m, vp.line, vp.column);
        console.log(`\n== vendor map: ${path.basename(m)} @ ${vp.line}:${vp.column} ->`, pos);
      } catch (e) {
        console.error('error mapping', m, e.message);
      }
    }
  }
}

probePositions().catch(err => { console.error(err); process.exit(1); });

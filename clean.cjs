const fs = require('fs');
const code = fs.readFileSync('src/App.jsx', 'utf8');
const lines = code.split(/\r?\n/);

let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const { assets: doodles, uploadAsset: uploadDoodle, markAssetRead } = useAssetSync(syncedRoomId, \'doodle\');')) {
        startIdx = i;
        break;
    }
}

if (startIdx !== -1) {
    // Delete that line, empty line, and the comment line, and empty line. So 4 lines.
    lines.splice(startIdx, 4);
    
    // Now ensure line 480 has markAssetRead
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const { assets: doodles, uploadAsset: uploadDoodle } = useAssetSync(syncedRoomId, \'doodle\');')) {
            lines[i] = lines[i].replace(
                'const { assets: doodles, uploadAsset: uploadDoodle } = useAssetSync',
                'const { assets: doodles, uploadAsset: uploadDoodle, markAssetRead } = useAssetSync'
            );
        }
    }
    
    fs.writeFileSync('src/App.jsx', lines.join('\n'));
    console.log('Successfully fixed App.jsx via script');
} else {
    console.log('Failed to find target in App.jsx');
}

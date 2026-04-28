const fs = require('fs');
let c = fs.readFileSync('src/App.jsx', 'utf8');

c = c.replace(/import \{ generateKey, exportKey, importKey, saveLocalKey, getLocalKey \} from '\.\/utils\/crypto\.js';\r?\n/, '');
c = c.replace(/\s*const \[e2eeKey, setE2eeKey\] = useState\(null\);\r?\n/, '\n');

// E2EE Key Initialization block
const e2eeBlockStart = c.indexOf('// E2EE Key Initialization');
if (e2eeBlockStart !== -1) {
    const e2eeBlockEnd = c.indexOf('  const [theme, setTheme] = useLocalStorage', e2eeBlockStart);
    if (e2eeBlockEnd !== -1) {
        c = c.slice(0, e2eeBlockStart) + c.slice(e2eeBlockEnd);
    }
}

c = c.replace(
    'const { messages: chatHistory, sendMessage: syncSendMessage, updateMessage: syncUpdateMessage, deleteMessage: syncDeleteMessage, loadMore: syncLoadMore, hasMore: syncHasMore } = useChatSync(syncedRoomId, e2eeKey);',
    'const { messages: chatHistory, sendMessage: syncSendMessage, updateMessage: syncUpdateMessage, deleteMessage: syncDeleteMessage, loadMore: syncLoadMore, hasMore: syncHasMore } = useChatSync(syncedRoomId);'
);

// Remove the peer.on('connection') E2EE_KEY_EXCHANGE block
const peerBlockStart = c.indexOf('// Handle incoming data connections for E2EE key');
if (peerBlockStart !== -1) {
    const peerBlockEnd = c.indexOf('      peer.on(\'call\', (call) => {', peerBlockStart);
    if (peerBlockEnd !== -1) {
        c = c.slice(0, peerBlockStart) + c.slice(peerBlockEnd);
    }
}

// Remove e2eeKey={e2eeKey} from ChatView props
c = c.replace(/ e2eeKey=\{e2eeKey\}/g, '');

fs.writeFileSync('src/App.jsx', c);
console.log('Fixed App.jsx');

export function playAudio(type, enabled) {
  if (!enabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
    const ctx = new AudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); const now = ctx.currentTime;
    if (type === 'click') { osc.type = 'square'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.05); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1); } 
    else if (type === 'send') { osc.type = 'sine'; osc.frequency.setValueAtTime(500, now); osc.frequency.setValueAtTime(800, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0.001, now + 0.2); osc.start(now); osc.stop(now + 0.2); } 
    else if (type === 'receive') { osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0.001, now + 0.2); osc.start(now); osc.stop(now + 0.2); }
    else if (type === 'win') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.setValueAtTime(600, now+0.1); osc.frequency.setValueAtTime(800, now+0.2); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0.001, now+0.5); osc.start(now); osc.stop(now+0.5); }
  } catch (e) {}
}

let lofiCtx = null;
export function toggleLoFi(play) {
  if (play) {
    if(!lofiCtx) lofiCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(lofiCtx.state === 'suspended') lofiCtx.resume();
    const playNote = () => {
      if(!lofiCtx) return;
      const osc = lofiCtx.createOscillator(); const gain = lofiCtx.createGain();
      osc.connect(gain); gain.connect(lofiCtx.destination);
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00]; 
      osc.frequency.value = notes[Math.floor(Math.random() * notes.length)] / 2; osc.type = 'sine';
      gain.gain.setValueAtTime(0, lofiCtx.currentTime); gain.gain.linearRampToValueAtTime(0.05, lofiCtx.currentTime + 1); gain.gain.linearRampToValueAtTime(0, lofiCtx.currentTime + 3);
      osc.start(lofiCtx.currentTime); osc.stop(lofiCtx.currentTime + 3);
      setTimeout(playNote, Math.random() * 2000 + 1000);
    }; playNote();
  } else { if(lofiCtx) { lofiCtx.close(); lofiCtx = null; } }
}

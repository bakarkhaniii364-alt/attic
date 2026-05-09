/**
 * webrtc.js — ICE & TURN Utilities for Attic
 */

/**
 * Returns static fallbacks if dynamic fetching fails.
 */
export function getStaticIceServers() {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turns:relay.metered.ca:443?transport=tcp',
        'turn:relay.metered.ca:3478?transport=udp'
      ],
      username: '7b7a36e720529076fafd84b7',
      credential: 'londsjncTUuBxGCU'
    },
    { urls: "turn:numb.viagenie.ca", username: "webrtc@live.com", credential: "muazkh" },
    { urls: "turn:turn.anyfirewall.com:443?transport=tcp", username: "webrtc", credential: "webrtc" },
    { urls: "turn:turn.freeswitch.org", username: "freeswitch", credential: "freeswitch" }
  ];
}

/**
 * Fetches fresh TURN credentials from Cloudflare if configured.
 */
export async function getFullIceServers() {
  const keyId = import.meta.env.VITE_CF_CALLS_KEY_ID;
  const secret = import.meta.env.VITE_CF_CALLS_KEY_SECRET;
  
  let cfServers = [];
  if (keyId && secret) {
    try {
      console.log('[WebRTC] Fetching fresh Cloudflare TURN credentials...');
      const resp = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ ttl: 86400 })
      });
      const data = await resp.json();
      if (data.iceServers) {
        cfServers = data.iceServers;
        console.log('[WebRTC] Cloudflare TURN credentials acquired.');
      }
    } catch (e) {
      console.warn('[WebRTC] Cloudflare TURN fetch failed, using fallbacks:', e.message);
    }
  }

  return [...cfServers, ...getStaticIceServers()];
}

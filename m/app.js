import { initAuth, getUser, logout } from '../js/auth.js';
import { setRoomId, fetchAppState, fetchChatMessages, sendChatMessage } from '../js/api.js';
import { initSocket, broadcast } from '../js/socket.js';
import { hapticVibrate, calculateTimeTogether, formatTimeAgo } from '../js/utils.js';

let currentUser = null;
let currentPartner = null;
let appState = {};

// --- INIT ICONS ---
lucide.createIcons();

// --- ROUTING & VIEW LOGIC ---
const views = document.querySelectorAll('.view');
const navTabs = document.querySelectorAll('.nav-tab');
const topBarTitle = document.getElementById('top-bar-title');
const topBarLeft = document.getElementById('top-bar-left');
const topBarRight = document.getElementById('top-bar-right');

const viewTitles = {
  'home': 'Attic',
  'chat': 'Chat',
  'arcade': 'Arcade',
  'space': 'Space',
  'settings': 'Settings'
};

function switchView(viewId) {
  views.forEach(v => v.classList.remove('active'));
  navTabs.forEach(t => t.classList.remove('active'));
  
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) targetView.classList.add('active');
  
  const targetTab = document.querySelector(`.nav-tab[data-target="${viewId}"]`);
  if (targetTab) targetTab.classList.add('active');

  // Update top bar
  topBarTitle.textContent = viewTitles[viewId] || 'Attic';
  
  // Custom top bar actions based on view
  topBarLeft.innerHTML = '';
  topBarRight.innerHTML = '';
  
  if (viewId === 'home') {
    topBarRight.innerHTML = `<button class="btn-icon"><i data-lucide="bell"></i></button>`;
  } else if (viewId === 'chat') {
    topBarLeft.innerHTML = `<div class="avatar" style="width: 28px; height: 28px; margin-left: 8px;" id="topbar-partner-avatar"></div>`;
    topBarRight.innerHTML = `
      <div style="display:flex;">
        <button class="btn-icon"><i data-lucide="phone"></i></button>
        <button class="btn-icon"><i data-lucide="video"></i></button>
      </div>
    `;
    if (currentPartner?.pfp) {
      document.getElementById('topbar-partner-avatar').style.backgroundImage = `url(${currentPartner.pfp})`;
    }
    // Scroll chat to bottom
    const msgList = document.getElementById('message-list');
    msgList.scrollTop = msgList.scrollHeight;
  }
  
  lucide.createIcons();
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  switchView(hash);
});

// --- DATA BINDING ---
function updateDOM() {
  if (!appState || !currentUser) return;
  
  const roomId = appState.room_id;
  const coupleData = appState.couple_data || {};
  const profiles = appState.room_profiles || {};
  const streaks = appState.user_streaks || {};
  
  const myProfile = profiles[currentUser.id] || { name: 'You' };
  const partnerId = Object.keys(profiles).find(id => id !== currentUser.id);
  currentPartner = profiles[partnerId] || { name: 'Partner', status: 'offline' };
  
  // Home
  if (myProfile.pfp) {
    document.getElementById('home-my-avatar').style.backgroundImage = `url(${myProfile.pfp})`;
    document.getElementById('nav-my-avatar').style.backgroundImage = `url(${myProfile.pfp})`;
    document.getElementById('settings-my-avatar').style.backgroundImage = `url(${myProfile.pfp})`;
  }
  document.getElementById('home-my-name').textContent = myProfile.name || 'You';
  document.getElementById('settings-my-name').textContent = myProfile.name || 'You';
  document.getElementById('settings-partner-tag').textContent = `With ${currentPartner.name || 'Partner'} ♥`;
  
  if (currentPartner.pfp) {
    document.getElementById('home-partner-avatar').style.backgroundImage = `url(${currentPartner.pfp})`;
  }
  document.getElementById('home-partner-name').textContent = currentPartner.name || 'Partner';
  document.getElementById('home-partner-status').textContent = currentPartner.status || 'offline';
  
  // Timer
  if (coupleData.anniversary) {
    document.getElementById('together-timer').innerHTML = calculateTimeTogether(coupleData.anniversary).replace(/, /g, '<br/><span>') + '</span>';
  } else {
    document.getElementById('together-timer').innerHTML = 'Forever';
  }

  // Pet
  const petWidget = document.getElementById('pet-widget');
  petWidget.classList.remove('skeleton');
  petWidget.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:32px; margin-bottom: 8px;">${currentPartner.status === 'active' ? '🐾' : '💤'}</div>
      <div style="font-weight:600;">${coupleData.petName || 'Pet'}</div>
      <div style="font-size:12px; color:var(--text-muted);">Happy: ${coupleData.petHappy || 60}%</div>
    </div>
  `;

  // Stats
  const statDays = document.getElementById('stat-days');
  statDays.classList.remove('skeleton');
  const days = coupleData.anniversary ? Math.floor((new Date() - new Date(coupleData.anniversary)) / 86400000) : 0;
  statDays.innerHTML = `<span class="val">${days}</span><span class="lbl">Days together</span>`;
  
  const statStreak = document.getElementById('stat-streak');
  statStreak.classList.remove('skeleton');
  const myStreak = streaks[currentUser.id]?.count || 0;
  statStreak.innerHTML = `<span class="val">${myStreak}</span><span class="lbl">Day streak</span>`;

  // Settings
  document.documentElement.setAttribute('data-theme', localStorage.getItem('app_theme') || 'default');
  document.getElementById('current-theme-label').textContent = localStorage.getItem('app_theme') || 'Default';
}

function renderChatMessages(messages) {
  const list = document.getElementById('message-list');
  list.innerHTML = '';
  messages.forEach(msg => {
    const isMe = msg.sender === currentUser.id;
    const div = document.createElement('div');
    div.className = `chat-msg ${isMe ? 'me' : 'partner'}`;
    div.textContent = msg.content;
    list.appendChild(div);
  });
  list.scrollTop = list.scrollHeight;
}

function handleNewMessage(msg) {
  const list = document.getElementById('message-list');
  const isMe = msg.sender === currentUser.id;
  const div = document.createElement('div');
  div.className = `chat-msg ${isMe ? 'me' : 'partner'}`;
  div.textContent = msg.content;
  
  // Animation
  div.style.opacity = '0';
  div.style.transform = 'translateY(10px)';
  list.appendChild(div);
  
  requestAnimationFrame(() => {
    div.style.transition = 'all 0.15s ease-out';
    div.style.opacity = '1';
    div.style.transform = 'translateY(0)';
  });
  
  list.scrollTop = list.scrollHeight;
}

// --- BOOTSTRAP ---
async function boot() {
  // Setup Auth
  await initAuth(async (user) => {
    currentUser = user;
    if (user) {
      // Need to fetch roomId from profiles or localStorage. Assuming it's in localStorage for now as done in Desktop.
      const roomId = localStorage.getItem('attic_room_id');
      if (roomId) {
        setRoomId(roomId);
        try {
          appState = await fetchAppState();
          updateDOM();
          
          const msgs = await fetchChatMessages();
          renderChatMessages(msgs);
          
          initSocket(roomId, user.id, {
            onStateUpdate: (key, val) => {
              appState[key] = val;
              updateDOM();
            },
            onBroadcast: (event, payload) => {
              if (event === 'kiss') {
                hapticVibrate(100);
                // Show kiss animation or toast
              }
            },
            onPresenceChange: (presence) => {
              if (appState.room_profiles) {
                Object.keys(presence).forEach(id => {
                  if (appState.room_profiles[id]) {
                    appState.room_profiles[id].status = presence[id].status;
                  }
                });
                updateDOM();
              }
            },
            onChatMessage: handleNewMessage
          });
        } catch(e) {
          console.error("Failed to load app state", e);
        }
      } else {
        // No room id found, maybe redirect to setup or handle it
      }
    } else {
      // Not logged in, redirect to login
      window.location.replace('/signin');
    }
  });

  // Init route
  const hash = window.location.hash.replace('#', '') || 'home';
  switchView(hash);
  
  // UI Interactions
  document.getElementById('btn-kiss').addEventListener('click', (e) => {
    hapticVibrate(40);
    const btn = e.currentTarget;
    btn.classList.add('disabled');
    setTimeout(() => btn.classList.remove('disabled'), 3000);
    
    document.getElementById('last-kiss-label').textContent = 'Last kiss: Just now';
    if (localStorage.getItem('attic_room_id')) {
      broadcast(localStorage.getItem('attic_room_id'), 'kiss', { sender: currentUser.id });
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    logout().then(() => window.location.replace('/signin'));
  });

  document.getElementById('row-theme').addEventListener('click', () => {
    // Simple theme cycler for MVP
    const themes = ['default', 'matcha', 'midnight', 'rose', 'cyberpunk'];
    let current = localStorage.getItem('app_theme') || 'default';
    let nextIdx = (themes.indexOf(current) + 1) % themes.length;
    let nextTheme = themes[nextIdx];
    
    localStorage.setItem('app_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.getElementById('current-theme-label').textContent = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
    hapticVibrate(10);
  });
  
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');
  
  const sendMessage = () => {
    const text = chatInput.value.trim();
    if (text) {
      sendChatMessage(text, currentUser.id);
      chatInput.value = '';
    }
  };
  
  btnSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Keyboard resize handling
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const inputBar = document.getElementById('chat-input-bar');
      const offset = window.innerHeight - window.visualViewport.height;
      
      // If keyboard is open, offset > 0
      if (offset > 0) {
        inputBar.style.bottom = `${offset}px`;
      } else {
        inputBar.style.bottom = `calc(var(--nav-height) + env(safe-area-inset-bottom))`;
      }
    });
  }
}

boot();

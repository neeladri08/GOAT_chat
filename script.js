// ===== State =====
const state = {
  isTyping: false,
  blurTimer: null,
  queue: [],
  mentions: [],
  summary: {},
  users: [
    { name: 'Alice',   avatar: 'https://i.pravatar.cc/150?img=32', status: 'online',  isTyping: false },
    { name: 'Bob',     avatar: 'https://i.pravatar.cc/150?img=11', status: 'typing',  isTyping: true  },
    { name: 'Charlie', avatar: 'https://i.pravatar.cc/150?img=5',  status: 'online',  isTyping: false },
    { name: 'Diana',   avatar: 'https://i.pravatar.cc/150?img=47', status: 'away',    isTyping: false },
    { name: 'Ethan',   avatar: 'https://i.pravatar.cc/150?img=3',  status: 'online',  isTyping: false },
    { name: 'Fiona',   avatar: 'https://i.pravatar.cc/150?img=25', status: 'typing',  isTyping: true  },
    { name: 'George',  avatar: 'https://i.pravatar.cc/150?img=51', status: 'online',  isTyping: false },
    { name: 'Hannah',  avatar: 'https://i.pravatar.cc/150?img=38', status: 'online',  isTyping: false }
  ]
};

// ===== DOM shortcuts =====
const $ = id => document.getElementById(id);
const el = {
  input:    $('messageInput'),
  sendBtn:  $('sendBtn'),
  feed:     $('chatFeed'),          // only messages+header — blurs
  msgs:     $('messagesContainer'),
  banner:   $('chatBanner'),
  overlay:  $('focusOverlay'),      // inside .chat-feed, covers messages only
  circle:   $('usersAroundCircle'),
  typing:   $('typingIndicators'),
  reveal:   $('delayedReveal'),
  countdown:$('countdownNumber'),
  users:    $('usersList'),
  notif:    $('notificationCount'),
  mentions: $('mentionsSummary'),
  summary:  $('summaryContent')
};

// ===== Helpers =====
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmt = txt => txt.replace(/(@\w+)/g, '<span class="mention">$1</span>');

function buildMsg({ sender, text, avatar, time }) {
  const d = document.createElement('div');
  d.className = 'message';
  d.setAttribute('data-sender', sender);
  d.innerHTML = `
    <div class="message-avatar"><img src="${avatar}" alt="${sender}"></div>
    <div class="message-content">
      <div class="message-header">
        <span class="sender-name">${sender}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-text">${fmt(text)}</div>
    </div>`;
  return d;
}

function scrollBottom() {
  el.msgs.scrollTop = el.msgs.scrollHeight;
}

// ===== Render sidebar =====
function renderUsers() {
  el.users.innerHTML = state.users.map(u => `
    <div class="user-item">
      <div class="user-item-avatar">
        <img src="${u.avatar}" alt="${u.name}">
        <span class="user-item-status ${u.status}"></span>
      </div>
      <div class="user-item-info">
        <div class="user-item-name">${u.name}</div>
        <div class="user-item-status-text">${u.status}</div>
      </div>
    </div>`).join('');
}

// ===== Render focus circle: user avatars orbit the GOATChat logo =====
function renderCircle() {
  const r = 180, cx = 230, cy = 230;
  el.circle.innerHTML = state.users.map((u, i) => {
    const angle = (i / state.users.length) * 2 * Math.PI - Math.PI / 2;
    const x = cx + r * Math.cos(angle) - 26;
    const y = cy + r * Math.sin(angle) - 26;
    return `<div class="user-avatar-circle ${u.isTyping ? 'typing' : ''}" style="left:${x}px;top:${y}px">
      <img src="${u.avatar}" alt="${u.name}">
    </div>`;
  }).join('');
}

function renderTyping() {
  el.typing.innerHTML = state.users
    .filter(u => u.isTyping)
    .map(u => `<div class="typing-indicator active">
      <img src="${u.avatar}" alt="${u.name}" style="width:22px;height:22px;border-radius:50%">
      <span>${u.name} is typing</span>
    </div>`).join('');
}

// ===== Focus Mode =====
function enterFocus() {
  state.isTyping = true;
  el.banner.classList.remove('hidden');
  el.overlay.classList.remove('hidden');  // overlay is inside .chat-feed now
  el.feed.style.position = 'relative';    // ensure overlay is contained
  renderTyping();
}

function exitFocus() {
  state.isTyping = false;
  el.reveal.classList.remove('hidden');
  let count = 5;
  el.countdown.textContent = count;
  const t = setInterval(() => {
    el.countdown.textContent = --count;
    if (count <= 0) { clearInterval(t); releaseMessages(); }
  }, 1000);
}

function releaseMessages() {
  // Hide focus UI
  el.overlay.classList.add('hidden');
  el.reveal.classList.add('hidden');
  el.banner.classList.add('hidden');

  // Burst queued messages
  state.queue.forEach((m, i) => {
    setTimeout(() => {
      const d = buildMsg(m);
      d.classList.add('burst');
      el.msgs.appendChild(d);
      if (i === state.queue.length - 1) scrollBottom();
    }, i * 120);
  });

  // Update summary panel
  el.summary.innerHTML = Object.keys(state.summary).length
    ? Object.entries(state.summary)
        .sort((a, b) => b[1] - a[1])
        .map(([name, cnt]) => {
          const u = state.users.find(u => u.name === name);
          return `<div class="summary-item">
            <div class="summary-user">
              <div class="summary-user-avatar"><img src="${u?.avatar || 'https://i.pravatar.cc/150?img=0'}" alt="${name}"></div>
              <span class="summary-user-name">${name}</span>
            </div>
            <span class="summary-message-count">${cnt} msg${cnt > 1 ? 's' : ''}</span>
          </div>`;
        }).join('')
    : '<p style="color:var(--tm);font-size:13px">No messages while you were focused</p>';

  // Update mentions panel
  const mc = {};
  state.mentions.forEach(m => mc[m.user] = (mc[m.user] || 0) + 1);
  el.mentions.innerHTML = Object.keys(mc).length
    ? Object.entries(mc).map(([u, c]) => `
        <div class="mention-item">
          <div class="mention-header">
            <span class="mention-user">${u}</span>
            <span class="mention-count">mentioned you ${c} time${c > 1 ? 's' : ''}</span>
          </div>
          <div class="mention-preview">Check your messages for the latest mentions!</div>
          <div class="mention-time">${now()}</div>
        </div>`).join('')
    : '<p style="color:var(--tm);font-size:13px">No mentions</p>';

  // Update notification badge
  const total = state.queue.length + state.mentions.length;
  el.notif.textContent = total;

  // Clear queue
  state.queue = [];
}

// ===== Send message =====
function sendMessage() {
  const text = el.input.value.trim();
  if (!text) return;

  // Track mentions
  const found = text.match(/@(\w+)/g) || [];
  if (found.length) {
    state.mentions.push({ user: 'You', message: text, timestamp: now() });
  }

  // Add message to chat
  el.msgs.appendChild(buildMsg({
    sender: 'You',
    text,
    avatar: 'https://i.pravatar.cc/150?img=68',
    time: now()
  }));
  scrollBottom();
  el.input.value = '';
}

// ===== Input events =====
el.input.addEventListener('input', () => {
  if (el.input.value.trim() && !state.isTyping) enterFocus();
  // reset blur timer on each keystroke
  clearTimeout(state.blurTimer);
});

el.input.addEventListener('blur', () => {
  if (state.isTyping) {
    state.blurTimer = setTimeout(() => {
      if (state.isTyping) exitFocus();
    }, 2000);
  }
});

el.input.addEventListener('focus', () => {
  clearTimeout(state.blurTimer);
});

el.sendBtn.addEventListener('click', sendMessage);
el.input.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());

// Nav active state
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

// ===== Simulate incoming messages while user types =====
const MSGS = [
  'Hey everyone! 🚀',
  "What's the progress on the project?",
  '@You can you check this out?',
  'The design looks amazing! 💙',
  'Great work team!',
  'Just finished the backend setup',
  'Love the blue and yellow theme!',
  "When's the demo?"
];

setInterval(() => {
  if (!state.isTyping) return;
  const u = state.users[Math.floor(Math.random() * state.users.length)];
  const text = MSGS[Math.floor(Math.random() * MSGS.length)];
  state.queue.push({ sender: u.name, text, avatar: u.avatar, time: now() });
  state.summary[u.name] = (state.summary[u.name] || 0) + 1;
}, 3000);

// ===== Init =====
renderUsers();
renderCircle();
renderTyping();

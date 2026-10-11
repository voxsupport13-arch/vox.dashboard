// ==== VOX Dashboard - Dashboard JS ====

let allGuilds = [];
let allChannels = [];
let allCategories = [];
let allRoles = [];
let selectedGuildId = null;
let categoriesCount = 0;
let categoriesData = [];

// ==== Application vars ====
let appGuildId = null;
let appQuestions = [];
let appChannels = [];
let appRoles = [];
let appBotType = 'free';

// ==== Switch Bot Type ====
function switchBotType() {
    const botType = document.getElementById('botTypeSwitcher').value;
    if (botType === 'premium') {
        window.location.href = '/dashboard/premium';
    } else {
        window.location.href = '/dashboard/free';
    }
}

function switchTab(event, tabId) {
    event.preventDefault();

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));

    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');

    event.currentTarget.classList.add('active');

    loadTabData(tabId);
}

async function loadTabData(tabId) {
    switch (tabId) {
        case 'overview': await loadDashboardStats(); break;
        case 'servers': await loadServers(); break;
        case 'tickets': await loadTickets(); break;
    }
}

// ==== Stats ====
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;

        const d = data.data;
        setText('userServers', d.userServers || 0);
        setText('botServers', d.adminServers || 0);
        setText('openTickets', d.openTickets || 0);
        setText('closedTickets', d.closedTickets || 0);
    } catch (err) {
        console.error('Stats error:', err);
    }
}

// ==== Servers (مع أزرار التسطيب) ====
async function loadServers() {
    try {
        const res = await fetch('/api/dashboard/servers', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('serversList');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد سيرفرات (لازم تكون أدمن)</p>';
            return;
        }

        allGuilds = data.data;

        container.innerHTML = data.data.map(s => `
            <div class="server-item" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                ${s.icon ? `<img src="${s.icon}" alt="${s.name}" style="width:56px;height:56px;border-radius:50%;border:2px solid var(--gold);">` : ''}
                <div style="flex:1;min-width:150px;">
                    <h4 style="margin:0;">${escapeHtml(s.name)}</h4>
                    <div class="item-meta" style="margin-top:0.3rem;">
                        ${s.owner ? '<span>👑 أنت المالك</span>' : '<span>🛡️ أنت أدمن</span>'}
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn-small success" onclick="openSetup('${s.id}', 'ticket')">
                        🎫 تسطيب التكت
                    </button>
                    <button class="btn-small success" onclick="openSetup('${s.id}', 'application')">
                        📝 تسطيب التقديم
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Servers error:', err);
    }
}

// ==== فتح تسطيب لسيرفر معين ====
function openSetup(guildId, type) {
    const guild = allGuilds.find(g => g.id === guildId);
    if (!guild) return;

    // خزّن السيرفر المختار
    sessionStorage.setItem('setupGuildId', guildId);
    sessionStorage.setItem('setupGuildName', guild.name);
    sessionStorage.setItem('setupType', type);

    // روح لصفحة التسطيب
    window.location.href = `/setup/${type}`;
}

// ==== Tickets ====
async function loadTickets() {
    try {
        const res = await fetch('/api/dashboard/tickets', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('ticketsList');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد تذاكر نشطة</p>';
            return;
        }

        container.innerHTML = data.data.map(t => `
            <div class="ticket-item">
                <h4>🎫 ${escapeHtml(t.channelName || t.channelId)}</h4>
                <div class="item-meta">
                    <span>👤 <@${t.ownerId}></span>
                    ${t.claimedBy ? `<span>👨‍💻 <@${t.claimedBy}></span>` : '<span>⏳ لم يتم الاستلام</span>'}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Tickets error:', err);
    }
}

// ==== Helpers ====
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#57F287' : '#ED4245'};
        color: #000;
        padding: 1rem 2rem;
        border-radius: 10px;
        font-weight: 700;
        z-index: 9999;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
});

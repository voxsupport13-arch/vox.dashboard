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

        // ==== اجلب حالة البريميم لكل سيرفر ====
        let premiumGuilds = [];
        try {
            const premRes = await fetch('/api/dashboard/premium-guilds', { credentials: 'include' });
            const premData = await premRes.json();
            if (premData.success) {
                premiumGuilds = premData.data || [];
            }
        } catch (err) {
            console.error('Premium guilds error:', err);
        }

        container.innerHTML = data.data.map(s => {
            const isPremium = premiumGuilds.includes(s.id);

            return `
            <div class="server-item" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                ${s.icon ? `<img src="${s.icon}" alt="${s.name}" style="width:56px;height:56px;border-radius:50%;border:2px solid var(--gold);">` : ''}
                <div style="flex:1;min-width:150px;">
                    <h4 style="margin:0;display:flex;align-items:center;gap:0.5rem;">
                        ${escapeHtml(s.name)}
                        ${isPremium ? '<span class="bot-badge premium" style="font-size:0.75rem;">💎 بريميم</span>' : ''}
                    </h4>
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
            `;
        }).join('');
    } catch (err) {
        console.error('Servers error:', err);
    }
}

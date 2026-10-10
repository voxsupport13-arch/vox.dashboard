// ==== VOX Dashboard - Owner JS ====

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
        case 'ownerOverview':
            await loadOwnerStats();
            break;
        case 'ownerReports':
            await loadReports();
            break;
        case 'ownerPurchases':
            await loadPurchases();
            break;
        case 'ownerCoupons':
            await loadCoupons();
            break;
        case 'ownerNews':
            await loadNews();
            break;
        case 'ownerKeys':
            await loadKeys();
            break;
    }
}

async function loadOwnerStats() {
    try {
        const res = await fetch('/api/owner/stats', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;

        const d = data.data;
        setText('totalServers', d.totalServers);
        setText('freeServers', d.freeServers);
        setText('premiumServers', d.premiumServers);
        setText('totalMembers', d.totalMembers);
        setText('allOpenTickets', d.openTickets);
        setText('allClosedTickets', d.closedTickets);
        setText('totalPurchases', d.totalPurchases);
        setText('pendingReports', d.pendingReports);
        setText('totalUsers', d.totalUsers || 0);
        setText('onlineUsers', d.onlineUsers || 0);
    } catch (err) {
        console.error('Stats error:', err);
    }
}

async function loadReports() {
    try {
        const res = await fetch('/api/owner/reports', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('reportsList');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد إبلاغات</p>';
            return;
        }

        container.innerHTML = data.data.map(r => `
            <div class="report-item">
                <h4>${escapeHtml(r.title)}</h4>
                <p>${escapeHtml(r.description)}</p>
                ${r.imageUrl ? `<a href="${r.imageUrl}" target="_blank" style="color:var(--gold);">📷 عرض الصورة</a>` : ''}
                <div class="item-meta">
                    <span>👤 ${escapeHtml(r.username)}</span>
                    <span>📅 ${new Date(r.createdAt).toLocaleString()}</span>
                    <span class="status-badge ${r.status}">${statusText(r.status)}</span>
                </div>
                ${r.status === 'pending' ? `
                    <div class="item-actions">
                        <button class="btn-small success" onclick="resolveReport('${r._id}', 'resolved')">✅ تم الحل</button>
                        <button class="btn-small danger" onclick="resolveReport('${r._id}', 'rejected')">❌ لم يتم الحل</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (err) {
        console.error('Reports error:', err);
    }
}

async function resolveReport(id, status) {
    const reason = status === 'rejected' ? prompt('سبب الرفض:') : null;

    try {
        const res = await fetch(`/api/owner/reports/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status, reason })
        });

        const data = await res.json();
        if (data.success) {
            showToast('✅ تم تحديث الإبلاغ', 'success');
            await loadReports();
        }
    } catch (err) {
        showToast('❌ فشل التحديث', 'danger');
    }
}

async function loadPurchases() {
    try {
        const res = await fetch('/api/owner/purchases', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('purchasesList');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد طلبات شراء</p>';
            return;
        }

        container.innerHTML = data.data.map(p => `
            <div class="purchase-item">
                <h4>${p.plan === 'monthly' ? '📅 شهري' : '📅 سنوي'} - ${p.paymentMethod === 'credit' ? 'Credit' : 'ADM Cash'}</h4>
                <div class="item-meta">
                    <span>👤 ${escapeHtml(p.username)}</span>
                    <span>🌐 ${escapeHtml(p.guildName || p.guildId)}</

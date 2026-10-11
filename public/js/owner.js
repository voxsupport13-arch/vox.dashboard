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
        case 'ownerOverview': await loadOwnerStats(); break;
        case 'ownerSiteStats': await loadSiteStats(); break;
        case 'ownerReports': await loadReports(); break;
        case 'ownerPurchases': await loadPurchases(); break;
        case 'ownerCoupons': await loadCoupons(); break;
        case 'ownerNews': await loadNews(); break;
        case 'ownerKeys': await loadKeys(); break;
    }
}

// ==== Bot Stats ====
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
    } catch (err) {
        console.error('Stats error:', err);
    }
}

// ==== Site Stats ====
async function loadSiteStats() {
    try {
        const res = await fetch('/api/owner/site-stats', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;

        const d = data.data;
        setText('totalUsers', d.totalUsers || 0);
        setText('onlineUsers', d.onlineUsers || 0);
        setText('todayUsers', d.todayUsers || 0);
        setText('weekUsers', d.weekUsers || 0);

        // عرض آخر المستخدمين
        const container = document.getElementById('recentUsers');
        if (!container) return;

        if (!d.recentUsers || d.recentUsers.length === 0) {
            container.innerHTML = '<p class="empty-state">لا يوجد مستخدمين</p>';
            return;
        }

        container.innerHTML = d.recentUsers.map(u => `
            <div class="user-item" style="display:flex;align-items:center;gap:1rem;padding:1rem;border-bottom:1px solid var(--border);">
                <img src="https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--gold);" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <div style="flex:1;">
                    <strong style="color:var(--gold);">${escapeHtml(u.username)}</strong>
                    <div class="item-meta" style="margin-top:0.3rem;">
                        <span>📅 آخر دخول: ${new Date(u.lastSeen).toLocaleString()}</span>
                        ${u.firstSeen ? `<span>🆕 أول دخول: ${new Date(u.firstSeen).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Site stats error:', err);
    }
}

// ==== Reports ====
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
                <h4>${typeIcon(r.type)} ${escapeHtml(r.title)}</h4>
                <p>${escapeHtml(r.description)}</p>
                ${r.imageUrl ? `<a href="${r.imageUrl}" target="_blank" style="color:var(--gold);">📷 عرض الصورة</a>` : ''}
                <div class="item-meta">
                    <span>👤 ${escapeHtml(r.username)}</span>
                    <span>📂 ${typeText(r.type)}</span>
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

// ==== Purchases ====
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
                    <span>🌐 ${escapeHtml(p.guildName || p.guildId)}</span>
                    <span>💳 تحويل: ${escapeHtml(p.transferUser)}</span>
                    <span>💰 ${p.finalPrice}</span>
                    <span class="status-badge ${p.status}">${purchaseStatusText(p.status)}</span>
                </div>
                ${p.proofImage ? `<a href="${p.proofImage}" target="_blank" style="color:var(--gold);">📷 عرض الإثبات</a>` : ''}
                ${p.status === 'pending' ? `
                    <div class="item-actions">
                        <button class="btn-small success" onclick="approvePurchase('${p._id}')">✅ موافقة</button>
                        <button class="btn-small danger" onclick="rejectPurchase('${p._id}')">❌ رفض</button>
                    </div>
                ` : ''}
                ${p.keySent ? `<p style="margin-top:0.5rem;"><strong>🔑 المفتاح:</strong> <code style="color:var(--gold);">${p.keySent}</code></p>` : ''}
            </div>
        `).join('');
    } catch (err) {
        console.error('Purchases error:', err);
    }
}

async function approvePurchase(id) {
    if (!confirm('هل أنت متأكد من الموافقة؟ سيتم إرسال المفتاح للعميل.')) return;

    try {
        const res = await fetch(`/api/owner/purchases/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        const data = await res.json();
        if (data.success) {
            showToast(`✅ تم الموافقة وإرسال المفتاح: ${data.key}`, 'success');
            await loadPurchases();
        } else {
            showToast(`❌ ${data.error}`, 'danger');
        }
    } catch (err) {
        showToast('❌ فشل', 'danger');
    }
}

async function rejectPurchase(id) {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;

    try {
        const res = await fetch(`/api/owner/purchases/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reason })
        });

        const data = await res.json();
        if (data.success) {
            showToast('✅ تم الرفض', 'success');
            await loadPurchases();
        }
    } catch (err) {
        showToast('❌ فشل', 'danger');
    }
}

// ==== Coupons ====
async function loadCoupons() {
    try {
        const res = await fetch('/api/owner/coupons', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('couponsList');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد أكواد</p>';
            return;
        }

        container.innerHTML = data.data.map(c => `
            <div class="coupon-item">
                <h4>🎟️ ${c.code}</h4>
                <div class="item-meta">
                    <span>💰 خصم ${c.discount}%</span>
                    <span>📊 ${c.usedCount}/${c.maxUses} استخدام</span>
                    <span>📅 ${new Date(c.startDate).toLocaleDateString()} - ${new Date(c.endDate).toLocaleDateString()}</span>
                    <span class="status-badge ${c.active ? 'active' : 'expired'}">${c.active ? 'نشط' : 'معطل'}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-small danger" onclick="deleteCoupon('${c._id}')">🗑️ حذف</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Coupons error:', err);
    }
}

async function deleteCoupon(id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;

    try {
        const res = await fetch(`/api/owner/coupons/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast('✅ تم الحذف', 'success');
            await loadCoupons();
        }
    } catch (err) {
        showToast('❌ فشل', 'danger');
    }
}

// ==== News ====
async function loadNews() {
    try {
        const res = await fetch('/api/owner/news', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('newsList');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد أخبار</p>';
            return;
        }

        container.innerHTML = data.data.map(n => `
            <div class="news-item">
                <p>${escapeHtml(n.content)}</p>
                <div class="item-meta">
                    <span>⏰ ${new Date(n.startDate).toLocaleString()} → ${new Date(n.endDate).toLocaleString()}</span>
                    <span class="status-badge ${n.active ? 'active' : 'expired'}">${n.active ? 'نشط' : 'منتهي'}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-small success" onclick="openEditNews('${n._id}', '${escapeHtml(n.content).replace(/'/g, "\\'")}', ${n.duration})">✏️ تعديل</button>
                    <button class="btn-small danger" onclick="deleteNews('${n._id}')">🗑️ حذف</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('News error:', err);
    }
}

async function deleteNews(id) {
    if (!confirm('هل أنت متأكد؟')) return;

    try {
        const res = await fetch(`/api/owner/news/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast('✅ تم الحذف', 'success');
            await loadNews();
        }
    } catch (err) {
        showToast('❌ فشل', 'danger');
    }
}

// ==== Edit News ====
function openEditNews(id, content, duration) {
    document.getElementById('editNewsId').value = id;
    document.getElementById('editNewsContent').value = content;
    document.getElementById('editNewsDuration').value = duration;
    document.getElementById('editNewsModal').style.display = 'flex';
}

function closeEditNews() {
    document.getElementById('editNewsModal').style.display = 'none';
}

// ==== Keys ====
async function loadKeys() {
    try {
        const res = await fetch('/api/owner/keys', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;

        const monthly = data.data.monthly || [];
        const yearly = data.data.yearly || [];

        setText('monthlyAvailable', monthly.filter(k => !k.used).length);
        setText('monthlyUsed', monthly.filter(k => k.used).length);
        setText('yearlyAvailable', yearly.filter(k => !k.used).length);
        setText('yearlyUsed', yearly.filter(k => k.used).length);
    } catch (err) {
        console.error('Keys error:', err);
    }
}

// ==== Forms ====
document.addEventListener('DOMContentLoaded', () => {
    const couponForm = document.getElementById('createCouponForm');
    if (couponForm) {
        couponForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(couponForm);
            const body = Object.fromEntries(formData);

            try {
                const res = await fetch('/api/owner/coupons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });

                const data = await res.json();
                if (data.success) {
                    showToast('✅ تم إنشاء الكود', 'success');
                    couponForm.reset();
                    await loadCoupons();
                } else {
                    showToast(`❌ ${data.error}`, 'danger');
                }
            } catch (err) {
                showToast('❌ فشل', 'danger');
            }
        });
    }

    const newsForm = document.getElementById('createNewsForm');
    if (newsForm) {
        newsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(newsForm);
            const body = Object.fromEntries(formData);

            try {
                const res = await fetch('/api/owner/news', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });

                const data = await res.json();
                if (data.success) {
                    showToast('✅ تم نشر الخبر', 'success');
                    newsForm.reset();
                    await loadNews();
                } else {
                    showToast(`❌ ${data.error}`, 'danger');
                }
            } catch (err) {
                showToast('❌ فشل', 'danger');
            }
        });
    }

    const editNewsForm = document.getElementById('editNewsForm');
    if (editNewsForm) {
        editNewsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('editNewsId').value;
            const content = document.getElementById('editNewsContent').value;
            const duration = document.getElementById('editNewsDuration').value;

            try {
                const res = await fetch(`/api/owner/news/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ content, duration })
                });

                const data = await res.json();
                if (data.success) {
                    showToast('✅ تم تعديل الخبر', 'success');
                    closeEditNews();
                    await loadNews();
                } else {
                    showToast(`❌ ${data.error}`, 'danger');
                }
            } catch (err) {
                showToast('❌ فشل', 'danger');
            }
        });
    }

    loadOwnerStats();
});

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

function statusText(status) {
    const map = { pending: '⏳ معلق', resolved: '✅ تم الحل', rejected: '❌ مرفوض' };
    return map[status] || status;
}

function purchaseStatusText(status) {
    const map = { pending: '⏳ معلق', approved: '✅ موافق', rejected: '❌ مرفوض' };
    return map[status] || status;
}

function typeIcon(type) {
    const map = { website: '🌐', ticket: '🎫', application: '📝', payment: '💰', other: '📌', bug: '🌐' };
    return map[type] || '📌';
}

function typeText(type) {
    const map = {
        website: 'مشكلة في الموقع',
        bug: 'مشكلة في الموقع',
        ticket: 'مشكلة في التذاكر',
        application: 'مشكلة في التقديم',
        payment: 'مشكلة في الدفع',
        other: 'أخرى'
    };
    return map[type] || type;
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

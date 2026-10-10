// ==== VOX Dashboard - Reports JS ====

document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('reportForm');

    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(reportForm);
            const body = {
                type: formData.get('type'),
                title: formData.get('title'),
                description: formData.get('description'),
                imageUrl: formData.get('imageUrl') || null
            };

            const submitBtn = reportForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ جاري الإرسال...';

            try {
                const res = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });

                const data = await res.json();

                if (data.success) {
                    showToast('✅ تم إرسال الإبلاغ بنجاح!', 'success');
                    reportForm.reset();
                    await loadMyReports();
                } else {
                    showToast(`❌ ${data.error}`, 'danger');
                }
            } catch (err) {
                showToast('❌ فشل الاتصال', 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    loadMyReports();
});

async function loadMyReports() {
    try {
        const res = await fetch('/api/reports/my', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('myReports');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد إبلاغات سابقة</p>';
            return;
        }

        container.innerHTML = data.data.map(r => `
            <div class="report-item">
                <h4>${typeIcon(r.type)} ${escapeHtml(r.title)}</h4>
                <p style="color:var(--text-muted);margin:0.5rem 0;">${escapeHtml(r.description)}</p>
                ${r.imageUrl ? `<a href="${r.imageUrl}" target="_blank" style="color:var(--gold);">📷 عرض الصورة</a>` : ''}
                <div class="item-meta">
                    <span>📅 ${new Date(r.createdAt).toLocaleString()}</span>
                    <span class="status-badge ${r.status}">${statusText(r.status)}</span>
                </div>
                ${r.rejectReason ? `<p style="color:var(--danger);margin-top:0.5rem;">❌ السبب: ${escapeHtml(r.rejectReason)}</p>` : ''}
            </div>
        `).join('');
    } catch (err) {
        console.error('Reports error:', err);
    }
}

function typeIcon(type) {
    const map = { bug: '🐛', ticket: '🎫', application: '📝', payment: '💰', other: '📌' };
    return map[type] || '📌';
}

function statusText(status) {
    const map = { pending: '⏳ معلق', resolved: '✅ تم الحل', rejected: '❌ مرفوض' };
    return map[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
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
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
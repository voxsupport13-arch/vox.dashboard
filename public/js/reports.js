// ==== VOX Dashboard - Reports JS (4 Languages) ====

const SUPPORTED_LANGS = ['en', 'ar', 'es', 'fr'];
const DEFAULT_LANG = 'en';

// ==== Get Current Language ====
function getCurrentLang() {
    const lang = localStorage.getItem('vox-lang') || DEFAULT_LANG;
    return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

// ==== Translations ====
const REPORTS_I18N = {
    en: {
        sending: '⏳ Sending...',
        success: '✅ Report sent successfully!',
        failed: '❌ Connection failed',
        noReports: 'No previous reports',
        viewImage: '📷 View image',
        reason: '❌ Reason'
    },
    ar: {
        sending: '⏳ جاري الإرسال...',
        success: '✅ تم إرسال الإبلاغ بنجاح!',
        failed: '❌ فشل الاتصال',
        noReports: 'لا توجد إبلاغات سابقة',
        viewImage: '📷 عرض الصورة',
        reason: '❌ السبب'
    },
    es: {
        sending: '⏳ Enviando...',
        success: '✅ ¡Reporte enviado con éxito!',
        failed: '❌ Error de conexión',
        noReports: 'No hay reportes anteriores',
        viewImage: '📷 Ver imagen',
        reason: '❌ Razón'
    },
    fr: {
        sending: '⏳ Envoi en cours...',
        success: '✅ Signalement envoyé avec succès !',
        failed: '❌ Échec de la connexion',
        noReports: 'Aucun signalement précédent',
        viewImage: '📷 Voir l\'image',
        reason: '❌ Raison'
    }
};

function t(key) {
    const lang = getCurrentLang();
    return REPORTS_I18N[lang]?.[key] || REPORTS_I18N.en[key] || key;
}

// ==== Type Icons ====
const TYPE_INFO = {
    bug: { icon: '🐛' },
    ticket: { icon: '🎫' },
    application: { icon: '📝' },
    payment: { icon: '💰' },
    website: { icon: '🌐' },
    other: { icon: '📌' }
};

function typeIcon(type) {
    return TYPE_INFO[type]?.icon || '📌';
}

// ==== Status Text ====
const STATUS_INFO = {
    pending: { en: '⏳ Pending', ar: '⏳ معلق', es: '⏳ Pendiente', fr: '⏳ En attente' },
    resolved: { en: '✅ Resolved', ar: '✅ تم الحل', es: '✅ Resuelto', fr: '✅ Résolu' },
    rejected: { en: '❌ Rejected', ar: '❌ مرفوض', es: '❌ Rechazado', fr: '❌ Rejeté' }
};

function statusText(status) {
    const lang = getCurrentLang();
    return STATUS_INFO[status]?.[lang] || STATUS_INFO[status]?.en || status;
}

// ==== Escape HTML ====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ==== Translate <option> for Report Type ====
// ============================================
function translateReportOptions() {
    const lang = getCurrentLang();
    const select = document.getElementById('reportType');
    if (!select) return;

    select.querySelectorAll('option').forEach(opt => {
        const text = opt.dataset[lang] || opt.dataset.en;
        if (text) opt.textContent = text;
    });
}

// ============================================
// ==== Submit Report ====
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Translate options on load
    translateReportOptions();

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
            submitBtn.innerHTML = t('sending');

            try {
                const res = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });

                const data = await res.json();

                if (data.success) {
                    showToast(t('success'), 'success');
                    reportForm.reset();
                    translateReportOptions();
                    await loadMyReports();
                } else {
                    showToast(`❌ ${data.error}`, 'danger');
                }
            } catch (err) {
                showToast(t('failed'), 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    loadMyReports();
});

// ==== Re-translate options when language changes ====
document.addEventListener('click', (e) => {
    if (e.target.closest('.lang-option')) {
        setTimeout(translateReportOptions, 100);
    }
});

// ============================================
// ==== Load My Reports ====
// ============================================
async function loadMyReports() {
    try {
        const res = await fetch('/api/reports/my', { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('myReports');
        if (!container) return;

        if (!data.success || data.data.length === 0) {
            container.innerHTML = `<p class="empty-state">${t('noReports')}</p>`;
            return;
        }

        container.innerHTML = data.data.map(r => `
            <div class="report-item">
                <h4>${typeIcon(r.type)} ${escapeHtml(r.title)}</h4>
                <p style="color:var(--text-muted);margin:0.5rem 0;">${escapeHtml(r.description)}</p>
                ${r.imageUrl ? `<a href="${r.imageUrl}" target="_blank" style="color:var(--gold);">${t('viewImage')}</a>` : ''}
                <div class="item-meta">
                    <span>📅 ${new Date(r.createdAt).toLocaleString()}</span>
                    <span class="status-badge ${r.status}">${statusText(r.status)}</span>
                </div>
                ${r.rejectReason ? `<p style="color:var(--danger);margin-top:0.5rem;">${t('reason')}: ${escapeHtml(r.rejectReason)}</p>` : ''}
            </div>
        `).join('');
    } catch (err) {
        console.error('Reports error:', err);
    }
}

// ==== Toast ====
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

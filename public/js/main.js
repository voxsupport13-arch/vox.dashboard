// ==== VOX Dashboard - Main JS ====

// ==== Supported Languages ====
const SUPPORTED_LANGS = ['en', 'ar', 'es', 'fr'];
const DEFAULT_LANG = 'en';

const LANG_FLAGS = {
    en: 'https://flagcdn.com/w40/us.png',
    ar: 'https://flagcdn.com/w40/sa.png',
    es: 'https://flagcdn.com/w40/es.png',
    fr: 'https://flagcdn.com/w40/fr.png'
};

// ==== Get Current Language ====
function getCurrentLang() {
    const saved = localStorage.getItem('vox-lang');
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    return DEFAULT_LANG;
}

// ==== IMMEDIATE Apply (before DOM ready) ====
(function applyLangImmediately() {
    const lang = getCurrentLang();
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
})();

// ==== Theme Toggle ====
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('vox-theme', newTheme);
}

(function loadTheme() {
    const saved = localStorage.getItem('vox-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
})();

// ==== Language System ====
function applyLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;

    const rtlLangs = ['ar'];
    const dir = rtlLangs.includes(lang) ? 'rtl' : 'ltr';

    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);

    // إخفاء كل النصوص
    document.querySelectorAll('.en-text, .ar-text, .es-text, .fr-text')
        .forEach(el => el.style.display = 'none');

    // إظهار نصوص اللغة الحالية
    document.querySelectorAll(`.${lang}-text`)
        .forEach(el => el.style.display = 'inline');

    // تحديث العلم الحالي
    const flagEl = document.getElementById('currentLangFlag');
    if (flagEl) flagEl.src = LANG_FLAGS[lang] || LANG_FLAGS.en;

    // تحديث الـ dropdown
    document.querySelectorAll('.lang-option').forEach(el => {
        el.classList.toggle('active', el.dataset.lang === lang);
    });
}

function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
    localStorage.setItem('vox-lang', lang);
    applyLang(lang);
}

function toggleLangMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('langDropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

function chooseLang(lang) {
    setLang(lang);
    const dropdown = document.getElementById('langDropdown');
    if (dropdown) dropdown.classList.remove('active');
}

// ==== User Menu ====
function toggleUserMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// ==== Close dropdowns on outside click ====
document.addEventListener('click', (event) => {
    const userDropdown = document.getElementById('userDropdown');
    const userMenu = document.querySelector('.user-menu');
    if (userDropdown && userMenu && !userMenu.contains(event.target)) {
        userDropdown.classList.remove('active');
    }

    const langDropdown = document.getElementById('langDropdown');
    const langSwitch = document.querySelector('.lang-switch');
    if (langDropdown && langSwitch && !langSwitch.contains(event.target)) {
        langDropdown.classList.remove('active');
    }
});

// ==== Copy to Clipboard ====
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(getToastMessage('copied'), 'success');
    }).catch(() => {
        showToast(getToastMessage('copyFailed'), 'danger');
    });
}

// ==== Toast Messages ====
function getToastMessage(key) {
    const lang = getCurrentLang();
    const messages = {
        copied: {
            en: '✅ Copied!',
            ar: '✅ تم النسخ',
            es: '✅ ¡Copiado!',
            fr: '✅ Copié !'
        },
        copyFailed: {
            en: '❌ Copy failed',
            ar: '❌ فشل النسخ',
            es: '❌ Error al copiar',
            fr: '❌ Échec de la copie'
        }
    };
    return messages[key]?.[lang] || messages[key]?.en || key;
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

// ==== Confirm Dialog ====
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// ==== Apply Language on DOM Ready ====
function initLang() {
    const lang = getCurrentLang();
    applyLang(lang);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLang);
} else {
    initLang();
}

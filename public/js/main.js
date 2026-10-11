// ==== VOX Dashboard - Main JS ====

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

// ==== Language Toggle (Flags) ====
function toggleLang() {
    const current = localStorage.getItem('vox-lang') || 'ar';
    const newLang = current === 'ar' ? 'en' : 'ar';

    localStorage.setItem('vox-lang', newLang);
    applyLang(newLang);
}

function applyLang(lang) {
    const arTexts = document.querySelectorAll('.ar-text');
    const enTexts = document.querySelectorAll('.en-text');
    const langText = document.getElementById('langText');

    if (lang === 'en') {
        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.setAttribute('dir', 'ltr');
        arTexts.forEach(el => el.style.display = 'none');
        enTexts.forEach(el => el.style.display = 'inline');
        if (langText) langText.textContent = '🇸🇦';
    } else {
        document.documentElement.setAttribute('lang', 'ar');
        document.documentElement.setAttribute('dir', 'rtl');
        arTexts.forEach(el => el.style.display = 'inline');
        enTexts.forEach(el => el.style.display = 'none');
        if (langText) langText.textContent = '🇺🇸';
    }
}

(function loadLang() {
    const saved = localStorage.getItem('vox-lang') || 'ar';
    applyLang(saved);
})();

// ==== User Menu (Click) ====
function toggleUserMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('userDropdown');
    const userMenu = document.querySelector('.user-menu');

    if (dropdown && userMenu) {
        if (!userMenu.contains(event.target)) {
            dropdown.classList.remove('active');
        }
    }
});

// ==== Copy to Clipboard ====
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ تم النسخ', 'success');
    }).catch(() => {
        showToast('❌ فشل النسخ', 'danger');
    });
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

// ==== Loaded ====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 VOX Dashboard Loaded');
});

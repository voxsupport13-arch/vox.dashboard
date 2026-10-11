// ==== VOX Dashboard - Setup JS ====

let allGuilds = [];
let allChannels = [];
let allCategories = [];
let allRoles = [];
let selectedGuildId = null;
let categoriesCount = 0;
let categoriesData = [];
let currentBotType = 'free';

// ==== Application vars ====
let appGuildId = null;
let appQuestions = [];
let appChannels = [];
let appRoles = [];
let appBotType = 'free';

// ============================================
// ==== HELPERS ====
// ============================================

function fillChannelSelect(id, channels, placeholder) {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = `<option value="">-- ${placeholder} --</option>`;
    channels.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `#${c.name}`;
        select.appendChild(opt);
    });
}

function filterChannels(selectId, query) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.querySelectorAll('option').forEach(opt => {
        if (opt.value === '') return;
        opt.style.display = opt.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
    });
}

function filterSelect(selectSelector, query) {
    const select = document.querySelector(selectSelector);
    if (!select) return;
    select.querySelectorAll('option').forEach(opt => {
        if (opt.value === '') return;
        opt.style.display = opt.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
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

// ============================================
// ==== TICKET SETUP ====
// ============================================

async function loadGuildsForTicket() {
    try {
        const res = await fetch('/api/dashboard/servers', { credentials: 'include' });
        const data = await res.json();

        const select = document.getElementById('setupGuildSelect');
        if (!select) return;

        if (!data.success || data.data.length === 0) {
            select.innerHTML = '<option value="">لا توجد سيرفرات (لازم تكون أدمن)</option>';
            return;
        }

        allGuilds = data.data;
        select.innerHTML = '<option value="">-- اختر السيرفر --</option>';

        data.data.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.name;
            option.dataset.name = g.name;
            select.appendChild(option);
        });

        // ==== لو فيه سيرفر محفوظ في sessionStorage ====
        const savedGuildId = sessionStorage.getItem('setupGuildId');
        if (savedGuildId) {
            const savedGuild = data.data.find(g => g.id === savedGuildId);
            if (savedGuild) {
                select.value = savedGuildId;
                // شيلها من sessionStorage بعد الاستخدام
                sessionStorage.removeItem('setupGuildId');
                sessionStorage.removeItem('setupGuildName');
                sessionStorage.removeItem('setupType');
                // حمّل البيانات تلقائيًا
                await loadGuildData();
            }
        }
    } catch (err) {
        console.error('Load guilds error:', err);
    }
}

async function loadGuildData() {
    const select = document.getElementById('setupGuildSelect');
    selectedGuildId = select.value;

    if (!selectedGuildId) {
        document.getElementById('setupPanelStep1').style.display = 'none';
        document.getElementById('setupBotTypeGroup').style.display = 'none';
        return;
    }

    const selectedOption = select.options[select.selectedIndex];
    document.getElementById('setupGuildName').value = selectedOption.dataset.name;

    try {
        const checkRes = await fetch(`/api/dashboard/guild/${selectedGuildId}/check-bots`, { credentials: 'include' });
        const checkData = await checkRes.json();

        const botTypeSelect = document.getElementById('setupBotType');
        const botTypeGroup = document.getElementById('setupBotTypeGroup');

        if (checkData.success) {
            const d = checkData.data;
            botTypeSelect.innerHTML = '';

            if (d.free) {
                const opt = document.createElement('option');
                opt.value = 'free';
                opt.textContent = '🆓 البوت المجاني';
                botTypeSelect.appendChild(opt);
            }

            if (d.premium) {
                const opt = document.createElement('option');
                opt.value = 'premium';
                opt.textContent = d.premiumActive ? '💎 البوت البريميم (فعّال)' : '💎 البوت البريميم';
                botTypeSelect.appendChild(opt);
            }

            if (botTypeSelect.options.length === 0) {
                botTypeSelect.innerHTML = '<option value="free">🆓 البوت المجاني</option>';
            }

            if (d.free && d.premium) botTypeSelect.value = 'free';

            botTypeGroup.style.display = 'block';
        }
    } catch (err) {
        console.error('Check bots error:', err);
    }

    const botType = document.getElementById('setupBotType').value || 'free';

    try {
        const res = await fetch(`/api/dashboard/guild/${selectedGuildId}/data?botType=${botType}`, { credentials: 'include' });
        const data = await res.json();

        if (!data.success) {
            showToast('❌ فشل جلب البيانات: ' + (data.error || ''), 'danger');
            return;
        }

        allChannels = data.data.textChannels || [];
        allCategories = data.data.categories || [];
        allRoles = data.data.roles || [];

        fillChannelSelect('setupTargetChannel', allChannels, 'اختر روم البانل');
        fillChannelSelect('setupLogChannel', allChannels, 'اختر روم اللوق');
        fillChannelSelect('setupRatingChannel', allChannels, 'اختر روم التقييمات');

        document.getElementById('setupPanelStep1').style.display = 'block';
        document.getElementById('setupPanelStep2').style.display = 'none';
        document.getElementById('setupPanelStep3').style.display = 'none';
    } catch (err) {
        console.error('Guild data error:', err);
        showToast('❌ فشل جلب البيانات', 'danger');
    }
}

function goToStep2() {
    const title = document.getElementById('setupTitle').value.trim();
    const description = document.getElementById('setupDescription').value.trim();
    const targetChannel = document.getElementById('setupTargetChannel').value;

    if (!title || !description || !targetChannel) {
        showToast('❌ املأ الاسم والوصف وروم البانل', 'danger');
        return;
    }

    document.getElementById('setupPanelStep1').style.display = 'none';
    document.getElementById('setupBotTypeGroup').style.display = 'none';
    document.getElementById('setupPanelStep2').style.display = 'block';
    document.getElementById('setupPanelStep3').style.display = 'none';
}

function startCategories() {
    const count = parseInt(document.getElementById('categoriesCountInput').value);

    if (!count || count < 1 || count > 10) {
        showToast('❌ اختر عدد من 1 لـ 10', 'danger');
        return;
    }

    categoriesCount = count;
    categoriesData = [];

    document.getElementById('setupPanelStep2').style.display = 'none';
    document.getElementById('setupPanelStep3').style.display = 'block';

    renderCategoryForms();
}

function renderCategoryForms() {
    const container = document.getElementById('categoriesFormContainer');
    if (!container) return;

    container.innerHTML = '';

    for (let i = 0; i < categoriesCount; i++) {
        const catHtml = `
            <div class="category-form-item" data-index="${i}">
                <h4>📁 القسم ${i + 1}</h4>
                <div class="form-group">
                    <label>اسم القسم</label>
                    <input type="text" class="cat-name" placeholder="مثال: الدعم الفني">
                </div>
                <div class="form-group">
                    <label>الإيموجي (اختياري)</label>
                    <input type="text" class="cat-emoji" placeholder="مثال: 🎫">
                </div>
                <div class="form-group">
                    <label>الكاتيجوري</label>
                    <input type="text" class="cat-category-search" placeholder="🔍 اكتب للفلترة...">
                    <select class="cat-category">
                        <option value="">-- اختر كاتيجوري --</option>
                        ${allCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>رتبة الدعم</label>
                    <input type="text" class="cat-role-search" placeholder="🔍 اكتب للفلترة...">
                    <select class="cat-role">
                        <option value="">-- اختر رتبة --</option>
                        ${allRoles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>نوع التسمية</label>
                    <select class="cat-naming">
                        <option value="number">🔢 أرقام (ticket-0001)</option>
                        <option value="username">👤 اسم العضو (ticket-username)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>رسالة الترحيب</label>
                    <textarea class="cat-welcome" rows="3">مرحباً بك، تفضل بتقديم استفسارك.</textarea>
                </div>
                <div class="form-group">
                    <label>لون الإمبد</label>
                    <input type="text" class="cat-color" value="#5865F2">
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', catHtml);
    }

    document.querySelectorAll('.cat-category-search').forEach((input, idx) => {
        input.addEventListener('input', (e) => filterSelect(`.category-form-item[data-index="${idx}"] .cat-category`, e.target.value));
    });
    document.querySelectorAll('.cat-role-search').forEach((input, idx) => {
        input.addEventListener('input', (e) => filterSelect(`.category-form-item[data-index="${idx}"] .cat-role`, e.target.value));
    });
}

async function submitPanel() {
    if (!selectedGuildId) return showToast('❌ اختر السيرفر', 'danger');

    const botType = document.getElementById('setupBotType').value || 'free';
    const title = document.getElementById('setupTitle').value.trim();
    const description = document.getElementById('setupDescription').value.trim();
    const bannerImage = document.getElementById('setupBannerImage').value.trim() || null;
    const image = document.getElementById('setupImage').value.trim() || null;
    const targetChannelId = document.getElementById('setupTargetChannel').value;
    const logChannelId = document.getElementById('setupLogChannel').value || null;
    const ratingChannelId = document.getElementById('setupRatingChannel').value || null;
    const guildName = document.getElementById('setupGuildName').value;

    categoriesData = [];
    const forms = document.querySelectorAll('.category-form-item');

    for (const form of forms) {
        const name = form.querySelector('.cat-name').value.trim();
        const emoji = form.querySelector('.cat-emoji').value.trim() || null;
        const categoryId = form.querySelector('.cat-category').value;
        const supportRoleId = form.querySelector('.cat-role').value || null;
        const namingType = form.querySelector('.cat-naming').value;
        const welcomeMsg = form.querySelector('.cat-welcome').value.trim();
        const color = form.querySelector('.cat-color').value.trim();

        if (!name || !categoryId) return showToast('❌ املأ اسم القسم والكاتيجوري', 'danger');

        categoriesData.push({
            name, categoryId, supportRoleId, namingType, welcomeMsg, color, emoji,
            namePrefix: name.toLowerCase().replace(/\s+/g, '-')
        });
    }

    const submitBtn = document.getElementById('setupSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ جاري الحفظ...';

    try {
        const res = await fetch('/api/dashboard/setup-panel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                guildId: selectedGuildId, guildName, botType, title, description,
                bannerImage, image, targetChannelId, logChannelId, ratingChannelId,
                categoriesData
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast('✅ تم حفظ الإعدادات! البوت هينشر البانل خلال دقائق', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
        } else {
            showToast(`❌ ${data.error}`, 'danger');
        }
    } catch (err) {
        showToast('❌ فشل الاتصال', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ============================================
// ==== APPLICATION SETUP ====
// ============================================

async function loadGuildsForApp() {
    try {
        const res = await fetch('/api/dashboard/servers', { credentials: 'include' });
        const data = await res.json();

        const select = document.getElementById('appGuildSelect');
        if (!select) return;

        if (!data.success || data.data.length === 0) {
            select.innerHTML = '<option value="">لا توجد سيرفرات (لازم تكون أدمن)</option>';
            return;
        }

        select.innerHTML = '<option value="">-- اختر السيرفر --</option>';
        data.data.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.name;
            option.dataset.name = g.name;
            select.appendChild(option);
        });

        // ==== لو فيه سيرفر محفوظ في sessionStorage ====
        const savedGuildId = sessionStorage.getItem('setupGuildId');
        if (savedGuildId) {
            const savedGuild = data.data.find(g => g.id === savedGuildId);
            if (savedGuild) {
                select.value = savedGuildId;
                sessionStorage.removeItem('setupGuildId');
                sessionStorage.removeItem('setupGuildName');
                sessionStorage.removeItem('setupType');
                await loadAppGuildData();
            }
        }
    } catch (err) {
        console.error('Setup app error:', err);
    }
}

async function loadAppGuildData() {
    const select = document.getElementById('appGuildSelect');
    appGuildId = select.value;

    if (!appGuildId) {
        document.getElementById('appStep1').style.display = 'none';
        return;
    }

    const selectedOption = select.options[select.selectedIndex];
    document.getElementById('appGuildName').value = selectedOption.dataset.name;

    try {
        const checkRes = await fetch(`/api/dashboard/guild/${appGuildId}/check-bots`, { credentials: 'include' });
        const checkData = await checkRes.json();

        const d = checkData.data || {};
        appBotType = (d.premium && d.premiumActive) ? 'premium' : 'free';

        document.querySelectorAll('.premium-only').forEach(el => {
            el.style.display = appBotType === 'premium' ? '' : 'none';
        });

        const maxQ = appBotType === 'premium' ? 10 : 5;
        const qHint = document.getElementById('appQuestionsHint');
        if (qHint) qHint.textContent = `(1-${maxQ})`;
        window.appMaxQuestions = maxQ;
    } catch (err) {
        console.error('Check bots error:', err);
        appBotType = 'free';
    }

    try {
        const res = await fetch(`/api/dashboard/guild/${appGuildId}/data?botType=${appBotType}`, { credentials: 'include' });
        const data = await res.json();

        if (!data.success) {
            showToast('❌ فشل جلب البيانات', 'danger');
            return;
        }

        appChannels = data.data.textChannels || [];
        appRoles = data.data.roles || [];

        fillChannelSelect('appPanelChannel', appChannels, 'اختر قناة البانل');
        fillChannelSelect('appLogChannel', appChannels, 'اختر قناة الإجابات');
        fillChannelSelect('appReviewLogChannel', appChannels, 'اختر قناة لوق المراجعة');

        const roleSelect = document.getElementById('appRoleSelect');
        const acceptRoleSelect = document.getElementById('appAcceptRoleSelect');
        const rejectRoleSelect = document.getElementById('appRejectRoleSelect');

        roleSelect.innerHTML = '<option value="">-- اختر رتبة مسؤولة --</option>';
        acceptRoleSelect.innerHTML = '<option value="">-- اختر رول القبول --</option>';
        if (rejectRoleSelect) rejectRoleSelect.innerHTML = '<option value="">-- بدون رول --</option>';

        appRoles.forEach(r => {
            const opt1 = document.createElement('option');
            opt1.value = r.id;
            opt1.textContent = r.name;
            roleSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = r.id;
            opt2.textContent = r.name;
            acceptRoleSelect.appendChild(opt2);

            if (rejectRoleSelect) {
                const opt3 = document.createElement('option');
                opt3.value = r.id;
                opt3.textContent = r.name;
                rejectRoleSelect.appendChild(opt3);
            }
        });

        appQuestions = [];
        renderQuestions();

        document.getElementById('appStep1').style.display = 'block';
    } catch (err) {
        console.error('App guild data error:', err);
        showToast('❌ فشل جلب البيانات', 'danger');
    }
}

function addQuestion() {
    const max = window.appMaxQuestions || 5;
    if (appQuestions.length >= max) {
        showToast(`❌ الحد الأقصى ${max} أسئلة`, 'danger');
        return;
    }
    appQuestions.push('');
    renderQuestions();
}

function removeQuestion(idx) {
    appQuestions.splice(idx, 1);
    renderQuestions();
}

function updateQuestion(idx, value) {
    appQuestions[idx] = value;
}

function renderQuestions() {
    const container = document.getElementById('appQuestionsContainer');
    if (!container) return;

    if (appQuestions.length === 0) {
        container.innerHTML = '<p class="empty-state">لا توجد أسئلة — اضغط "إضافة سؤال"</p>';
        return;
    }

    container.innerHTML = appQuestions.map((q, i) => `
        <div class="question-item">
            <label>السؤال ${i + 1}</label>
            <div style="display:flex;gap:0.5rem;">
                <input type="text" value="${escapeHtml(q)}" placeholder="اكتب السؤال..." oninput="updateQuestion(${i}, this.value)" style="flex:1;">
                <button type="button" class="btn btn-danger" onclick="removeQuestion(${i})" style="padding:0.5rem 1rem;">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function submitApp() {
    if (!appGuildId) return showToast('❌ اختر السيرفر', 'danger');

    const name = document.getElementById('appName').value.trim();
    const description = document.getElementById('appDescription').value.trim();
    const bannerImage = document.getElementById('appBannerImage').value.trim() || null;
    const panelChannelId = document.getElementById('appPanelChannel').value;
    const logChannelId = document.getElementById('appLogChannel').value;
    const roleId = document.getElementById('appRoleSelect').value;
    const acceptRoleId = document.getElementById('appAcceptRoleSelect').value;
    const acceptMessage = document.getElementById('appAcceptMessage').value.trim() || null;
    const guildName = document.getElementById('appGuildName').value;

    let reviewLogChannelId = null;
    let rejectRoleId = null;
    let rejectMessage = null;

    if (appBotType === 'premium') {
        reviewLogChannelId = document.getElementById('appReviewLogChannel').value || null;
        rejectRoleId = document.getElementById('appRejectRoleSelect').value || null;
        rejectMessage = document.getElementById('appRejectMessage').value.trim() || null;
    }

    if (!name) return showToast('❌ املأ اسم التقديم', 'danger');
    if (!panelChannelId) return showToast('❌ اختر قناة البانل', 'danger');
    if (!logChannelId) return showToast('❌ اختر قناة الإجابات', 'danger');
    if (!roleId) return showToast('❌ اختر رتبة مسؤولة', 'danger');
    if (!acceptRoleId) return showToast('❌ اختر رول القبول', 'danger');
    if (appQuestions.length === 0) return showToast('❌ ضيف سؤال واحد على الأقل', 'danger');

    const questions = appQuestions.filter(q => q.trim() !== '');
    if (questions.length === 0) return showToast('❌ كل الأسئلة فاضية', 'danger');

    const submitBtn = document.getElementById('appSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ جاري الحفظ...';

    const endpoint = appBotType === 'premium'
        ? '/api/dashboard/setup-application-premium'
        : '/api/dashboard/setup-application-free';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                guildId: appGuildId, guildName, botType: appBotType,
                name, description, bannerImage,
                panelChannelId, logChannelId, reviewLogChannelId,
                roleId, acceptRoleId, rejectRoleId,
                acceptMessage, rejectMessage,
                questions
            })
        });

        const data = await res.json();

        if (data.success) {
            showToast('✅ تم حفظ إعدادات التقديم! البوت هينشر البانل خلال دقائق', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
        } else {
            showToast(`❌ ${data.error}`, 'danger');
        }
    } catch (err) {
        showToast('❌ فشل الاتصال', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ============================================
// ==== INIT ====
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('setupGuildSelect')) {
        loadGuildsForTicket();
    }

    if (document.getElementById('appGuildSelect')) {
        loadGuildsForApp();
    }
});

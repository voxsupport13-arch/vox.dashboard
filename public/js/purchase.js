// ==== VOX Dashboard - Purchase JS ====
(function() {
    'use strict';

    const SUPPORTED_LANGS = ['en', 'ar', 'es', 'fr'];
    const DEFAULT_LANG = 'en';

    // ==== Get Current Language ====
    function getCurrentLang() {
        const lang = localStorage.getItem('vox-lang') || DEFAULT_LANG;
        return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    }

    // ==== Translations ====
    const PURCHASE_I18N = {
        en: {
            loadingGuilds: '⏳ Loading servers...',
            failedGuilds: '❌ Failed to load servers',
            noGuilds: 'No servers (you must be admin)',
            chooseGuild: '-- Choose Server --',
            writeCode: '❌ Enter the code first',
            checking: '⏳ Checking...',
            invalidCoupon: 'Invalid coupon',
            appliedCode: '✅ Code applied:',
            beforeDiscount: 'Price before discount:',
            discountRate: 'Discount rate:',
            afterDiscount: 'Price after discount:',
            failedCheck: '❌ Check failed',
            chooseServer: '❌ Choose a server',
            sending: '⏳ Sending...',
            success: '✅ Your request has been sent successfully! It will be reviewed soon.',
            failed: '❌ Connection failed'
        },
        ar: {
            loadingGuilds: '⏳ جاري تحميل السيرفرات...',
            failedGuilds: '❌ فشل تحميل السيرفرات',
            noGuilds: 'لا توجد سيرفرات (لازم تكون أدمن)',
            chooseGuild: '-- اختر السيرفر --',
            writeCode: '❌ اكتب الكود الأول',
            checking: '⏳ جاري التحقق...',
            invalidCoupon: 'الكود غير صحيح',
            appliedCode: '✅ تم تطبيق الكود:',
            beforeDiscount: 'السعر قبل الخصم:',
            discountRate: 'نسبة الخصم:',
            afterDiscount: 'السعر بعد الخصم:',
            failedCheck: '❌ فشل التحقق',
            chooseServer: '❌ اختر السيرفر',
            sending: '⏳ جاري الإرسال...',
            success: '✅ تم إرسال طلبك بنجاح! سيتم مراجعته قريبًا.',
            failed: '❌ فشل الاتصال'
        },
        es: {
            loadingGuilds: '⏳ Cargando servidores...',
            failedGuilds: '❌ Error al cargar servidores',
            noGuilds: 'No hay servidores (debes ser admin)',
            chooseGuild: '-- Elige Servidor --',
            writeCode: '❌ Escribe el código primero',
            checking: '⏳ Verificando...',
            invalidCoupon: 'Cupón no válido',
            appliedCode: '✅ Código aplicado:',
            beforeDiscount: 'Precio antes del descuento:',
            discountRate: 'Tasa de descuento:',
            afterDiscount: 'Precio después del descuento:',
            failedCheck: '❌ Verificación fallida',
            chooseServer: '❌ Elige un servidor',
            sending: '⏳ Enviando...',
            success: '✅ ¡Tu solicitud ha sido enviada con éxito! Será revisada pronto.',
            failed: '❌ Error de conexión'
        },
        fr: {
            loadingGuilds: '⏳ Chargement des serveurs...',
            failedGuilds: '❌ Échec du chargement des serveurs',
            noGuilds: 'Aucun serveur (vous devez être admin)',
            chooseGuild: '-- Choisir Serveur --',
            writeCode: '❌ Entrez le code d\'abord',
            checking: '⏳ Vérification...',
            invalidCoupon: 'Coupon invalide',
            appliedCode: '✅ Code appliqué :',
            beforeDiscount: 'Prix avant réduction :',
            discountRate: 'Taux de réduction :',
            afterDiscount: 'Prix après réduction :',
            failedCheck: '❌ Échec de la vérification',
            chooseServer: '❌ Choisissez un serveur',
            sending: '⏳ Envoi en cours...',
            success: '✅ Votre demande a été envoyée avec succès ! Elle sera examinée bientôt.',
            failed: '❌ Échec de la connexion'
        }
    };

    function t(key) {
        const lang = getCurrentLang();
        return PURCHASE_I18N[lang]?.[key] || PURCHASE_I18N.en[key] || key;
    }

    // ==== Show Coupon Input ====
    window.showCouponInput = function() {
        const couponBox = document.getElementById('couponBox');
        const hasCouponBtn = document.getElementById('hasCouponBtn');

        if (couponBox) {
            couponBox.style.display = 'block';
            hasCouponBtn.style.display = 'none';
            document.getElementById('couponInput').focus();
        }
    };

    // ==== Load User Guilds ====
    async function loadUserGuilds() {
        try {
            const res = await fetch('/api/dashboard/servers', {
                credentials: 'include'
            });
            const data = await res.json();

            const select = document.getElementById('guildSelect');
            if (!select) return;

            if (!data.success) {
                select.innerHTML = `<option value="">${t('failedGuilds')}</option>`;
                console.error('Servers error:', data.error);
                return;
            }

            if (data.data.length === 0) {
                select.innerHTML = `<option value="">${t('noGuilds')}</option>`;
                return;
            }

            select.innerHTML = `<option value="">${t('chooseGuild')}</option>`;

            data.data.forEach(g => {
                const option = document.createElement('option');
                option.value = g.id;
                option.textContent = g.name;
                option.dataset.name = g.name;
                select.appendChild(option);
            });

            select.addEventListener('change', () => {
                const selected = select.options[select.selectedIndex];
                document.getElementById('guildName').value = selected.dataset.name || '';
            });
        } catch (err) {
            console.error('Guilds error:', err);
            const select = document.getElementById('guildSelect');
            if (select) select.innerHTML = `<option value="">${t('failedGuilds')}</option>`;
        }
    }

    // ==== Coupon State ====
    let currentCoupon = null;

    // ==== Validate Coupon ====
    window.validateCoupon = async function() {
        const couponInput = document.getElementById('couponInput');
        const planSelect = document.getElementById('planSelect');
        const paymentSelect = document.getElementById('paymentSelect');
        const couponResult = document.getElementById('couponResult');

        if (!couponInput) return;

        const code = couponInput.value.trim();
        const plan = planSelect ? planSelect.value : 'monthly';
        const paymentMethod = paymentSelect ? paymentSelect.value : 'credit';

        if (!code) {
            couponResult.innerHTML = `<p style="color:var(--danger);">${t('writeCode')}</p>`;
            return;
        }

        couponResult.innerHTML = `<p style="color:var(--text-muted);">${t('checking')}</p>`;

        try {
            const res = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code, plan, paymentMethod })
            });

            const data = await res.json();

            if (!data.success) {
                couponResult.innerHTML = `
                    <div class="coupon-result error">
                        <p>❌ ${data.message || t('invalidCoupon')}</p>
                        <p style="font-size:0.85rem;">${data.messageEn || ''}</p>
                    </div>
                `;
                currentCoupon = null;
                return;
            }

            const d = data.data;
            currentCoupon = d.code;

            couponResult.innerHTML = `
                <div class="coupon-result success">
                    <h4>${t('appliedCode')} <code>${d.code}</code></h4>
                    <div class="coupon-info">
                        <div class="coupon-row">
                            <span>${t('beforeDiscount')}</span>
                            <strong>${d.originalLabel}</strong>
                        </div>
                        <div class="coupon-row">
                            <span>${t('discountRate')}</span>
                            <strong style="color:var(--success);">${d.discount}%</strong>
                        </div>
                        <div class="coupon-row highlight">
                            <span>${t('afterDiscount')}</span>
                            <strong>${d.finalLabel}</strong>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            couponResult.innerHTML = `<p style="color:var(--danger);">${t('failedCheck')}</p>`;
            currentCoupon = null;
        }
    };

    // ==== Submit Purchase ====
    document.addEventListener('DOMContentLoaded', () => {
        loadUserGuilds();

        const form = document.getElementById('purchaseForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const body = {
                plan: formData.get('plan'),
                paymentMethod: formData.get('paymentMethod'),
                transferUser: formData.get('transferUser'),
                proofImage: formData.get('proofImage') || null,
                couponCode: formData.get('couponCode') || null,
                guildId: formData.get('guildId'),
                guildName: formData.get('guildName'),
                userLang: getCurrentLang() // ✅ نبعث اللغة الحالية
            };

            if (!body.guildId) {
                showToast(t('chooseServer'), 'danger');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = t('sending');

            try {
                const res = await fetch('/api/purchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });

                const data = await res.json();

                if (data.success) {
                    showToast(t('success'), 'success');
                    form.reset();
                    document.getElementById('couponResult').innerHTML = '';
                    document.getElementById('couponBox').style.display = 'none';
                    document.getElementById('hasCouponBtn').style.display = 'block';
                    currentCoupon = null;
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
    });

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

})();

// ==== VOX Dashboard - Purchase JS ====

// ==== Show Coupon Input ====
function showCouponInput() {
    const couponBox = document.getElementById('couponBox');
    const hasCouponBtn = document.getElementById('hasCouponBtn');

    if (couponBox) {
        couponBox.style.display = 'block';
        hasCouponBtn.style.display = 'none';
        document.getElementById('couponInput').focus();
    }
}

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
            select.innerHTML = '<option value="">❌ فشل تحميل السيرفرات</option>';
            console.error('Servers error:', data.error);
            return;
        }

        if (data.data.length === 0) {
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

        select.addEventListener('change', () => {
            const selected = select.options[select.selectedIndex];
            document.getElementById('guildName').value = selected.dataset.name || '';
        });
    } catch (err) {
        console.error('Guilds error:', err);
        const select = document.getElementById('guildSelect');
        if (select) select.innerHTML = '<option value="">❌ فشل الاتصال</option>';
    }
}

// ==== Coupon State ====
let currentCoupon = null;

// ==== Validate Coupon ====
async function validateCoupon() {
    const couponInput = document.getElementById('couponInput');
    const planSelect = document.getElementById('planSelect');
    const paymentSelect = document.getElementById('paymentSelect');
    const couponResult = document.getElementById('couponResult');

    if (!couponInput) return;

    const code = couponInput.value.trim();
    const plan = planSelect ? planSelect.value : 'monthly';
    const paymentMethod = paymentSelect ? paymentSelect.value : 'credit';

    if (!code) {
        couponResult.innerHTML = '<p style="color:var(--danger);">❌ اكتب الكود الأول</p>';
        return;
    }

    couponResult.innerHTML = '<p style="color:var(--text-muted);">⏳ جاري التحقق...</p>';

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
                    <p>❌ ${data.message || 'الكود غير صحيح'}</p>
                    <p style="font-size:0.85rem;">${data.messageEn || 'Invalid coupon'}</p>
                </div>
            `;
            currentCoupon = null;
            return;
        }

        const d = data.data;
        currentCoupon = d.code;

        couponResult.innerHTML = `
            <div class="coupon-result success">
                <h4>✅ تم تطبيق الكود: <code>${d.code}</code></h4>
                <div class="coupon-info">
                    <div class="coupon-row">
                        <span>السعر قبل الخصم:</span>
                        <strong>${d.originalLabel}</strong>
                    </div>
                    <div class="coupon-row">
                        <span>نسبة الخصم:</span>
                        <strong style="color:var(--success);">${d.discount}%</strong>
                    </div>
                    <div class="coupon-row highlight">
                        <span>السعر بعد الخصم:</span>
                        <strong>${d.finalLabel}</strong>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        couponResult.innerHTML = '<p style="color:var(--danger);">❌ فشل التحقق</p>';
        currentCoupon = null;
    }
}

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
            guildName: formData.get('guildName')
        };

        if (!body.guildId) {
            showToast('❌ اختر السيرفر', 'danger');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ جاري الإرسال...';

        try {
            const res = await fetch('/api/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.success) {
                showToast('✅ تم إرسال طلبك بنجاح! سيتم مراجعته قريبًا.', 'success');
                form.reset();
                document.getElementById('couponResult').innerHTML = '';
                document.getElementById('couponBox').style.display = 'none';
                document.getElementById('hasCouponBtn').style.display = 'block';
                currentCoupon = null;
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
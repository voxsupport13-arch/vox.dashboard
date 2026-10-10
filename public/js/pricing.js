// ==== VOX Dashboard - Pricing JS ====

// ==== Coupon Validation ====
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
        couponResult.innerHTML = '';
        return;
    }

    couponResult.innerHTML = '<p style="color:var(--text-muted);">⏳ جاري التحقق...</p>';

    try {
        const res = await fetch('/api/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            return;
        }

        const d = data.data;
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
                <button onclick="proceedToPurchase()" class="btn btn-primary" style="width:100%;margin-top:1rem;">
                    💳 متابعة الشراء
                </button>
            </div>
        `;
    } catch (err) {
        couponResult.innerHTML = '<p style="color:var(--danger);">❌ فشل التحقق</p>';
    }
}

// ==== Proceed to Purchase ====
function proceedToPurchase() {
    const planSelect = document.getElementById('planSelect');
    const paymentSelect = document.getElementById('paymentSelect');

    const plan = planSelect ? planSelect.value : 'monthly';
    const payment = paymentSelect ? paymentSelect.value : 'credit';

    // التوجيه لصفحة الشراء
    window.location.href = `/purchase?plan=${plan}&payment=${payment}`;
}

// ==== Auto Validate on Input ====
document.addEventListener('DOMContentLoaded', () => {
    const couponInput = document.getElementById('couponInput');
    if (couponInput) {
        couponInput.addEventListener('blur', validateCoupon);
    }
});

// ==== Helpers ====
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
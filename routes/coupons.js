// ==== Coupons Routes (Public) ====
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ==== Middleware: تسجيل دخول ====
function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, error: 'يجب تسجيل الدخول أولاً' });
}

router.use(ensureAuth);

// ==== التحقق من كود ====
router.post('/validate', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { code, plan, paymentMethod } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, error: 'الكود مطلوب' });
        }

        // البحث عن الكود
        const coupon = await db.collection('vox_coupons').findOne({
            code: code.toUpperCase()
        });

        if (!coupon) {
            return res.json({
                success: false,
                reason: 'invalid',
                message: 'هذا الكود غير صحيح',
                messageEn: 'Invalid coupon code'
            });
        }

        // التحقق من الصلاحية
        const now = new Date();

        if (!coupon.active) {
            return res.json({
                success: false,
                reason: 'disabled',
                message: 'هذا الكود معطل',
                messageEn: 'This coupon is disabled'
            });
        }

        if (now < new Date(coupon.startDate)) {
            return res.json({
                success: false,
                reason: 'not_started',
                message: 'هذا الكود لم يبدأ بعد',
                messageEn: 'This coupon has not started yet'
            });
        }

        if (now > new Date(coupon.endDate)) {
            return res.json({
                success: false,
                reason: 'expired',
                message: 'هذا الكود منتهي الصلاحية',
                messageEn: 'This coupon has expired'
            });
        }

        if (coupon.usedCount >= coupon.maxUses) {
            return res.json({
                success: false,
                reason: 'max_uses',
                message: 'هذا الكود وصل للحد الأقصى من الاستخدامات',
                messageEn: 'This coupon has reached maximum uses'
            });
        }

        // حساب السعر
        const prices = {
            monthly: {
                credit: 100000000,
                adm_cash: 50000000,
                creditLabel: '100 مليون كريدت',
                admLabel: '50 مليون ADM'
            },
            yearly: {
                credit: 1000000000,
                adm_cash: 500000000,
                creditLabel: '1 مليار كريدت',
                admLabel: '500 مليون ADM'
            }
        };

        const planData = prices[plan] || prices.monthly;
        const originalPrice = planData[paymentMethod] || planData.credit;
        const originalLabel = paymentMethod === 'adm_cash' ? planData.admLabel : planData.creditLabel;

        const discount = coupon.discount;
        const finalPrice = Math.round(originalPrice * (1 - discount / 100));
        const finalLabel = formatPrice(finalPrice, paymentMethod);

        res.json({
            success: true,
            data: {
                code: coupon.code,
                discount,
                originalPrice,
                originalLabel,
                finalPrice,
                finalLabel,
                plan,
                paymentMethod
            }
        });
    } catch (err) {
        console.error('Coupon validate error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

function formatPrice(price, method) {
    if (price >= 1000000000) {
        return `${(price / 1000000000).toFixed(1)} مليار ${method === 'adm_cash' ? 'ADM' : 'كريدت'}`;
    }
    if (price >= 1000000) {
        return `${(price / 1000000).toFixed(0)} مليون ${method === 'adm_cash' ? 'ADM' : 'كريدت'}`;
    }
    return `${price} ${method === 'adm_cash' ? 'ADM' : 'كريدت'}`;
}

module.exports = router;
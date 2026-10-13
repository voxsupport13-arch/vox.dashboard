// ==== Purchase Routes ====
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, error: 'يجب تسجيل الدخول أولاً' });
}

router.use(ensureAuth);

router.post('/', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const {
            plan,
            paymentMethod,
            transferUser,
            proofImage,
            couponCode,
            guildId,
            guildName,
            userLang
        } = req.body;

        if (!plan || !paymentMethod || !transferUser || !guildId) {
            return res.status(400).json({ success: false, error: 'كل الحقول مطلوبة' });
        }

        // ✅ تحقق من اللغة المدعومة
        const SUPPORTED_LANGS = ['en', 'ar', 'es', 'fr'];
        const finalLang = SUPPORTED_LANGS.includes(userLang) ? userLang : 'en';

        const prices = {
            monthly: {
                credit: { value: 100000000, label: '100 مليون كريدت' },
                adm_cash: { value: 50000000, label: '50 مليون ADM' }
            },
            yearly: {
                credit: { value: 1000000000, label: '1 مليار كريدت' },
                adm_cash: { value: 500000000, label: '500 مليون ADM' }
            }
        };

        const planData = prices[plan] || prices.monthly;
        const priceData = planData[paymentMethod] || planData.credit;

        let originalPrice = priceData.value;
        let originalLabel = priceData.label;
        let finalPrice = originalPrice;
        let finalLabel = originalLabel;
        let couponDiscount = 0;

        if (couponCode) {
            const coupon = await db.collection('vox_coupons').findOne({
                code: couponCode.toUpperCase()
            });

            if (coupon) {
                const now = new Date();
                const isValid = coupon.active &&
                    now >= new Date(coupon.startDate) &&
                    now <= new Date(coupon.endDate) &&
                    coupon.usedCount < coupon.maxUses;

                if (isValid) {
                    couponDiscount = coupon.discount;
                    finalPrice = Math.round(originalPrice * (1 - couponDiscount / 100));
                    finalLabel = formatPrice(finalPrice, paymentMethod);
                }
            }
        }

        const user = req.user;

        await db.collection('vox_purchases').insertOne({
            userId: user.id,
            username: user.username,
            userAvatar: user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : null,
            guildId,
            guildName: guildName || null,
            plan,
            paymentMethod,
            originalPrice: originalLabel,
            finalPrice: finalLabel,
            couponCode: couponCode || null,
            couponDiscount,
            transferUser,
            proofImage: proofImage || null,
            userLang: finalLang, // ✅ حفظ اللغة
            status: 'pending',
            reviewedBy: null,
            reviewedAt: null,
            rejectReason: null,
            keySent: null,
            createdAt: new Date()
        });

        if (couponCode && couponDiscount > 0) {
            await db.collection('vox_coupons').updateOne(
                { code: couponCode.toUpperCase() },
                {
                    $inc: { usedCount: 1 },
                    $push: {
                        usedBy: {
                            userId: user.id,
                            username: user.username,
                            usedAt: new Date()
                        }
                    }
                }
            );
        }

        res.json({
            success: true,
            message: 'تم إرسال طلب الشراء بنجاح. سيتم مراجعته قريبًا.'
        });
    } catch (err) {
        console.error('Purchase error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/my', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const purchases = await db.collection('vox_purchases')
            .find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

        res.json({ success: true, data: purchases });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

function formatPrice(price, method) {
    const unit = method === 'adm_cash' ? 'ADM' : 'كريدت';

    if (price >= 1000000000) {
        return `${(price / 1000000000).toFixed(1)} مليار ${unit}`;
    }
    if (price >= 1000000) {
        return `${(price / 1000000).toFixed(0)} مليون ${unit}`;
    }
    return `${price} ${unit}`;
}

module.exports = router;

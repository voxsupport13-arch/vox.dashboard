// ==== Owner Routes ====
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

function ensureOwner(req, res, next) {
    const ownerIds = (process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(Boolean);

    if (req.isAuthenticated() && ownerIds.includes(req.user.id)) {
        return next();
    }

    res.status(403).json({ success: false, error: 'ليس لديك صلاحية' });
}

router.use(ensureOwner);

// ==== إحصائيات البوت ====
router.get('/stats', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const monthlyKeys = await db.collection('kv_store').findOne({ key: 'keys_monthly' });
        const yearlyKeys = await db.collection('kv_store').findOne({ key: 'keys_yearly' });

        const monthly = monthlyKeys?.value || {};
        const yearly = yearlyKeys?.value || {};

        const monthlyAvailable = Object.values(monthly).filter(k => !k.used).length;
        const monthlyUsed = Object.values(monthly).filter(k => k.used).length;
        const yearlyAvailable = Object.values(yearly).filter(k => !k.used).length;
        const yearlyUsed = Object.values(yearly).filter(k => k.used).length;

        const premiumServersList = await db.collection('kv_store').find({
            key: { $regex: '^guild_premium_' }
        }).toArray();

        const premiumServers = premiumServersList.filter(g => g.value?.active).length;

        const openTickets = await db.collection('kv_store').countDocuments({
            key: { $regex: '^channel_data_' }
        });

        const closedTickets = await db.collection('kv_store').countDocuments({
            key: { $regex: '^closed_ticket_' }
        });

        const pendingReports = await db.collection('vox_reports').countDocuments({ status: 'pending' });
        const totalReports = await db.collection('vox_reports').countDocuments();

        const totalPurchases = await db.collection('vox_purchases').countDocuments();
        const pendingPurchases = await db.collection('vox_purchases').countDocuments({ status: 'pending' });

        let totalMembers = 0;
        premiumServersList.forEach(g => {
            if (g.value?.memberCount) totalMembers += g.value.memberCount;
        });

        res.json({
            success: true,
            data: {
                totalServers: premiumServersList.length,
                freeServers: 0,
                premiumServers,
                totalMembers,
                openTickets,
                closedTickets,
                totalPurchases,
                pendingPurchases,
                pendingReports,
                totalReports,
                monthlyAvailable,
                monthlyUsed,
                yearlyAvailable,
                yearlyUsed
            }
        });
    } catch (err) {
        console.error('Owner stats error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== إحصائيات الموقع ====
router.get('/site-stats', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const totalUsers = await db.collection('vox_users').countDocuments();

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsers = await db.collection('vox_users').countDocuments({
            lastSeen: { $gte: fiveMinutesAgo }
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayUsers = await db.collection('vox_users').countDocuments({
            lastSeen: { $gte: todayStart }
        });

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekUsers = await db.collection('vox_users').countDocuments({
            lastSeen: { $gte: weekAgo }
        });

        const recentUsers = await db.collection('vox_users')
            .find({})
            .sort({ lastSeen: -1 })
            .limit(10)
            .toArray();

        res.json({
            success: true,
            data: {
                totalUsers,
                onlineUsers,
                todayUsers,
                weekUsers,
                recentUsers
            }
        });
    } catch (err) {
        console.error('Site stats error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== الإبلاغات ====
router.get('/reports', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const reports = await db.collection('vox_reports')
            .find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        res.json({ success: true, data: reports });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== حل إبلاغ ====
router.post('/reports/:id/resolve', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!['resolved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'حالة غير صحيحة' });
        }

        const { ObjectId } = require('mongodb');

        const report = await db.collection('vox_reports').findOne({ _id: new ObjectId(id) });
        if (!report) {
            return res.status(404).json({ success: false, error: 'الإبلاغ غير موجود' });
        }

        const updateData = {
            status,
            resolvedBy: req.user.id,
            resolvedAt: new Date()
        };

        if (status === 'rejected' && reason) {
            updateData.rejectReason = reason;
        }

        await db.collection('vox_reports').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        try {
            const botToken = process.env.PREMIUM_BOT_TOKEN || process.env.FREE_BOT_TOKEN;

            if (botToken) {
                const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipient_id: report.userId })
                });

                const dmChannel = await dmRes.json();

                if (dmChannel.id) {
                    const typeMap = {
                        website: 'مشكلة في الموقع',
                        bug: 'مشكلة في الموقع',
                        ticket: 'مشكلة في التذاكر',
                        application: 'مشكلة في التقديم',
                        payment: 'مشكلة في الدفع',
                        other: 'أخرى'
                    };
                    const typeText = typeMap[report.type] || 'أخرى';

                    const message = status === 'resolved'
                        ? `✅ **تم حل مشكلتك!**\n\n**العنوان:** ${report.title}\n**القسم:** ${typeText}\n\nشكرًا لتواصلك معنا.`
                        : `❌ **لم يتم حل مشكلتك**\n\n**العنوان:** ${report.title}\n**القسم:** ${typeText}\n${reason ? `**السبب:** ${reason}` : ''}\n\nتواصل مع الدعم لمزيد من التفاصيل.`;

                    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${botToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ content: message })
                    });
                }
            }
        } catch (dmErr) {
            console.error('DM error:', dmErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Resolve error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== طلبات الشراء ====
router.get('/purchases', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const purchases = await db.collection('vox_purchases')
            .find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        res.json({ success: true, data: purchases });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== الموافقة على طلب ====
router.post('/purchases/:id/approve', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { id } = req.params;
        const { ObjectId } = require('mongodb');

        const purchase = await db.collection('vox_purchases').findOne({ _id: new ObjectId(id) });
        if (!purchase) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const keyType = purchase.plan === 'monthly' ? 'keys_monthly' : 'keys_yearly';
        const keysDoc = await db.collection('kv_store').findOne({ key: keyType });

        if (!keysDoc || !keysDoc.value) {
            return res.status(400).json({ success: false, error: 'لا توجد مفاتيح متاحة' });
        }

        const keys = keysDoc.value;

        let selectedKey = null;
        for (const [key, data] of Object.entries(keys)) {
            if (!data.used) {
                selectedKey = key;
                break;
            }
        }

        if (!selectedKey) {
            return res.status(400).json({ success: false, error: 'لا توجد مفاتيح متاحة' });
        }

        keys[selectedKey].used = true;
        keys[selectedKey].guildId = purchase.guildId;
        keys[selectedKey].activatedAt = new Date().toISOString();
        keys[selectedKey].ownerId = purchase.userId;
        keys[selectedKey].soldTo = purchase.userId;
        keys[selectedKey].soldAt = new Date().toISOString();

        await db.collection('kv_store').updateOne(
            { key: keyType },
            { $set: { value: keys } }
        );

        await db.collection('vox_purchases').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'approved',
                    reviewedBy: req.user.id,
                    reviewedAt: new Date(),
                    keySent: selectedKey
                }
            }
        );

        try {
            const botToken = process.env.PREMIUM_BOT_TOKEN;

            if (botToken) {
                const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipient_id: purchase.userId })
                });

                const dmChannel = await dmRes.json();

                if (dmChannel.id) {
                    const message = `🎉 **تم تأكيد دفعتك!**\n\n` +
                        `🔑 **المفتاح:** \`${selectedKey}\`\n` +
                        `💎 **الباقة:** ${purchase.plan === 'monthly' ? 'شهري' : 'سنوي'}\n\n` +
                        `**طريقة التفعيل:**\n` +
                        `\`/activate key:${selectedKey}\`\n` +
                        `أو\n` +
                        `\`$activate ${selectedKey}\`\n\n` +
                        `**رابط إضافة البوت البريميم:**\n${process.env.PREMIUM_BOT_INVITE}`;

                    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${botToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ content: message })
                    });
                }
            }
        } catch (dmErr) {
            console.error('DM error:', dmErr.message);
        }

        res.json({ success: true, key: selectedKey });
    } catch (err) {
        console.error('Approve error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== رفض طلب ====
router.post('/purchases/:id/reject', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { id } = req.params;
        const { reason } = req.body;
        const { ObjectId } = require('mongodb');

        if (!reason) {
            return res.status(400).json({ success: false, error: 'السبب مطلوب' });
        }

        const purchase = await db.collection('vox_purchases').findOne({ _id: new ObjectId(id) });
        if (!purchase) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        await db.collection('vox_purchases').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'rejected',
                    reviewedBy: req.user.id,
                    reviewedAt: new Date(),
                    rejectReason: reason
                }
            }
        );

        // ==== لوج الرفض ====
        await db.collection('vox_purchase_logs').insertOne({
            purchaseId: id,
            userId: purchase.userId,
            username: purchase.username,
            plan: purchase.plan,
            paymentMethod: purchase.paymentMethod,
            finalPrice: purchase.finalPrice,
            transferUser: purchase.transferUser,
            reason: reason,
            rejectedBy: req.user.id,
            rejectedByUsername: req.user.username,
            createdAt: new Date()
        });

        // ==== إرسال DM للعضو ====
        try {
            const botToken = process.env.PREMIUM_BOT_TOKEN;

            if (botToken) {
                const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipient_id: purchase.userId })
                });

                const dmChannel = await dmRes.json();

                if (dmChannel.id) {
                    const message = `❌ **تم رفض طلب الشراء**\n\n` +
                        `💎 **الباقة:** ${purchase.plan === 'monthly' ? 'شهري' : 'سنوي'}\n` +
                        `💰 **السعر:** ${purchase.finalPrice}\n` +
                        `📝 **سبب الرفض:** ${reason}\n\n` +
                        `للتواصل: ${process.env.SUPPORT_SERVER}`;

                    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${botToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ content: message })
                    });
                }
            }
        } catch (dmErr) {
            console.error('DM error:', dmErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== لوج الرفض ====
router.get('/purchase-logs', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const logs = await db.collection('vox_purchase_logs')
            .find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== الأكواد ====
router.get('/coupons', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const coupons = await db.collection('vox_coupons').find({}).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, data: coupons });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/coupons', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { code, discount, maxUses, startDate, endDate } = req.body;

        if (!code || !discount || !maxUses || !startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'كل الحقول مطلوبة' });
        }

        const existing = await db.collection('vox_coupons').findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, error: 'هذا الكود موجود بالفعل' });
        }

        await db.collection('vox_coupons').insertOne({
            code: code.toUpperCase(),
            discount: parseInt(discount),
            maxUses: parseInt(maxUses),
            usedCount: 0,
            usedBy: [],
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            active: true,
            createdBy: req.user.id,
            createdAt: new Date()
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/coupons/:id', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { ObjectId } = require('mongodb');
        await db.collection('vox_coupons').deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== الأخبار ====
router.get('/news', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const news = await db.collection('vox_news').find({}).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, data: news });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/news', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { content, duration, type } = req.body;

        if (!content || !duration) {
            return res.status(400).json({ success: false, error: 'كل الحقول مطلوبة' });
        }

        const now = new Date();
        const endDate = new Date(now.getTime() + (parseInt(duration) * 60 * 60 * 1000));

        await db.collection('vox_news').insertOne({
            content,
            type: type || 'info',
            duration: parseInt(duration),
            startDate: now,
            endDate,
            active: true,
            createdBy: req.user.id,
            createdAt: now
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/news/:id', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { id } = req.params;
        const { content, duration } = req.body;
        const { ObjectId } = require('mongodb');

        if (!content || !duration) {
            return res.status(400).json({ success: false, error: 'كل الحقول مطلوبة' });
        }

        const news = await db.collection('vox_news').findOne({ _id: new ObjectId(id) });
        if (!news) {
            return res.status(404).json({ success: false, error: 'الخبر غير موجود' });
        }

        const startDate = new Date(news.startDate);
        const endDate = new Date(startDate.getTime() + (parseInt(duration) * 60 * 60 * 1000));

        await db.collection('vox_news').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    content,
                    duration: parseInt(duration),
                    endDate,
                    updatedAt: new Date()
                }
            }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/news/:id', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { ObjectId } = require('mongodb');
        await db.collection('vox_news').deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// ==== المفاتيح ====
// ============================================

router.get('/keys', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const monthly = (await db.collection('kv_store').findOne({ key: 'keys_monthly' }))?.value || {};
        const yearly = (await db.collection('kv_store').findOne({ key: 'keys_yearly' }))?.value || {};

        const monthlyList = Object.entries(monthly).map(([key, data]) => ({ key, type: 'monthly', ...data }));
        const yearlyList = Object.entries(yearly).map(([key, data]) => ({ key, type: 'yearly', ...data }));

        res.json({
            success: true,
            data: {
                monthly: monthlyList,
                yearly: yearlyList
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== إنشاء مفتاح ====
router.post('/keys', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { key, type, duration } = req.body;

        if (!key || !type || !duration) {
            return res.status(400).json({ success: false, error: 'كل الحقول مطلوبة' });
        }

        if (type !== 'monthly' && type !== 'yearly') {
            return res.status(400).json({ success: false, error: 'النوع غير صحيح' });
        }

        const keyType = type === 'monthly' ? 'keys_monthly' : 'keys_yearly';
        const keysDoc = await db.collection('kv_store').findOne({ key: keyType });
        const keys = keysDoc?.value || {};

        if (keys[key]) {
            return res.status(400).json({ success: false, error: 'هذا المفتاح موجود بالفعل' });
        }

        keys[key] = {
            used: false,
            guildId: null,
            activatedAt: null,
            expiresAt: null,
            duration: parseInt(duration),
            ownerId: null,
            warned3Days: false,
            createdAt: new Date().toISOString()
        };

        if (keysDoc) {
            await db.collection('kv_store').updateOne(
                { key: keyType },
                { $set: { value: keys, updatedAt: new Date() } }
            );
        } else {
            await db.collection('kv_store').insertOne({
                key: keyType,
                value: keys,
                updatedAt: new Date()
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== حذف مفتاح ====
router.delete('/keys/:key', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { key } = req.params;
        const { type } = req.query;

        if (!type) {
            return res.status(400).json({ success: false, error: 'النوع مطلوب' });
        }

        const keyType = type === 'monthly' ? 'keys_monthly' : 'keys_yearly';
        const keysDoc = await db.collection('kv_store').findOne({ key: keyType });
        const keys = keysDoc?.value || {};

        if (!keys[key]) {
            return res.status(404).json({ success: false, error: 'المفتاح غير موجود' });
        }

        delete keys[key];

        await db.collection('kv_store').updateOne(
            { key: keyType },
            { $set: { value: keys, updatedAt: new Date() } }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== إرجاع مفتاح (مستخدم → غير مستخدم) ====
router.post('/keys/:key/reset', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { key } = req.params;
        const { type } = req.body;

        if (!type) {
            return res.status(400).json({ success: false, error: 'النوع مطلوب' });
        }

        const keyType = type === 'monthly' ? 'keys_monthly' : 'keys_yearly';
        const keysDoc = await db.collection('kv_store').findOne({ key: keyType });
        const keys = keysDoc?.value || {};

        if (!keys[key]) {
            return res.status(404).json({ success: false, error: 'المفتاح غير موجود' });
        }

        keys[key].used = false;
        keys[key].guildId = null;
        keys[key].activatedAt = null;
        keys[key].expiresAt = null;
        keys[key].ownerId = null;
        keys[key].warned3Days = false;

        await db.collection('kv_store').updateOne(
            { key: keyType },
            { $set: { value: keys, updatedAt: new Date() } }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;

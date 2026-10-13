// ==== Reports Routes ====
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ==== Middleware: تسجيل دخول ====
function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, error: 'يجب تسجيل الدخول أولاً' });
}

router.use(ensureAuth);

// ==== إرسال إبلاغ ====
router.post('/', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { type, title, description, imageUrl, userLang } = req.body;

        if (!title || !description) {
            return res.status(400).json({ success: false, error: 'العنوان والوصف مطلوبان' });
        }

        const user = req.user;

        // ✅ تأكد إن اللغة مدعومة
        const SUPPORTED_LANGS = ['en', 'ar', 'es', 'fr'];
        const finalLang = SUPPORTED_LANGS.includes(userLang) ? userLang : 'en';

        await db.collection('vox_reports').insertOne({
            userId: user.id,
            username: user.username,
            userAvatar: user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : null,
            type: type || 'other',
            title,
            description,
            imageUrl: imageUrl || null,
            userLang: finalLang,
            status: 'pending',
            resolvedBy: null,
            resolvedAt: null,
            createdAt: new Date()
        });

        res.json({ success: true, message: 'تم إرسال الإبلاغ بنجاح' });
    } catch (err) {
        console.error('Report error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== إبلاغاتي ====
router.get('/my', async (req, res) => {
    try {
        const db = mongoose.connection.db;

        const reports = await db.collection('vox_reports')
            .find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

        res.json({ success: true, data: reports });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;

// ==== Dashboard Routes ====
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, error: 'يجب تسجيل الدخول أولاً' });
}

router.use(ensureAuth);

// ==== Cache ====
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCache(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.time > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    cache.set(key, { data, time: Date.now() });
}

// ==== إحصائيات ====
router.get('/stats', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const userGuilds = req.user.guilds || [];
        const adminGuilds = userGuilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n);

        const openTickets = await db.collection('kv_store').countDocuments({ key: { $regex: '^channel_data_' } });
        const closedTickets = await db.collection('kv_store').countDocuments({ key: { $regex: '^closed_ticket_' } });

        res.json({
            success: true,
            data: {
                userServers: userGuilds.length,
                adminServers: adminGuilds.length,
                openTickets,
                closedTickets
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== سيرفرات المستخدم ====
router.get('/servers', async (req, res) => {
    try {
        const userGuilds = req.user.guilds || [];
        const adminGuilds = userGuilds.filter(g => {
            const perms = BigInt(g.permissions);
            return (perms & 0x8n) === 0x8n || (perms & 0x20n) === 0x20n;
        });

        const servers = adminGuilds.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
            owner: g.owner || false
        }));

        res.json({ success: true, data: servers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== التذاكر ====
router.get('/tickets', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const cursor = db.collection('kv_store').find({ key: { $regex: '^channel_data_' } });

        const tickets = [];
        await cursor.forEach(doc => {
            const channelId = doc.key.replace('channel_data_', '');
            tickets.push({ channelId, ...doc.value });
        });

        res.json({ success: true, data: tickets });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== بيانات السيرفر (قنوات ورتب) ====
router.get('/guild/:guildId/data', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { botType } = req.query;

        const userGuilds = req.user.guilds || [];
        const guild = userGuilds.find(g => g.id === guildId);

        if (!guild) return res.status(403).json({ success: false, error: 'ليس لديك صلاحية' });

        const perms = BigInt(guild.permissions);
        if ((perms & 0x8n) !== 0x8n) return res.status(403).json({ success: false, error: 'لازم تكون أدمن' });

        const cacheKey = `guild_data_${guildId}_${botType}`;
        const cached = getCache(cacheKey);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const botToken = botType === 'premium'
            ? process.env.PREMIUM_BOT_TOKEN
            : process.env.FREE_BOT_TOKEN;

        if (!botToken) return res.status(500).json({ success: false, error: `التوكن بتاع ${botType} مش موجود` });

        const [channelsRes, rolesRes] = await Promise.all([
            fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
                headers: { 'Authorization': `Bot ${botToken}` }
            }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { 'Authorization': `Bot ${botToken}` }
            })
        ]);

        const channels = await channelsRes.json();
        const roles = await rolesRes.json();

        if (!Array.isArray(channels)) {
            return res.status(500).json({ success: false, error: 'فشل جلب القنوات: ' + (channels.message || '') });
        }
        if (!Array.isArray(roles)) {
            return res.status(500).json({ success: false, error: 'فشل جلب الرتب' });
        }

        const textChannels = channels.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name, position: c.position }));
        const categories = channels.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name, position: c.position }));
        const rolesList = roles.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }));

        const data = { textChannels, categories, roles: rolesList };
        setCache(cacheKey, data);

        res.json({ success: true, data });
    } catch (err) {
        console.error('Guild data error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== حفظ البانل ====
router.post('/setup-panel', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const {
            guildId, guildName, botType, title, description,
            bannerImage, image, targetChannelId, logChannelId,
            ratingChannelId, categoriesData
        } = req.body;

        if (!guildId || !title || !description || !targetChannelId || !botType) {
            return res.status(400).json({ success: false, error: 'البيانات ناقصة' });
        }

        const userGuilds = req.user.guilds || [];
        const guild = userGuilds.find(g => g.id === guildId);
        if (!guild || (BigInt(guild.permissions) & 0x8n) !== 0x8n) {
            return res.status(403).json({ success: false, error: 'ليس لديك صلاحية' });
        }

        if (!categoriesData || !Array.isArray(categoriesData) || categoriesData.length === 0) {
            return res.status(400).json({ success: false, error: 'لازم تضيف قسم واحد على الأقل' });
        }

        const panelId = `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const panelConfig = {
            botType, guildId, guildName: guildName || '',
            title, description,
            bannerImage: bannerImage || null, image: image || null,
            targetChannelId,
            logChannelId: logChannelId || null,
            ratingChannelId: ratingChannelId || null,
            color: '#5865F2', categoriesMap: {},
            createdBy: req.user.id, createdAt: new Date(),
            status: 'pending', panelId
        };

        categoriesData.forEach((cat, idx) => {
            const key = `option_${idx + 1}`;
            panelConfig.categoriesMap[key] = {
                categoryId: cat.categoryId,
                supportRoleId: cat.supportRoleId || null,
                namePrefix: cat.namePrefix || cat.name || 'ticket',
                namingType: cat.namingType || 'number',
                welcomeMsg: cat.welcomeMsg || 'مرحباً بك، تفضل بتقديم استفسارك.',
                color: cat.color || null,
                emoji: cat.emoji || null
            };
        });

        await db.collection('vox_panel_queue').insertOne(panelConfig);

        res.json({ success: true, message: 'تم حفظ الإعدادات. سيتم نشر البانل خلال دقائق.' });
    } catch (err) {
        console.error('Setup panel error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== check-bots ====
router.get('/guild/:guildId/check-bots', async (req, res) => {
    try {
        const { guildId } = req.params;
        const db = mongoose.connection.db;

        const userGuilds = req.user.guilds || [];
        const guild = userGuilds.find(g => g.id === guildId);
        if (!guild) return res.status(403).json({ success: false, error: 'ليس لديك صلاحية' });

        const perms = BigInt(guild.permissions);
        if ((perms & 0x8n) !== 0x8n) return res.status(403).json({ success: false, error: 'لازم تكون أدمن' });

        const cacheKey = `check_bots_${guildId}`;
        const cached = getCache(cacheKey);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const freeBotToken = process.env.FREE_BOT_TOKEN;
        const premiumBotToken = process.env.PREMIUM_BOT_TOKEN;

        const [freeRes, premiumRes] = await Promise.all([
            freeBotToken
                ? fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: { 'Authorization': `Bot ${freeBotToken}` } }).catch(() => ({ ok: false }))
                : Promise.resolve({ ok: false }),
            premiumBotToken
                ? fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: { 'Authorization': `Bot ${premiumBotToken}` } }).catch(() => ({ ok: false }))
                : Promise.resolve({ ok: false })
        ]);

        const free = freeRes.ok;
        const premium = premiumRes.ok;

        const premiumGuild = await db.collection('kv_store').findOne({ key: `guild_premium_${guildId}` });
        const premiumActive = premiumGuild?.value?.active === true;

        const data = { free, premium, premiumActive };
        setCache(cacheKey, data);

        res.json({ success: true, data });
    } catch (err) {
        console.error('Check bots error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== حفظ إعدادات التقديم (المجاني) ====
router.post('/setup-application-free', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const {
            guildId, guildName, botType, name, description, bannerImage,
            panelChannelId, logChannelId, roleId, acceptRoleId, acceptMessage, questions
        } = req.body;

        if (!guildId || !name || !panelChannelId || !logChannelId || !roleId || !acceptRoleId) {
            return res.status(400).json({ success: false, error: 'البيانات ناقصة' });
        }

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, error: 'لازم تضيف سؤال واحد على الأقل' });
        }

        const userGuilds = req.user.guilds || [];
        const guild = userGuilds.find(g => g.id === guildId);
        if (!guild || (BigInt(guild.permissions) & 0x8n) !== 0x8n) {
            return res.status(403).json({ success: false, error: 'ليس لديك صلاحية' });
        }

        const appId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const appConfig = {
            botType: 'free',
            guildId, guildName: guildName || '',
            name, description: description || null, bannerImage: bannerImage || null,
            panelChannelId, logChannelId, roleId, acceptRoleId,
            acceptMessage: acceptMessage || null,
            questions,
            createdBy: req.user.id, createdAt: new Date(),
            status: 'pending', appId
        };

        await db.collection('vox_application_queue').insertOne(appConfig);

        res.json({ success: true, message: 'تم حفظ الإعدادات. سيتم نشر البانل خلال دقائق.' });
    } catch (err) {
        console.error('Setup application error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==== حفظ إعدادات التقديم (البريميم) ====
router.post('/setup-application-premium', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const {
            guildId, guildName, botType, name, description, bannerImage,
            panelChannelId, logChannelId, reviewLogChannelId,
            roleId, acceptRoleId, rejectRoleId,
            acceptMessage, rejectMessage, questions
        } = req.body;

        if (!guildId || !name || !panelChannelId || !logChannelId || !roleId || !acceptRoleId) {
            return res.status(400).json({ success: false, error: 'البيانات ناقصة' });
        }

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, error: 'لازم تضيف سؤال واحد على الأقل' });
        }

        if (questions.length > 10) {
            return res.status(400).json({ success: false, error: 'الحد الأقصى 10 أسئلة' });
        }

        const userGuilds = req.user.guilds || [];
        const guild = userGuilds.find(g => g.id === guildId);
        if (!guild || (BigInt(guild.permissions) & 0x8n) !== 0x8n) {
            return res.status(403).json({ success: false, error: 'ليس لديك صلاحية' });
        }

        // التحقق من تفعيل البريميم
        const premiumGuild = await db.collection('kv_store').findOne({ key: `guild_premium_${guildId}` });
        if (!premiumGuild?.value?.active) {
            return res.status(403).json({ success: false, error: 'هذا السيرفر مفيش فيه اشتراك بريميم فعّال' });
        }

        const appId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const appConfig = {
            botType: 'premium',
            guildId, guildName: guildName || '',
            name, description: description || null, bannerImage: bannerImage || null,
            panelChannelId, logChannelId, roleId, acceptRoleId,
            reviewLogChannelId: reviewLogChannelId || null,
            rejectRoleId: rejectRoleId || null,
            acceptMessage: acceptMessage || null,
            rejectMessage: rejectMessage || null,
            questions,
            createdBy: req.user.id, createdAt: new Date(),
            status: 'pending', appId
        };

        await db.collection('vox_application_queue').insertOne(appConfig);

        res.json({ success: true, message: 'تم حفظ الإعدادات. سيتم نشر البانل خلال دقائق.' });
    } catch (err) {
        console.error('Setup application premium error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
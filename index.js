// ==== VOX Dashboard - Main Server ====
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==== قائمة الأونرز ====
function getOwnerIds() {
    return (process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(Boolean);
}

// ==== MongoDB ====
let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 30000,
            heartbeatFrequencyMS: 10000,
            retryWrites: true
        });
        isConnected = true;
        console.log('✅ تم الاتصال بـ MongoDB');
    } catch (err) {
        console.error('❌ فشل الاتصال بـ MongoDB:', err.message);
    }
}

app.use(async (req, res, next) => {
    if (!isConnected) await connectDB();
    next();
});

// ==== Session ====
app.use(session({
    secret: process.env.SESSION_SECRET || 'vox_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'vox_sessions',
        ttl: 365 * 24 * 60 * 60
    }),
    cookie: {
        secure: false,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

// ==== Passport ====
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use('free', new DiscordStrategy({
    clientID: process.env.FREE_CLIENT_ID,
    clientSecret: process.env.FREE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/free/callback`,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    profile.botType = 'free';
    return done(null, profile);
}));

passport.use('premium', new DiscordStrategy({
    clientID: process.env.PREMIUM_CLIENT_ID,
    clientSecret: process.env.PREMIUM_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/premium/callback`,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    profile.botType = 'premium';
    return done(null, profile);
}));

// ==== تتبع المستخدمين ====
async function trackUser(user) {
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        await db.collection('vox_users').updateOne(
            { userId: user.id },
            {
                $set: {
                    userId: user.id,
                    username: user.username,
                    avatar: user.avatar || null,
                    lastSeen: new Date()
                },
                $setOnInsert: {
                    firstSeen: new Date()
                }
            },
            { upsert: true }
        );
    } catch (err) {
        console.error('Track user error:', err.message);
    }
}

// ==== Middleware: بيانات مشتركة + تتبع ====
app.use(async (req, res, next) => {
    const ownerIds = getOwnerIds();
    res.locals.user = req.user || null;
    res.locals.isOwner = req.user && ownerIds.includes(req.user.id);

    if (req.user && req.user.id) {
        trackUser(req.user).catch(() => {});
    }

    next();
});

// ==== Middleware: تسجيل دخول ====
function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();

    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'يجب تسجيل الدخول أولاً' });
    }

    return res.status(401).render('login-required', {
        supportServer: process.env.SUPPORT_SERVER,
        message: 'يجب تسجيل الدخول أولاً للوصول إلى هذه الصفحة',
        messageEn: 'You must login first to access this page'
    });
}

// ==== Middleware: الأونر بس ====
function ensureOwner(req, res, next) {
    const ownerIds = getOwnerIds();

    if (req.isAuthenticated() && ownerIds.includes(req.user.id)) {
        return next();
    }

    if (req.path.startsWith('/api/')) {
        return res.status(403).json({ success: false, error: 'ليس لديك صلاحية' });
    }

    return res.status(403).render('login-required', {
        supportServer: process.env.SUPPORT_SERVER,
        message: 'هذه الصفحة للمطور فقط',
        messageEn: 'This page is for the owner only'
    });
}

// ==== التحقق من البريميم ====
async function checkPremiumAccess(req) {
    try {
        const db = mongoose.connection.db;
        if (!db || !req.user) return false;

        const userGuilds = req.user.guilds || [];
        const adminGuilds = userGuilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n);

        for (const g of adminGuilds) {
            const premiumData = await db.collection('kv_store').findOne({
                key: `guild_premium_${g.id}`
            });
            if (premiumData?.value?.active) return true;
        }
        return false;
    } catch (err) {
        return false;
    }
}

// ==== Routes العامة ====
app.get('/', (req, res) => {
    res.render('index', {
        supportServer: process.env.SUPPORT_SERVER,
        supportEmail: process.env.SUPPORT_EMAIL,
        freeBotInvite: process.env.FREE_BOT_INVITE,
        premiumBotInvite: process.env.PREMIUM_BOT_INVITE,
        paymentUser: process.env.PAYMENT_USER
    });
});

app.get('/about', (req, res) => {
    res.render('about', {
        supportServer: process.env.SUPPORT_SERVER,
        freeBotInvite: process.env.FREE_BOT_INVITE
    });
});

app.get('/commands', (req, res) => {
    res.render('commands', { supportServer: process.env.SUPPORT_SERVER });
});

app.get('/pricing', (req, res) => {
    res.render('pricing', {
        supportServer: process.env.SUPPORT_SERVER,
        paymentUser: process.env.PAYMENT_USER
    });
});

// ==== Auth ====
app.get('/auth/free', passport.authenticate('free'));

app.get('/auth/free/callback',
    passport.authenticate('free', { failureRedirect: '/' }),
    async (req, res) => {
        await trackUser(req.user);
        req.session.save(() => res.redirect('/dashboard'));
    }
);

app.get('/auth/premium', passport.authenticate('premium'));

app.get('/auth/premium/callback',
    passport.authenticate('premium', { failureRedirect: '/' }),
    async (req, res) => {
        await trackUser(req.user);
        req.session.save(() => res.redirect('/dashboard'));
    }
);

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => res.redirect('/'));
    });
});

// ==== Dashboard ====
app.get('/dashboard', ensureAuth, async (req, res) => {
    try {
        const hasPremium = await checkPremiumAccess(req);
        if (hasPremium) return res.redirect('/dashboard/premium');
        return res.redirect('/dashboard/free');
    } catch (err) {
        return res.redirect('/dashboard/free');
    }
});

app.get('/dashboard/free', ensureAuth, async (req, res) => {
    const hasPremium = await checkPremiumAccess(req);
    res.render('dashboard', {
        botType: 'free',
        hasPremium: hasPremium,
        supportServer: process.env.SUPPORT_SERVER
    });
});

app.get('/dashboard/premium', ensureAuth, async (req, res) => {
    const hasPremium = await checkPremiumAccess(req);
    res.render('dashboard', {
        botType: 'premium',
        hasPremium: hasPremium,
        supportServer: process.env.SUPPORT_SERVER
    });
});

app.get('/reports', ensureAuth, (req, res) => {
    res.render('reports', { supportServer: process.env.SUPPORT_SERVER });
});

app.get('/purchase', ensureAuth, (req, res) => {
    res.render('purchase', {
        supportServer: process.env.SUPPORT_SERVER,
        paymentUser: process.env.PAYMENT_USER
    });
});

app.get('/owner', ensureAuth, ensureOwner, (req, res) => {
    res.render('owner', { supportServer: process.env.SUPPORT_SERVER });
});

// ==== صفحة تسطيب التكت ====
app.get('/setup/ticket', ensureAuth, async (req, res) => {
    const hasPremium = await checkPremiumAccess(req);
    res.render('setup-ticket', {
        botType: hasPremium ? 'premium' : 'free',
        hasPremium: hasPremium,
        supportServer: process.env.SUPPORT_SERVER
    });
});

// ==== صفحة تسطيب التقديم ====
app.get('/setup/application', ensureAuth, async (req, res) => {
    const hasPremium = await checkPremiumAccess(req);
    res.render('setup-application', {
        botType: hasPremium ? 'premium' : 'free',
        hasPremium: hasPremium,
        supportServer: process.env.SUPPORT_SERVER
    });
});

// ==== API Routes ====
try {
    const dashboardRoutes = require('./routes/dashboard');
    const ownerRoutes = require('./routes/owner');
    const reportsRoutes = require('./routes/reports');
    const couponsRoutes = require('./routes/coupons');
    const purchaseRoutes = require('./routes/purchase');
    const newsRoutes = require('./routes/news');

    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/owner', ownerRoutes);
    app.use('/api/reports', reportsRoutes);
    app.use('/api/coupons', couponsRoutes);
    app.use('/api/purchase', purchaseRoutes);
    app.use('/api/news', newsRoutes);

    console.log('✅ Routes loaded');
} catch (err) {
    console.error('❌ Routes error:', err.message);
}

module.exports = app;

// ==== Local Run ====
if (require.main === module) {
    const PORT = process.env.PORT || 10000;
    connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 الداشبورد شغال على البورت ${PORT}`);
            console.log(`🌐 الرابط: ${process.env.BASE_URL}`);
        });
    });
}

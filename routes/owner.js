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

        // ==== إحصائيات المستخدمين ====
        const totalUsers = await db.collection('vox_users').countDocuments();

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsers = await db.collection('vox_users').countDocuments({
            lastSeen: { $gte: fiveMinutesAgo }
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
                yearlyUsed,
                totalUsers,
                onlineUsers
            }
        });
    } catch (err) {
        console.error('Owner stats error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

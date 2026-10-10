// ==== News Routes (Public) ====
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const now = new Date();

        const news = await db.collection('vox_news')
            .find({
                active: true,
                startDate: { $lte: now },
                endDate: { $gte: now }
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();

        res.json({ success: true, data: news });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
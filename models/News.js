// ==== News Model ====
const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
    content: { type: String, required: true, maxlength: 500 },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'danger'],
        default: 'info'
    },
    duration: { type: Number, required: true }, // بالساعات
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'vox_news' });

// ==== التحقق من صلاحية الخبر ====
newsSchema.methods.isActive = function () {
    const now = new Date();
    return this.active && now >= this.startDate && now <= this.endDate;
};

module.exports = mongoose.models.News || mongoose.model('News', newsSchema);
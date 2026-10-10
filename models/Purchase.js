// ==== Purchase Model ====
const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    userAvatar: { type: String },
    guildId: { type: String, required: true, index: true },
    guildName: { type: String },
    plan: {
        type: String,
        enum: ['monthly', 'yearly'],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['credit', 'adm_cash'],
        required: true
    },
    originalPrice: { type: String, required: true },
    finalPrice: { type: String, required: true },
    couponCode: { type: String, default: null },
    couponDiscount: { type: Number, default: 0 },
    transferUser: { type: String, required: true }, // اليوزر اللي اتحول عليه
    proofImage: { type: String, default: null }, // رابط الصورة
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    rejectReason: { type: String, default: null },
    keySent: { type: String, default: null }, // المفتاح اللي اتبعت
    createdAt: { type: Date, default: Date.now, index: true }
}, { collection: 'vox_purchases' });

module.exports = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);
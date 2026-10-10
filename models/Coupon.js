// ==== Coupon Model ====
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    discount: { type: Number, required: true, min: 1, max: 100 },
    maxUses: { type: Number, required: true, min: 1 },
    usedCount: { type: Number, default: 0 },
    usedBy: [{
        userId: String,
        username: String,
        usedAt: { type: Date, default: Date.now }
    }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'vox_coupons' });

// ==== التحقق من صلاحية الكود ====
couponSchema.methods.isValid = function () {
    const now = new Date();

    if (!this.active) {
        return { valid: false, reason: 'disabled', message: 'هذا الكود معطل', messageEn: 'This coupon is disabled' };
    }

    if (now < this.startDate) {
        return { valid: false, reason: 'not_started', message: 'هذا الكود لم يبدأ بعد', messageEn: 'This coupon has not started yet' };
    }

    if (now > this.endDate) {
        return { valid: false, reason: 'expired', message: 'هذا الكود منتهي الصلاحية', messageEn: 'This coupon has expired' };
    }

    if (this.usedCount >= this.maxUses) {
        return { valid: false, reason: 'max_uses', message: 'هذا الكود وصل للحد الأقصى من الاستخدامات', messageEn: 'This coupon has reached maximum uses' };
    }

    return { valid: true };
};

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
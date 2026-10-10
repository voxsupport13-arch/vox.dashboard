// ==== Report Model ====
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    userAvatar: { type: String },
    type: {
        type: String,
        enum: ['bug', 'ticket', 'application', 'payment', 'other'],
        default: 'other'
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 2000 },
    imageUrl: { type: String, default: null },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'rejected'],
        default: 'pending',
        index: true
    },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, index: true }
}, { collection: 'vox_reports' });

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
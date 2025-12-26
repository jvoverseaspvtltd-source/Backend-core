const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        index: true,
    },
    serviceType: {
        type: String,
        required: true, // e.g., 'Immigration', 'Study Abroad'
    },
    source: {
        type: String,
        required: true, // 'website', 'chat', 'eligibility'
        enum: ['website', 'chat', 'eligibility'],
    },
    status: {
        type: String,
        default: 'new',
        enum: ['new', 'contacted', 'qualified', 'closed', 'ENQUIRY_RECEIVED'],
    },
    details: {
        type: mongoose.Schema.Types.Mixed, // For extra data like eligibility score, chat history
    },
    university: {
        type: String, // Explicit field for easier querying
    },
    preferredCountry: {
        type: String, // Explicit field for easier querying
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Lead', LeadSchema);

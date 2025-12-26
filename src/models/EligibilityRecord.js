const mongoose = require('mongoose');

const EligibilityRecordSchema = new mongoose.Schema({
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true,
    },
    // 1️⃣ Student Basic Details
    studentDetails: {
        fullName: { type: String, required: true },
        dob: Date,
        mobileNumber: String,
        emailId: String,
        currentAddress: String,
        aadhaarNumber: String, // Masked/Encrypted in storage recommendation
        panNumber: String,     // Masked/Encrypted in storage recommendation
        passportNumber: String,
    },
    // 2️⃣ Academic Details
    academics: {
        tenth: {
            board: String,
            passingYear: String,
            percentage: String,
        },
        twelfth: {
            board: String,
            passingYear: String,
            percentage: String,
        },
        graduation: {
            university: String,
            passingYear: String,
            percentage: String,
        },
        backlogs: { type: String, enum: ['Yes', 'No'] },
        gapYears: String,
    },
    // 3️⃣ Course & University Details
    courseDetails: {
        country: String,
        universityName: String,
        courseName: String,
        duration: String,
        intakeMonth: { type: String, enum: ['Jan', 'May', 'Sep'] },
        intakeYear: String,
        offerLetter: { type: String, enum: ['Yes', 'No'] },
    },
    // 4️⃣ Test Details
    testScores: {
        englishTest: String, // e.g. 'IELTS'
        englishScore: String, // e.g. '7.5'
        entranceTest: String, // e.g. 'GRE'
        entranceScore: String, // e.g. '320'
        testWaiver: { type: String, enum: ['Yes', 'No'] },
    },
    // 5️⃣ Loan Requirement Details
    loanRequirement: {
        totalCost: Number,
        requiredAmount: Number,
        selfContribution: Number,
        preferredType: { type: String, enum: ['Secured', 'Unsecured'] },
    },
    // 6️⃣ & 7️⃣ Co-Applicant Details
    coApplicant: {
        fullName: String,
        relationship: String,
        occupation: { type: String, enum: ['Salaried', 'Business', 'Self-Employed'] },
        monthlyIncome: Number,
        mobileNumber: String,
        panAadhaarAvailable: { type: String, enum: ['Yes', 'No'] },
        bankAccountAvailable: { type: String, enum: ['Yes', 'No'] },
        existingLoans: String,
    },
    // 8️⃣ Collateral Details (Only for Secured)
    collateral: {
        type: { type: String }, // House, Flat, Plot, FD
        location: String,
        marketValue: Number,
        ownership: String,
    },
    // 9️⃣ Additional Information
    additionalInfo: {
        visaApplied: { type: String, enum: ['Yes', 'No'] },
        previousRejection: { type: String, enum: ['Yes', 'No'] },
        preferredBank: String,
    },
    // Analysis Output
    analysis: {
        isEligible: { type: Boolean, default: false },
        maxEligibleAmount: Number,
        recommendedLoanType: String,
        suggestedBanks: [String],
        status: { type: String, default: 'PENDING' }, // PENDING, REVIEWED, APPROVED, REJECTED
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('EligibilityRecord', EligibilityRecordSchema);

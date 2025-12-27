const Lead = require('../models/Lead');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const emailService = require('../services/email.service');

// @route   POST api/public/intake
// @desc    Submit new lead from website form
// @access  Public
const EligibilityRecord = require('../models/EligibilityRecord');

exports.intake = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, serviceType, details } = req.body;

    try {
        // Extract university and country for top-level fields
        const university = details?.university;
        const preferredCountry = details?.preferredCountry || details?.country;

        logger.info(`Processing new enquiry from ${email} - Type: ${serviceType}`);

        // ALWAYS create a new lead for every inquiry to capture specific university interests separately
        const lead = new Lead({
            name,
            phone,
            email,
            serviceType,
            source: 'website',
            status: 'ENQUIRY_RECEIVED',
            details,
            university,
            preferredCountry,
        });

        // Log before save
        logger.info(`Attempting to save lead to database - Email: ${email}, University: ${university || 'N/A'}`);

        await lead.save();

        // Log successful save with ID
        logger.info(`✅ Lead successfully saved to database - ID: ${lead._id}, Email: ${email}, University: ${university || 'N/A'}`);

        // Determine enquiry type for email
        let enquiryType = serviceType || 'General Enquiry';

        // Build additional details for email
        const emailDetails = {};
        if (university) emailDetails.university = university;
        if (preferredCountry) emailDetails.preferredCountry = preferredCountry;
        if (details?.course) emailDetails.course = details.course;
        if (details?.intakeMonth && details?.intakeYear) {
            emailDetails.intake = `${details.intakeMonth} ${details.intakeYear}`;
        }

        // Send professional confirmation email (Non-blocking fallback)
        emailService.sendProfessionalEnquiryConfirmation(email, name, enquiryType, emailDetails)
            .then(() => logger.info(`✅ Confirmation email sent to ${email}`))
            .catch(err => logger.error(`❌ Background email failed for ${email}: ${err.message}`));

        // Return success response with saved lead data
        res.json({
            success: true,
            message: 'Enquiry submitted successfully',
            leadId: lead._id,
            data: lead
        });
    } catch (err) {
        logger.error(`❌ DATABASE SAVE FAILED for ${email}: ${err.message}`);
        logger.error('Full error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to save enquiry. Please try again or contact support.',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
        });
    }
};

// @route   POST api/public/comprehensive-eligibility
// @desc    Full multi-step eligibility check with complex logic
// @access  Public
exports.comprehensiveEligibility = async (req, res) => {
    console.log("Received Comprehensive Eligibility Body:", JSON.stringify(req.body, null, 2));
    const { studentDetails = {}, academics = {}, courseDetails = {}, testScores = {}, loanRequirement = {}, coApplicant = {}, collateral = {}, additionalInfo = {} } = req.body;
    const { emailId, fullName, mobileNumber } = studentDetails || {};

    if (!emailId || !fullName || !mobileNumber) {
        return res.status(400).json({ message: 'Student details (name, email, phone) are required' });
    }

    try {
        // 1. Find or Create Base Lead
        let lead = await Lead.findOne({ email: emailId });
        if (!lead) {
            lead = new Lead({
                name: fullName,
                phone: mobileNumber,
                email: emailId,
                serviceType: 'Loan',
                source: 'eligibility',
                status: 'ENQUIRY_RECEIVED'
            });
            await lead.save();
        }

        // 2. Logic & Analysis Engine
        let isEligible = false;
        let maxEligibleAmount = 0;
        let recommendedLoanType = "Unsecured";
        let suggestedBanks = [];

        const annualIncome = Number(coApplicant.monthlyIncome || 0) * 12;
        const requiredAmount = Number(loanRequirement.requiredAmount || 0);

        // Eligibility check
        const collateralValue = Number(collateral.marketValue || 0);
        if (annualIncome >= 300000 || collateralValue > 0) {
            isEligible = true;
        }

        // Max Amount Logic
        if (isEligible) {
            // Logic to determine range strictly between 30 Lakhs and 50 Lakhs
            // We use a base logic but clamp the result to this specific range for this requirement
            let calculatedAmount = 0;

            if (loanRequirement.preferredType === 'Secured' && collateralValue > 0) {
                // Secured: Up to 70% of property value
                calculatedAmount = collateralValue * 0.7;
            } else {
                // Unsecured: 4x of annual income
                calculatedAmount = annualIncome * 4;
            }

            // Enforce minimum 30L and maximum 50L Range
            if (calculatedAmount < 3000000) {
                maxEligibleAmount = 3000000; // Minimum 30L
            } else if (calculatedAmount > 5000000) {
                maxEligibleAmount = 5000000; // Maximum 50L
            } else {
                maxEligibleAmount = calculatedAmount;
            }

            recommendedLoanType = loanRequirement.preferredType || "Unsecured";
            suggestedBanks = ["Punjab National Bank (PNB)", "Avanse", "Credila", "Auxilo", "InCred", "Tata Capital", "Prodigy Finance", "Axis Bank", "ICICI Bank"];
        }

        // 3. Data Masking for Security
        const maskData = (str) => {
            if (!str) return "";
            return str.replace(/.(?=.{4})/g, '*');
        };

        const securedStudentDetails = {
            ...studentDetails,
            aadhaarNumber: maskData(studentDetails.aadhaarNumber),
            panNumber: maskData(studentDetails.panNumber)
        };

        // Helper to clean numeric fields (convert '' to null/0)
        const sanitizeNumeric = (val) => {
            if (val === '' || val === null || val === undefined || isNaN(val)) return 0;
            return Number(val);
        };

        const cleanedLoanRequirement = {
            ...loanRequirement,
            totalCost: sanitizeNumeric(loanRequirement.totalCost),
            requiredAmount: sanitizeNumeric(loanRequirement.requiredAmount),
            selfContribution: sanitizeNumeric(loanRequirement.selfContribution),
        };

        const cleanedCoApplicant = {
            ...coApplicant,
            monthlyIncome: sanitizeNumeric(coApplicant.monthlyIncome),
        };

        const cleanedCollateral = {
            ...collateral,
            marketValue: sanitizeNumeric(collateral.marketValue),
        };

        // 4. Create Detailed Record
        const record = new EligibilityRecord({
            leadId: lead._id,
            studentDetails: securedStudentDetails,
            academics,
            courseDetails,
            testScores,
            loanRequirement: cleanedLoanRequirement,
            coApplicant: cleanedCoApplicant,
            collateral: cleanedCollateral,
            additionalInfo,
            analysis: {
                isEligible,
                maxEligibleAmount,
                recommendedLoanType,
                suggestedBanks,
                status: 'PENDING'
            }
        });

        await record.save();

        // 5. Send Confirmation (Non-blocking)
        emailService.sendEligibilityConfirmation(emailId, fullName, isEligible, `₹30 Lakhs – ₹50 Lakhs`)
            .catch(err => logger.error(`Background Email error:`, err));

        // 6. Return Result with specific format
        res.json({
            success: true,
            isEligible,
            maxEligibleAmount,
            recommendedLoanType,
            suggestedBanks,
            message: isEligible
                ? `Based on your profile and submitted details, you are eligible for an education loan ranging between ₹30 Lakhs – ₹50 Lakhs.`
                : "We have received your details. Our senior loan advisor will contact you to discuss special cases for your eligibility."
        });

    } catch (err) {
        logger.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @route   POST api/public/eligibility-check
// @desc    Check eligibility and save separate record (Simple Version)
// @access  Public
exports.checkEligibility = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, income, cibilScore, serviceType } = req.body;
    const numericIncome = Number(income);
    const numericCibil = Number(cibilScore);

    try {
        // 1. Find or Create Base Lead
        let lead = await Lead.findOne({ email });
        if (!lead) {
            lead = new Lead({
                name,
                phone,
                email,
                serviceType: serviceType || 'Loan',
                source: 'eligibility',
                status: 'ENQUIRY_RECEIVED'
            });
            await lead.save();
        }

        // 2. Eligibility Logic
        let isEligible = false;
        let estimatedRange = "Undetermined";
        let maxEligibleAmountRaw = 0;

        if (numericIncome >= 300000 && numericCibil >= 650) {
            isEligible = true;
            estimatedRange = "₹30–40 Lakhs";
            maxEligibleAmountRaw = 5000000;
        }

        // 3. Create Eligibility Record
        const record = new EligibilityRecord({
            leadId: lead._id,
            studentDetails: { fullName: name, mobileNumber: phone, emailId: email },
            analysis: {
                isEligible,
                maxEligibleAmount: maxEligibleAmountRaw,
                status: 'PENDING'
            }
        });

        await record.save();

        // 4. Send Confirmation Email (Non-blocking)
        emailService.sendEligibilityConfirmation(email, name, isEligible, estimatedRange)
            .catch(err => logger.error(`Background Email error for ${email}:`, err));


        // 5. Return Result
        if (isEligible) {
            res.json({
                eligible: true,
                message: `Based on your profile, you may be eligible for an education loan of ${estimatedRange}, with a maximum possibility up to ₹50 Lakhs, subject to bank approval.`
            });
        } else {
            res.json({
                eligible: false,
                message: "Based on preliminary checks, we need more info to determine your exact eligibility. Our counselors will contact you to discuss options."
            });
        }
    } catch (err) {
        logger.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @route   POST api/public/chat-message
// @desc    Save chat message as a warm lead
// @access  Public
exports.chatMessage = async (req, res) => {
    const { name, phone, email, message } = req.body;

    try {
        const newLead = new Lead({
            name,
            phone,
            email,
            serviceType: 'General Inquiry',
            source: 'chat',
            details: {
                initialMessage: message
            }
        });

        await newLead.save();
        res.json({ msg: 'Message received. Agent will contact you.' });

    } catch (err) {
        logger.error(err.message);
        res.status(500).send('Server Error');
    }
};

const chatbotConfig = require('../config/chatbotConfig');

// @route   POST api/public/chat-conversation
// @desc    Interactive Chatbot Response Logic
// @access  Public
exports.chatConversation = async (req, res) => {
    const { message } = req.body;

    try {
        if (!message) {
            return res.status(400).json({ reply: "I'm listening! Please tell me what's on your mind." });
        }

        console.log(`[CHAT_DEBUG] User Message: "${message}"`);
        const lowerMsg = message.toLowerCase();
        let bestMatch = null;
        let maxScore = 0;
        let tiedMatches = [];

        // Intelligent Intent Analysis & Scoring
        for (const entry of chatbotConfig.knowledgeBase) {
            let currentScore = 0;

            for (const pattern of entry.patterns) {
                // Check for whole phrase match (Higher Weight)
                if (lowerMsg.includes(pattern.toLowerCase())) {
                    currentScore += 3;
                }

                // Check for individual keyword match using word boundaries (Lower Weight)
                const keywords = pattern.split(' ');
                keywords.forEach(word => {
                    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
                    if (regex.test(lowerMsg)) {
                        currentScore += 1;
                    }
                });
            }

            if (currentScore > maxScore) {
                maxScore = currentScore;
                bestMatch = entry;
                tiedMatches = [entry];
            } else if (currentScore > 0 && currentScore === maxScore) {
                tiedMatches.push(entry);
            }
        }

        let reply = "";
        let matchFound = false;
        let suggestions = [];

        if (maxScore > 0) {
            // If multiple intents have the same high score, ask for clarification
            if (tiedMatches.length > 1 && maxScore < 5) {
                const options = tiedMatches.map(m => m.label).join(' or ');
                reply = `I'm not quite sure—are you asking about ${options}?`;
                suggestions = tiedMatches.map(m => `Tell me about ${m.label}`);
            } else {
                // Select a random response from variations if available
                const responseData = bestMatch.response;
                if (Array.isArray(responseData)) {
                    reply = responseData[Math.floor(Math.random() * responseData.length)];
                } else {
                    reply = responseData;
                }
                matchFound = true;
                if (bestMatch.suggestions) {
                    suggestions = bestMatch.suggestions;
                }
            }
        } else {
            reply = chatbotConfig.fallbackResponse;
        }

        res.json({ reply, matchFound, score: maxScore, suggestions });

    } catch (err) {
        logger.error(`Realistic Chatbot Error: ${err.message}`);
        res.status(500).json({
            reply: "I hit a small roadblock while thinking. Could you try rephrasing that?",
            suggestions: ["Tell me about JV Overseas", "How to apply?"]
        });
    }
};

// @route   GET api/public/content
// @desc    Get dynamic content (placeholder)
// @access  Public
exports.getContent = (req, res) => {
    res.json({
        heroTitle: "Welcome to Our Services",
        news: []
    });
};

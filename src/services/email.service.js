const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');
const path = require('path');

// Log configuration status (masked)
logger.info(`Email configuration: Service=${config.emailService}, User=${config.emailUser ? 'SET' : 'MISSING'}, Pass=${config.emailPass ? 'SET' : 'MISSING'}`);

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    auth: {
        user: config.emailUser,
        pass: config.emailPass,
    },
    tls: {
        rejectUnauthorized: false // Helps bypass certain cloud network restrictions
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
});

// Verify transporter configuration with more detail
transporter.verify((error, success) => {
    if (error) {
        logger.error(`❌ Email service verification failed: ${error.message}`);
        if (error.code) logger.error(`Error Code: ${error.code}`);
        if (error.command) logger.error(`Command: ${error.command}`);
        logger.warn('Emails will not be sent until the issue is resolved.');
    } else {
        logger.info('✅ Email server is ready to send messages');
    }
});

const fs = require('fs');

// Constants for branding
const LOGO_CID = 'jv-logo';
const LOGO_PATH = path.join(__dirname, '../../assets/logo.webp');

// Verify logo existence at startup
if (!fs.existsSync(LOGO_PATH)) {
    logger.warn(`LOGO NOT FOUND at: ${LOGO_PATH}. Emails will be sent without logo.`);
} else {
    logger.info(`Logo verified at: ${LOGO_PATH}`);
}

/**
 * Standardized mail options with branding
 */
const getBaseMailOptions = (to, subject, htmlContent) => {
    const options = {
        from: `"JV Overseas" <${config.emailUser}>`,
        to,
        subject,
        html: htmlContent,
    };

    if (fs.existsSync(LOGO_PATH)) {
        options.attachments = [{
            filename: 'logo.webp',
            path: LOGO_PATH,
            cid: LOGO_CID
        }];
    }

    return options;
};

/**
 * Send eligibility check confirmation email
 */
const sendEligibilityConfirmation = async (userEmail, userName, isEligible, estimatedRange) => {
    try {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="cid:${LOGO_CID}" alt="JV Overseas" style="max-height: 60px;">
                </div>
                <h2 style="color: #1e3a8a;">Education Loan Eligibility Result</h2>
                <p>Dear ${userName},</p>
                <p>Thank you for checking your eligibility with <b>JV Overseas</b>.</p>
                <div style="background: #f0f7ff; padding: 15px; border-radius: 8px;">
                    ${isEligible ? `
                        <p style="color: #10b981; font-weight: bold;">✓ Congratulations! You are eligible</p>
                        <p><b>Estimated Range:</b> ${estimatedRange}</p>
                        <p><b>Maximum Possibility:</b> Up to ₹50 Lakhs</p>
                    ` : `
                        <p style="color: #f59e0b;">We need more information to confirm your eligibility.</p>
                        <p>A counselor will contact you shortly to discuss your profile.</p>
                    `}
                </div>
                <p>Our loan advisor will contact you within 24-48 hours with next steps.</p>
                <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #777;">
                    © ${new Date().getFullYear()} JV Overseas. All rights reserved.
                </div>
            </div>
        `;

        const mailOptions = getBaseMailOptions(userEmail, 'Loan Eligibility Check - JV Overseas', html);
        logger.info(`Attempting to send eligibility email to ${userEmail}...`);
        const info = await transporter.sendMail(mailOptions);
        logger.info(`✅ Eligibility email sent: ID=${info.messageId}, Accepted=${info.accepted}, Rejected=${info.rejected}`);
    } catch (error) {
        logger.error(`❌ Eligibility email failed for ${userEmail}: ${error.message}`);
        if (error.stack) logger.error(error.stack);
    }
};

/**
 * Professional enquiry confirmation
 */
const sendProfessionalEnquiryConfirmation = async (userEmail, userName, enquiryType, additionalDetails = {}) => {
    try {
        let detailsHtml = '';
        if (Object.keys(additionalDetails).length > 0) {
            detailsHtml = '<div style="margin: 20px 0; padding: 15px; border-left: 4px solid #1e3a8a; background: #f9fafb;">';
            for (const [key, value] of Object.entries(additionalDetails)) {
                if (value) {
                    const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                    detailsHtml += `<p><b>${label}:</b> ${value}</p>`;
                }
            }
            detailsHtml += '</div>';
        }

        const html = `
            <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; padding: 20px; background: white; border-radius: 12px; border: 1px solid #eee;">
                <div style="background: #0F2A44; padding: 20px; text-align: center; border-top-right-radius: 12px; border-top-left-radius: 12px;">
                    <img src="cid:${LOGO_CID}" alt="JV Logo" style="max-height: 50px; background: white; padding: 5px; border-radius: 4px;">
                </div>
                <div style="padding: 20px;">
                    <h3>Hello ${userName},</h3>
                    <p>We have successfully received your <b>${enquiryType}</b> enquiry.</p>
                    ${detailsHtml}
                    <p>Our counselor will review your profile and call you within 24 hours.</p>
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin: 0; color: #1e3a8a;">📋 Next Steps</h4>
                        <ul style="padding-left: 20px;">
                            <li>Personalized consultation call</li>
                            <li>University selection guidance</li>
                            <li>Application & Visa assistance</li>
                        </ul>
                    </div>
                    <p>Best Regards,<br><b>JV Overseas Team</b></p>
                </div>
            </div>
        `;

        const mailOptions = getBaseMailOptions(userEmail, `Enquiry Received - JV Overseas`, html);
        logger.info(`Attempting to send professional enquiry email to ${userEmail} for type: ${enquiryType}...`);
        const info = await transporter.sendMail(mailOptions);
        logger.info(`✅ Professional email sent: ID=${info.messageId}, Accepted=${info.accepted}, Rejected=${info.rejected}`);
    } catch (error) {
        logger.error(`❌ Professional email failed for ${userEmail}: ${error.message}`);
        if (error.stack) logger.error(error.stack);
    }
};

module.exports = {
    sendEligibilityConfirmation,
    sendProfessionalEnquiryConfirmation,
    // Legacy support (redirected to consolidated logic)
    sendEnquiryConfirmation: (email, name, details) => sendProfessionalEnquiryConfirmation(email, name, 'General', details),
    sendUniversityEnquiryConfirmation: (email, name, uni) => sendProfessionalEnquiryConfirmation(email, name, 'University', { university: uni }),
    sendEmail: async (to, subject, html) => transporter.sendMail({ from: config.emailUser, to, subject, html })
};

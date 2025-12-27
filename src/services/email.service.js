const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');

// Log configuration status (masked)
logger.info(`Email configuration Status: User=${config.emailUser ? 'SET' : 'MISSING'}, Pass=${config.emailPass ? 'SET' : 'MISSING'}, SendGridKey=${config.sendgridApiKey ? 'SET' : 'MISSING'}, BridgeUrl=${config.emailBridgeUrl ? 'SET' : 'MISSING'}`);

// Create transporter using Gmail (Standard SMTP fallback)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    pool: true,
    maxConnections: 3,
    auth: {
        user: config.emailUser,
        pass: config.emailPass,
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
});

// Verify transporter configuration
// Verify transporter configuration (Soft Check)
if (!config.sendgridApiKey && !config.emailBridgeUrl) {
    transporter.verify((error) => {
        if (error) {
            logger.warn(`⚠️ SMTP Status: Outbound Port 587 is blocked (Standard for Render Free Tier).`);
            logger.info('💡 Tip: To enable live emails, add SENDGRID_API_KEY or EMAIL_BRIDGE_URL to Render.');
        } else {
            logger.info('✅ SMTP Status: Ready (Local Environment)');
        }
    });
} else if (config.emailBridgeUrl) {
    logger.info('🚀 Email Status: Bridge Mode Active (HTTP Bypass)');
} else {
    logger.info('🚀 Email Status: SendGrid API Mode Active (Firewall Bypass)');
}

// Constants for branding
const LOGO_CID = 'jv-logo';
const LOGO_PATH = path.join(__dirname, '../../assets/logo.webp');

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
 * Generic send function that chooses between SMTP, SendGrid API, or Google Bridge
 */
const sendMail = async (mailOptions) => {
    // 1. Try Email Bridge (HTTP - Bypasses Firewall) - 100% Free
    if (config.emailBridgeUrl) {
        try {
            logger.info(`Using Email Bridge for ${mailOptions.to}...`);
            const response = await fetch(config.emailBridgeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: mailOptions.to,
                    subject: mailOptions.subject,
                    html: mailOptions.html
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                logger.info(`✅ Bridge success for ${mailOptions.to}`);
                return { messageId: 'bridge-success' };
            } else {
                throw new Error(result.message || 'Bridge response failed');
            }
        } catch (error) {
            logger.error(`❌ Bridge failed: ${error.message}. Falling back...`);
        }
    }

    // 2. Try SendGrid API
    if (config.sendgridApiKey) {
        try {
            logger.info(`Attempting SendGrid API for ${mailOptions.to}...`);
            const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.sendgridApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    personalizations: [{
                        to: [{ email: mailOptions.to }]
                    }],
                    from: { email: config.emailUser, name: 'JV Overseas' },
                    subject: mailOptions.subject,
                    content: [{
                        type: 'text/html',
                        value: mailOptions.html
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`SendGrid API Error: ${JSON.stringify(errorData)}`);
            }

            logger.info(`✅ SendGrid API Success: ${mailOptions.to}`);
            return { messageId: 'sendgrid-api' };
        } catch (error) {
            logger.error(`❌ SendGrid API failed: ${error.message}`);
            logger.info('Falling back to SMTP...');
            return transporter.sendMail(mailOptions);
        }
    } else {
        // 3. Fallback to standard SMTP (Works locally, fails on Render Free)
        return transporter.sendMail(mailOptions);
    }
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
        // Completely detached background task to prevent any response lag
        setImmediate(() => {
            sendMail(mailOptions).catch(err => logger.error(`Background Email Fail: ${err.message}`));
        });
    } catch (error) {
        logger.error(`❌ Eligibility email logic error: ${error.message}`);
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
        // Completely detached background task to prevent any response lag
        setImmediate(() => {
            sendMail(mailOptions).catch(err => logger.error(`Background Email Fail: ${err.message}`));
        });
    } catch (error) {
        logger.error(`❌ Enquiry email logic error: ${error.message}`);
    }
};

module.exports = {
    sendEligibilityConfirmation,
    sendProfessionalEnquiryConfirmation,
    sendEnquiryConfirmation: (email, name, details) => sendProfessionalEnquiryConfirmation(email, name, 'General', details),
    sendUniversityEnquiryConfirmation: (email, name, uni) => sendProfessionalEnquiryConfirmation(email, name, 'University', { university: uni }),
    sendEmail: async (to, subject, html) => sendMail({ to, subject, html })
};

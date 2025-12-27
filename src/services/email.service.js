const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Validate email configuration on startup
if (!config.emailUser || !config.emailPass) {
    logger.error('❌ CRITICAL: EMAIL_USER or EMAIL_PASS not configured!');
    logger.error('Environment Check:');
    logger.error(`  EMAIL_USER: ${config.emailUser ? '✓ Set' : '✗ MISSING'}`);
    logger.error(`  EMAIL_PASS: ${config.emailPass ? '✓ Set (length: ' + config.emailPass.length + ')' : '✗ MISSING'}`);
    logger.error('Please set these environment variables in Render dashboard.');
}

// Create transporter using Port 465 (Secure) as per Render requirements
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL/TLS
    auth: {
        user: config.emailUser,
        pass: config.emailPass, // Must be 16-character App Password
    },
    connectionTimeout: 10000, // 10s timeout
    greetingTimeout: 5000,
    socketTimeout: 15000,
    logger: false, // Disable nodemailer's internal logging to avoid clutter
    debug: false,
});

// Verify connection on startup with detailed diagnostics
logger.info('🔍 Initializing Email Service...');
logger.info(`   Using: ${config.emailUser || 'NOT CONFIGURED'}`);
logger.info(`   Environment: ${config.nodeEnv || 'unknown'}`);

transporter.verify((error) => {
    if (error) {
        logger.error('❌ SMTP CONNECTION FAILED');
        logger.error(`   Error Code: ${error.code || 'UNKNOWN'}`);
        logger.error(`   Error Message: ${error.message}`);

        // Provide specific troubleshooting based on error type
        if (error.code === 'EAUTH' || error.message.includes('Username and Password not accepted')) {
            logger.error('   ⚠️  AUTHENTICATION FAILED - Possible causes:');
            logger.error('      1. EMAIL_PASS is not a Gmail App Password (must be 16 characters)');
            logger.error('      2. Environment variables not set in Render dashboard');
            logger.error('      3. App Password was revoked or expired');
            logger.error('   📝 Fix: Generate new App Password at https://myaccount.google.com/apppasswords');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
            logger.error('   ⚠️  CONNECTION TIMEOUT - Possible causes:');
            logger.error('      1. Render firewall blocking port 465');
            logger.error('      2. Gmail blocking Render IP addresses');
            logger.error('      3. Network connectivity issues');
            logger.error('   📝 Consider using SendGrid or other SMTP service for production');
        } else if (error.code === 'EDNS') {
            logger.error('   ⚠️  DNS RESOLUTION FAILED');
            logger.error('      Cannot resolve smtp.gmail.com');
        }

        logger.error('   ⚠️  EMAILS WILL NOT BE SENT UNTIL THIS IS FIXED!');
    } else {
        logger.info('✅ SMTP Status: Connected and Ready');
        logger.info(`   Sending from: ${config.emailUser}`);
    }
});

const LOGO_CID = 'jv-logo';
const LOGO_PATH = path.join(__dirname, '../../assets/logo.webp');

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
 * Synchronous send function (waited for in controller)
 */
const sendMail = async (mailOptions) => {
    logger.info(`Sending email to ${mailOptions.to}...`);
    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`✅ Email delivered: ID=${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(`❌ Email delivery failed: ${error.message}`);
        throw error; // Rethrow to be caught by the controller's try-catch
    }
};

const sendEligibilityConfirmation = async (userEmail, userName, isEligible, estimatedRange) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
            <div style="text-align: center;">
                <img src="cid:${LOGO_CID}" alt="JV Overseas" style="max-height: 60px;">
            </div>
            <h2>Hello ${userName},</h2>
            <p>Your loan eligibility check is complete.</p>
            <div style="background: #f0f7ff; padding: 15px; border-radius: 8px;">
                ${isEligible ? `<b>✓ Eligible:</b> ${estimatedRange}` : `We need more details to confirm.`}
            </div>
            <p>Team JV Overseas</p>
        </div>
    `;
    const mailOptions = getBaseMailOptions(userEmail, 'Loan Eligibility Check', html);
    return sendMail(mailOptions);
};

const sendProfessionalEnquiryConfirmation = async (userEmail, userName, enquiryType, details = {}) => {
    let detailsList = '';
    for (const [key, value] of Object.entries(details)) {
        if (value) detailsList += `<p><b>${key}:</b> ${value}</p>`;
    }

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
            <h3>Enquiry Title: ${enquiryType}</h3>
            <p>Dear ${userName}, we have received your request.</p>
            ${detailsList}
            <p>Regards,<br>JV Overseas</p>
        </div>
    `;
    const mailOptions = getBaseMailOptions(userEmail, `Enquiry Received`, html);
    return sendMail(mailOptions);
};

module.exports = {
    sendEligibilityConfirmation,
    sendProfessionalEnquiryConfirmation,
    sendEmail: async (to, subject, html) => {
        const mailOptions = { from: config.emailUser, to, subject, html };
        return sendMail(mailOptions);
    }
};

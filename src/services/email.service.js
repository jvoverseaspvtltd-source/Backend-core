const nodemailer = require('nodemailer');
const SibApiV3Sdk = require('@sendinblue/client');
const config = require('../config/env');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

logger.info('🔍 Initializing Email Service...');
logger.info(`   Provider: ${config.emailProvider}`);
logger.info(`   Environment: ${config.nodeEnv}`);

if (!config.brevoApiKey) {
    logger.error('❌ CRITICAL: BREVO_API_KEY not configured!');
    logger.error('   Please set BREVO_API_KEY in environment variables');
    logger.error('   Get your API key from: https://app.brevo.com/settings/keys/api');
}

if (config.emailProvider === 'brevo-smtp' && (!config.brevoSmtpUser || !config.brevoSmtpPass)) {
    logger.warn('⚠️  SMTP mode selected but credentials missing!');
    logger.warn('   BREVO_SMTP_USER: ' + (config.brevoSmtpUser ? '✓' : '✗ MISSING'));
    logger.warn('   BREVO_SMTP_PASS: ' + (config.brevoSmtpPass ? '✗ MISSING' : '✓'));
    logger.warn('   Falling back to API mode...');
}

// ============================================================================
// BREVO SMTP TRANSPORT (using Nodemailer)
// ============================================================================

let smtpTransporter = null;

if (config.emailProvider === 'brevo-smtp' && config.brevoSmtpUser && config.brevoSmtpPass) {
    smtpTransporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
            user: config.brevoSmtpUser,
            pass: config.brevoSmtpPass,
        },
        connectionTimeout: 10000, // 10s timeout
        greetingTimeout: 5000,
        socketTimeout: 15000,
        logger: false,
        debug: false,
    });

    // Verify SMTP connection
    smtpTransporter.verify((error) => {
        if (error) {
            logger.error('❌ Brevo SMTP Connection Failed');
            logger.error(`   Error: ${error.message}`);
            logger.error('   Falling back to API mode for email delivery');
        } else {
            logger.info('✅ Brevo SMTP: Connected and Ready');
            logger.info(`   Sending from: ${config.emailFromAddress}`);
        }
    });
}

// ============================================================================
// BREVO API TRANSPORT (using Sendinblue SDK)
// ============================================================================

let apiClient = null;

if (config.emailProvider === 'brevo-api' || !smtpTransporter) {
    apiClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = apiClient.authentications['api-key'];
    apiKey.apiKey = config.brevoApiKey;

    logger.info('✅ Brevo API: Initialized');
    logger.info(`   Sending from: ${config.emailFromAddress}`);
}

// ============================================================================
// LOGO ATTACHMENT CONFIGURATION
// ============================================================================

const LOGO_CID = 'jv-logo';
const LOGO_PATH = path.join(__dirname, '../../assets/logo.webp');
const logoExists = fs.existsSync(LOGO_PATH);

if (!logoExists) {
    logger.warn('⚠️  Logo file not found at: ' + LOGO_PATH);
    logger.warn('   Emails will be sent without logo');
}

// ============================================================================
// EMAIL SENDING FUNCTIONS
// ============================================================================

/**
 * Send email via Brevo SMTP (Nodemailer)
 */
const sendViaSMTP = async (to, subject, htmlContent) => {
    if (!smtpTransporter) {
        throw new Error('SMTP transport not initialized');
    }

    const mailOptions = {
        from: `"${config.emailFromName}" <${config.emailFromAddress}>`,
        to,
        subject,
        html: htmlContent,
    };

    // Attach logo if exists
    if (logoExists) {
        mailOptions.attachments = [{
            filename: 'logo.webp',
            path: LOGO_PATH,
            cid: LOGO_CID
        }];
    }

    logger.info(`📧 [SMTP] Sending email to ${to}...`);
    const info = await smtpTransporter.sendMail(mailOptions);
    logger.info(`✅ [SMTP] Email sent: ID=${info.messageId}`);
    return info;
};

/**
 * Send email via Brevo API
 */
const sendViaAPI = async (to, subject, htmlContent) => {
    if (!apiClient) {
        throw new Error('API client not initialized');
    }

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
        name: config.emailFromName,
        email: config.emailFromAddress
    };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    logger.info(`📧 [API] Sending email to ${to}...`);
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info(`✅ [API] Email sent: ID=${response.messageId}`);
    return response;
};

/**
 * Main send function with automatic fallback
 */
const sendMail = async (to, subject, htmlContent) => {
    try {
        // Try primary method based on EMAIL_PROVIDER
        if (config.emailProvider === 'brevo-smtp' && smtpTransporter) {
            return await sendViaSMTP(to, subject, htmlContent);
        } else {
            return await sendViaAPI(to, subject, htmlContent);
        }
    } catch (primaryError) {
        logger.warn(`⚠️  Primary method failed: ${primaryError.message}`);

        // Automatic fallback
        try {
            if (config.emailProvider === 'brevo-smtp' && apiClient) {
                logger.info('🔄 Falling back to API mode...');
                return await sendViaAPI(to, subject, htmlContent);
            } else if (config.emailProvider === 'brevo-api' && smtpTransporter) {
                logger.info('🔄 Falling back to SMTP mode...');
                return await sendViaSMTP(to, subject, htmlContent);
            }
        } catch (fallbackError) {
            logger.error(`❌ Fallback also failed: ${fallbackError.message}`);
            throw fallbackError;
        }

        // If no fallback available, throw original error
        throw primaryError;
    }
};

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Send eligibility confirmation email
 */
const sendEligibilityConfirmation = async (userEmail, userName, isEligible, estimatedRange) => {
    const logoTag = logoExists ? `<img src="cid:${LOGO_CID}" alt="JV Overseas" style="max-height: 60px;">` : '<h2>JV Overseas</h2>';

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
            <div style="text-align: center;">
                ${logoTag}
            </div>
            <h2>Hello ${userName},</h2>
            <p>Your loan eligibility check is complete.</p>
            <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                ${isEligible ? `<b style="color: #28a745;">✓ Eligible:</b> ${estimatedRange}` : `<b>We need more details to confirm your eligibility.</b>`}
            </div>
            <p>Our loan advisors will contact you shortly to discuss the next steps.</p>
            <p style="margin-top: 30px;">Best regards,<br><b>Team JV Overseas</b></p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666; text-align: center;">
                JV Overseas Pvt. Ltd. | Medara Bazar, Chilakaluripet, AP<br>
                📞 +91 8712275590 | ✉️ jvoverseaspvtltd@gmail.com
            </p>
        </div>
    `;

    return sendMail(userEmail, 'Loan Eligibility Check - JV Overseas', html);
};

/**
 * Send professional enquiry confirmation email
 */
const sendProfessionalEnquiryConfirmation = async (userEmail, userName, enquiryType, details = {}) => {
    const logoTag = logoExists ? `<img src="cid:${LOGO_CID}" alt="JV Overseas" style="max-height: 60px;">` : '<h2>JV Overseas</h2>';

    let detailsList = '';
    for (const [key, value] of Object.entries(details)) {
        if (value) {
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            detailsList += `<p style="margin: 5px 0;"><b>${formattedKey}:</b> ${value}</p>`;
        }
    }

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                ${logoTag}
            </div>
            <h2 style="color: #2c3e50;">Enquiry Received Successfully!</h2>
            <p>Dear <b>${userName}</b>,</p>
            <p>Thank you for reaching out to JV Overseas. We have received your enquiry regarding <b>${enquiryType}</b>.</p>
            
            ${detailsList ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #495057;">Your Enquiry Details:</h3>
                    ${detailsList}
                </div>
            ` : ''}
            
            <p>Our expert counselors will review your profile and contact you within <b>24 hours</b> to discuss the best options for your study abroad journey.</p>
            
            <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066cc;">
                <p style="margin: 0;"><b>What's Next?</b></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Profile evaluation by our experts</li>
                    <li>Personalized university recommendations</li>
                    <li>Guidance on application process</li>
                    <li>Scholarship and loan assistance</li>
                </ul>
            </div>
            
            <p>If you have any urgent questions, feel free to call us at <b>+91 8712275590</b>.</p>
            
            <p style="margin-top: 30px;">Warm regards,<br><b>Team JV Overseas</b><br><i>Your Study Abroad Partner</i></p>
            
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666; text-align: center;">
                JV Overseas Pvt. Ltd. | Medara Bazar, Chilakaluripet, AP<br>
                📞 +91 8712275590 | ✉️ jvoverseaspvtltd@gmail.com<br>
                🌐 <a href="https://jvoverseas.com" style="color: #0066cc;">www.jvoverseas.com</a>
            </p>
        </div>
    `;

    return sendMail(userEmail, `Enquiry Confirmation - ${enquiryType}`, html);
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    sendEligibilityConfirmation,
    sendProfessionalEnquiryConfirmation,
    sendEmail: async (to, subject, html) => {
        return sendMail(to, subject, html);
    }
};

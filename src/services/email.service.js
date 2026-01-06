const nodemailer = require('nodemailer');
const SibApiV3Sdk = require('@sendinblue/client');
const config = require('../config/env');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

// ============================================================================
// EMAIL TRANSPORTERS
// ============================================================================

let transporter = null;
let providerMode = 'none';

/**
 * Initialize the selected email transporter
 */
const initTransporter = () => {
    const provider = config.emailProvider;
    logger.info(`📧 Initializing Email Provider: ${provider}`);

    if (provider === 'gmail') {
        if (!config.gmailUser || !config.gmailPass) {
            logger.warn('⚠️  Gmail credentials missing! Falling back to Brevo API if configured.');
            return;
        }
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: config.gmailUser,
                pass: config.gmailPass
            }
        });
        providerMode = 'gmail';
    } else if (provider === 'brevo-smtp') {
        if (!config.brevoSmtpUser || !config.brevoSmtpPass) {
            logger.warn('⚠️  Brevo SMTP credentials missing!');
            return;
        }
        transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: {
                user: config.brevoSmtpUser,
                pass: config.brevoSmtpPass
            }
        });
        providerMode = 'brevo-smtp';
    }

    if (transporter) {
        transporter.verify((error) => {
            if (error) {
                logger.error(`❌ ${provider} Connection Failed: ${error.message}`);
                transporter = null;
                providerMode = 'none';
            } else {
                logger.info(`✅ ${provider} Connected and Ready`);
            }
        });
    }
};

initTransporter();

// ============================================================================
// BREVO API TRANSPORT (using Sendinblue SDK)
// ============================================================================

/**
 * Helper to get a configured Brevo API instance
 */
const getBrevoApiInstance = () => {
    if (!config.brevoApiKey) {
        throw new Error('BREVO_API_KEY is not configured');
    }

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    // Setting API key directly on the instance (safer than global ApiClient)
    // Usage: apiInstance.setApiKey(KeyName, KeyValue)
    // In @sendinblue/client v3+, it uses these constants
    try {
        const apiKey = config.brevoApiKey;
        apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    } catch (err) {
        // Fallback if the constants are different in this version
        apiInstance.authentications['api-key'].apiKey = config.brevoApiKey;
    }

    return apiInstance;
};

// Log readiness on startup
if (config.brevoApiKey) {
    logger.info('✅ Brevo API: Ready (Fallback/Primary)');
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
    const apiInstance = getBrevoApiInstance();

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
    const isSmtpPreferred = config.emailProvider === 'brevo-smtp';

    try {
        // Try primary method based on EMAIL_PROVIDER
        // Only use SMTP if it's preferred AND confirmed available
        if (isSmtpPreferred && smtpTransporter && isSmtpAvailable) {
            try {
                return await sendViaSMTP(to, subject, htmlContent);
            } catch (smtpErr) {
                logger.warn(`⚠️  SMTP Send failed: ${smtpErr.message}. Trying API fallback...`);
                return await sendViaAPI(to, subject, htmlContent);
            }
        } else {
            // Use API if it's preferred OR if SMTP is unavailable or not yet verified
            if (isSmtpPreferred && (!isSmtpAvailable || !smtpTransporter)) {
                logger.info('ℹ️  SMTP is unavailable or unverified, using API mode directly');
            }
            return await sendViaAPI(to, subject, htmlContent);
        }
    } catch (primaryError) {
        logger.error(`❌ All email delivery methods failed: ${primaryError.message}`);
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

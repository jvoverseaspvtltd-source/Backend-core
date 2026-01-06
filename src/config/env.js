const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET'
];

// Check for missing env vars
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  console.warn(`WARNING: Missing environment variables: ${missingVars.join(', ')}. Ensure they are set in .env`);
}

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv,

  // Email Configuration
  emailProvider: process.env.EMAIL_PROVIDER || 'gmail', // 'gmail', 'brevo-smtp', or 'brevo-api'

  // Gmail SMTP
  gmailUser: process.env.EMAIL_USER?.trim(),
  gmailPass: process.env.EMAIL_PASS?.trim(),

  // Brevo Email Configuration
  brevoApiKey: process.env.BREVO_API_KEY?.trim(),
  brevoSmtpUser: process.env.BREVO_SMTP_USER?.trim(),
  brevoSmtpPass: process.env.BREVO_SMTP_PASS?.trim(),
  emailFromName: process.env.EMAIL_FROM_NAME || 'JV Overseas',
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS?.trim() || 'jvoverseaspvtltd@gmail.com',

  allowedOrigins: nodeEnv === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
    : (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
      : ['https://www.jvoverseas.com', 'https://jvoverseas.com']),
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASS
  },
  crmUrl: process.env.CRM_URL || '#',
  lmsUrl: process.env.LMS_URL || '#',
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  emailBridgeUrl: process.env.EMAIL_BRIDGE_URL
};

const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'EMAIL_USER',
  'EMAIL_PASS'
];

// Check for missing env vars
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  console.warn(`WARNING: Missing environment variables: ${missingVars.join(', ')}. Ensure they are set in .env`);
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv,
  emailService: process.env.EMAIL_SERVICE || 'gmail',
  emailUser: process.env.EMAIL_USER?.trim(),
  emailPass: process.env.EMAIL_PASS?.trim(),
  allowedOrigins: nodeEnv === 'development' ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'] : allowedOrigins,
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASS
  },
  crmUrl: process.env.CRM_URL || '#',
  lmsUrl: process.env.LMS_URL || '#',
  sendgridApiKey: process.env.SENDGRID_API_KEY
};

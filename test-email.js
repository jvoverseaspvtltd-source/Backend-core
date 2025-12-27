const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('=== EMAIL CONFIGURATION TEST ===\n');

// Check if environment variables are set
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✓ Set' : '✗ NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✓ Set (length: ' + process.env.EMAIL_PASS.length + ')' : '✗ NOT SET');
console.log('');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ ERROR: EMAIL_USER or EMAIL_PASS not configured in .env file');
    console.log('\nTo fix this:');
    console.log('1. Go to your Google Account: https://myaccount.google.com/');
    console.log('2. Enable 2-Step Verification');
    console.log('3. Generate an App Password: https://myaccount.google.com/apppasswords');
    console.log('4. Add to .env file:');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_PASS=your-16-character-app-password');
    process.exit(1);
}

// Create transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER.trim(),
        pass: process.env.EMAIL_PASS.trim(),
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
});

console.log('Testing SMTP connection...\n');

// Verify connection
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP CONNECTION FAILED\n');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.log('\n=== TROUBLESHOOTING ===');

        if (error.code === 'EAUTH' || error.message.includes('Username and Password not accepted')) {
            console.log('Authentication failed. This usually means:');
            console.log('1. You are using your regular Gmail password instead of an App Password');
            console.log('2. The App Password is incorrect or expired');
            console.log('3. 2-Step Verification is not enabled on your Google Account');
            console.log('\nSOLUTION:');
            console.log('1. Enable 2-Step Verification: https://myaccount.google.com/security');
            console.log('2. Generate App Password: https://myaccount.google.com/apppasswords');
            console.log('3. Update EMAIL_PASS in .env with the 16-character app password');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
            console.log('Connection timeout. This could mean:');
            console.log('1. Firewall blocking port 465');
            console.log('2. Network connectivity issues');
            console.log('3. Gmail SMTP is temporarily unavailable');
        }

        process.exit(1);
    } else {
        console.log('✅ SMTP CONNECTION SUCCESSFUL!\n');
        console.log('Email service is properly configured and ready to send emails.');
        console.log('\nYou can now send emails from:', process.env.EMAIL_USER);
        process.exit(0);
    }
});

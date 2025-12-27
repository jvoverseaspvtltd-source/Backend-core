const emailService = require('./src/services/email.service');
const logger = require('./src/utils/logger');

async function testFallback() {
    console.log('--- Testing Brevo Fallback Logic ---');

    // We expect SMTP to either work or fail gracefully depending on environment
    // But we want to ensure sendMail doesn't crash
    try {
        console.log('Attemping to send a test mail...');
        // Note: This might actually try to send if ENV is correct, 
        // but we're mostly checking if the initialization and fallback logic are crash-free.
        const result = await emailService.sendEmail('test@example.com', 'Test Subject', '<h1>Test</h1>');
        console.log('Send result:', result ? 'Success' : 'Failed');
    } catch (err) {
        console.error('Test caught error (expected if no API key):', err.message);
    }
}

testFallback();

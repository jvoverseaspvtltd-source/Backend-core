const emailService = require('../src/services/email.service');
const logger = require('../src/utils/logger');

async function testEmail() {
    const testEmail = 'jvoverseaspvtltd@gmail.com'; // Testing to own email
    const testName = 'Test User';

    console.log('--- Starting Email Test ---');
    logger.info('Starting manual email test...');

    try {
        console.log('1. Testing Professional Enquiry Email...');
        await emailService.sendProfessionalEnquiryConfirmation(
            testEmail,
            testName,
            'Test Service',
            { university: 'Cambridge', course: 'CS' }
        );
        console.log('✅ Professional Enquiry Email call finished.');

        console.log('\n2. Testing Eligibility Confirmation Email...');
        await emailService.sendEligibilityConfirmation(
            testEmail,
            testName,
            true,
            '₹30 Lakhs – ₹50 Lakhs'
        );
        console.log('✅ Eligibility Confirmation Email call finished.');

        console.log('\n--- Test Completed. Check logs/console for details. ---');
    } catch (err) {
        console.error('CRITICAL TEST FAILURE:', err);
    }
}

testEmail();

// Test email configuration
require('dotenv').config();
const { sendVerificationEmail } = require('./src/services/email.service');

async function testEmail() {
    console.log('Testing SMTP configuration...\n');

    console.log('SMTP Settings:');
    console.log('- Host:', process.env.SMTP_HOST || 'NOT SET');
    console.log('- Port:', process.env.SMTP_PORT || 'NOT SET');
    console.log('- User:', process.env.SMTP_USER || 'NOT SET');
    console.log('- Pass:', process.env.SMTP_PASS ? '***configured***' : 'NOT SET');
    console.log('- From:', process.env.SMTP_FROM || 'NOT SET');
    console.log();

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('❌ SMTP credentials not configured!');
        console.log('\nPlease add the following to your .env file:');
        console.log('SMTP_HOST=smtp.gmail.com');
        console.log('SMTP_PORT=587');
        console.log('SMTP_USER=your-email@gmail.com');
        console.log('SMTP_PASS=your-app-password');
        console.log('SMTP_FROM=your-email@gmail.com');
        process.exit(1);
    }

    try {
        console.log('Sending test email...');
        await sendVerificationEmail(
            process.env.SMTP_USER,
            'test-token-123',
            'Test User'
        );
        console.log('\n✅ Test email sent successfully!');
        console.log(`Check the inbox of ${process.env.SMTP_USER}`);
    } catch (error) {
        console.error('\n❌ Failed to send test email:');
        console.error(error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure you are using a Gmail App Password, not your regular password');
        console.log('2. Enable 2-Step Verification in your Google Account');
        console.log('3. Create an App Password at: https://myaccount.google.com/apppasswords');
        console.log('4. Check your firewall settings');
    }

    process.exit(0);
}

testEmail();

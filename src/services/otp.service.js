const crypto = require('crypto');

const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[crypto.randomInt(0, 10)];
    }
    return otp;
};

// Expiry time is handled by the data model date comparison, 
// so this service mainly focuses on generation.
// Validation logic usually sits in controller to check both match and time.

module.exports = {
    generateOTP,
};

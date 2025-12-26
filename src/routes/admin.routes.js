const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const adminController = require('../controllers/admin.controller');
const { check } = require('express-validator');

// Validation for login
const loginValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
];

const otpValidation = [
    check('email', 'Please include a valid email').isEmail(),
    check('otp', 'OTP is required').isLength({ min: 4 })
];

// Routes
router.post('/login', loginValidation, adminController.login);
router.post('/verify-otp', otpValidation, adminController.verifyOtp);

// Protected Admin Routes
router.get('/leads', [auth, isAdmin], adminController.getLeads);

module.exports = router;

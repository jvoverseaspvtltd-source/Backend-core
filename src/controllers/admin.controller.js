const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Lead = require('../models/Lead');
const otpService = require('../services/otp.service');
const emailService = require('../services/email.service');
const config = require('../config/env');
const logger = require('../utils/logger');

// @route   POST api/admin/login
// @desc    Authenticate admin & receive OTP
// @access  Public
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Generate OTP
        const otp = otpService.generateOTP();
        // Set expiry to 5 minutes from now
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send OTP via Email
        // In production, also integrate SMS here
        await emailService.sendEmail(
            user.email,
            'Your Admin Login OTP',
            `<p>Your OTP for admin login is: <b>${otp}</b></p><p>It expires in 5 minutes.</p>`
        );

        // For development convenience log it
        if (config.nodeEnv !== 'production') {
            logger.info(`DEV LOG: OTP for ${email} is ${otp}`);
        }

        res.json({ msg: 'OTP sent to registered email' });
    } catch (err) {
        logger.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @route   POST api/admin/verify-otp
// @desc    Verify OTP and return JWT
// @access  Public
exports.verifyOtp = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp } = req.body;

    try {
        let user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        if (!user.otp || !user.otpExpiry) {
            return res.status(400).json({ msg: 'No OTP request found. Please login again.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ msg: 'Invalid OTP' });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({ msg: 'OTP has expired' });
        }

        // OTP Valid - Clear it
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        // Return JWT
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            config.jwtSecret,
            { expiresIn: '12h' }, // 12 hour session
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );

    } catch (err) {
        logger.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @route   GET api/admin/leads
// @desc    Get all leads
// @access  Private (Admin)
exports.getLeads = async (req, res) => {
    try {
        const leads = await Lead.find().sort({ createdAt: -1 });
        res.json(leads);
    } catch (err) {
        logger.error(err.message);
        res.status(500).send('Server Error');
    }
};

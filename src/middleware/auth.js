const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');

module.exports = function (req, res, next) {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if not token
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded.user;
        next();
    } catch (err) {
        logger.error(`Token verification failed: ${err.message}`);
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

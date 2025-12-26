const User = require('../models/User');
const logger = require('../utils/logger');

module.exports = async function (req, res, next) {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(401).json({ msg: 'User not found' });
        }

        if (user.role !== 'SUPER_ADMIN') {
            logger.warn(`Access denied. User ${user.email} tried to access admin route.`);
            return res.status(403).json({ msg: 'Access denied. Admins only.' });
        }

        next();
    } catch (err) {
        logger.error(`Admin middleware error: ${err.message}`);
        res.status(500).send('Server Error');
    }
};

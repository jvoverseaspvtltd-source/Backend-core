const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        logger.info('MongoDB Connected...');
    } catch (err) {
        logger.error(`Error connecting to MongoDB: ${err.message}`);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;

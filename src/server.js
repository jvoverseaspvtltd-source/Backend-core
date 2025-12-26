const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');

const PORT = config.port;

app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
});
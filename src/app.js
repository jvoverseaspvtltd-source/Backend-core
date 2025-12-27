const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const connectDB = require('./config/db');

// Route files
const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const crmRoutes = require('./routes/crm.routes');
const lmsRoutes = require('./routes/lms.routes');

const app = express();

// Trust Render's proxy (1 layer for Render Load Balancer)
app.set('trust proxy', 1);

// Connect Database
connectDB();

// Enable CORS with options
const corsOptions = {
    origin: function (origin, callback) {
        // In development, allow all origins for easy testing across devices
        if (config.nodeEnv === 'development') {
            return callback(null, true);
        }

        // In production, check against allowed origins
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (config.allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for local dev to avoid CORS/loading issues
}));

// Body Parser
app.use(express.json({ extended: false }));

// Logging
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
}

// Rate Limiting (Basic)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

const auth = require('./middleware/auth');

// Mount Routes
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crm', auth, crmRoutes);
app.use('/api/lms', auth, lmsRoutes);

// Root Endpoint
app.get('/', (req, res) => {
    res.send('API Running...');
});

module.exports = app;

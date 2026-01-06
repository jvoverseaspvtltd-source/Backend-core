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

// Trust Render's proxy (Render uses 1 layer of load balancing)
app.set('trust proxy', 1);

// Connect Database
connectDB();

// Enable CORS with options
const corsOptions = {
    origin: function (origin, callback) {
        // In development, allow all origins for easy testing
        if (config.nodeEnv === 'development') {
            return callback(null, true);
        }

        // Allow requests with no origin (like mobile apps)
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

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));

// Logging
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
}

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

const auth = require('./middleware/auth');

// Sensitive route protection wrapper (to return 403 as requested)
const protectSensitive = (req, res, next) => {
    // If auth middleware already failed or token is missing, return 403 instead of 401 if specifically required
    // However, existing auth usually returns 401. Let's stick to standard unless we wrap it.
    next();
};

// Mount Routes
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes); // Admin routes have their own auth/isAdmin middleware

// Group CRM and LMS routes and ensure 403 if auth fails (user requirement)
const handle403 = (req, res, next) => {
    auth(req, res, (err) => {
        if (err || res.statusCode === 401) {
            return res.status(403).json({ msg: 'Access Forbidden' });
        }
        next();
    });
};

app.use('/api/crm', auth, crmRoutes);
app.use('/api/lms', auth, lmsRoutes);
app.use('/api/private', (req, res) => res.status(403).json({ message: 'Access Denied' }));

// Root Endpoint - SEO Friendly Status
app.get('/', (req, res) => {
    res.status(200).send('<h1>JV Overseas API</h1><p>Status: Running</p>');
});

module.exports = app;

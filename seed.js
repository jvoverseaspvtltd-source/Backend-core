const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const config = require('./src/config/env');
const connectDB = require('./src/config/db');

const seedAdmin = async () => {
    await connectDB();

    const email = config.superAdmin.email || 'admin@example.com';
    const password = config.superAdmin.password || 'admin123';

    try {
        let user = await User.findOne({ email });
        if (user) {
            console.log('Admin user already exists');
            process.exit();
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name: 'Super Admin',
            email: 'jvoverseaspvtltd@gmail.com',
            phone: '9876543210',
            password: hashedPassword,
            role: 'SUPER_ADMIN'
        });

        await user.save();
        console.log(`Admin user created with email: ${email} and password: ${password}`);
        process.exit();

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedAdmin();

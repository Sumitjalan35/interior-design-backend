require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const recreateAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Delete existing admin
    await User.deleteOne({ email: 'admin@interiordesign.com' });
    console.log('Deleted existing admin user');

    // Create new admin user (don't hash password manually - model will do it)
    const adminUser = new User({
      username: 'admin',
      email: 'admin@interiordesign.com',
      password: 'admin123', // Plain text - model will hash it
      role: 'superadmin',
      permissions: ['all'],
      isActive: true
    });

    await adminUser.save();
    console.log('✅ Superadmin user recreated successfully!');
    console.log('📧 Email: admin@interiordesign.com');
    console.log('🔑 Password: admin123');

    // Verify the password using the model's method
    const user = await User.findOne({ email: 'admin@interiordesign.com' }).select('+password');
    const isMatch = await user.comparePassword('admin123');
    console.log('Password verification:', isMatch);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

recreateAdmin(); 
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'admin@interiordesign.com' }).select('+password');
    if (user) {
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('Username:', user.username);
      console.log('Role:', user.role);
      console.log('Is Active:', user.isActive);
      console.log('Has Password:', !!user.password);
      
      // Test password
      const bcrypt = require('bcryptjs');
      const isMatch = await bcrypt.compare('admin123', user.password);
      console.log('Password match:', isMatch);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

checkUser(); 
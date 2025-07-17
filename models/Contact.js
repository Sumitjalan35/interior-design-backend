const mongoose = require('mongoose');
const crypto = require('crypto');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  service: {
    type: String,
    enum: ['residential', 'commercial', 'kitchen-bath', 'furniture', 'consultation', ''],
    default: ''
  },
  budget: {
    type: String,
    enum: ['under-10k', '10k-25k', '25k-50k', '50k-100k', 'over-100k', ''],
    default: ''
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'archived'],
    default: 'new'
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  isSpam: {
    type: Boolean,
    default: false
  },
  spamScore: {
    type: Number,
    default: 0
  },
  // Encrypted sensitive data
  encryptedData: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for better query performance
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });

// Virtual for service display name
contactSchema.virtual('serviceDisplay').get(function() {
  const serviceMap = {
    'residential': 'Residential Design',
    'commercial': 'Commercial Spaces',
    'kitchen-bath': 'Kitchen & Bath',
    'furniture': 'Furniture Selection',
    'consultation': 'Color Consultation'
  };
  return serviceMap[this.service] || this.service;
});

// Virtual for budget display name
contactSchema.virtual('budgetDisplay').get(function() {
  const budgetMap = {
    'under-10k': 'Under $10,000',
    '10k-25k': '$10,000 - $25,000',
    '25k-50k': '$25,000 - $50,000',
    '50k-100k': '$50,000 - $100,000',
    'over-100k': 'Over $100,000'
  };
  return budgetMap[this.budget] || this.budget;
});

// Method to encrypt sensitive data
contactSchema.methods.encryptSensitiveData = function() {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(JSON.stringify({
    name: this.name,
    email: this.email,
    phone: this.phone,
    message: this.message
  }), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  this.encryptedData = iv.toString('hex') + ':' + encrypted;
  
  // Clear sensitive fields after encryption
  this.name = '[ENCRYPTED]';
  this.email = '[ENCRYPTED]';
  this.phone = '[ENCRYPTED]';
  this.message = '[ENCRYPTED]';
};

// Method to decrypt sensitive data
contactSchema.methods.decryptSensitiveData = function() {
  if (!this.encryptedData) return null;
  
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    const parts = this.encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Pre-save middleware to encrypt data
contactSchema.pre('save', function(next) {
  if (this.isNew && !this.encryptedData) {
    this.encryptSensitiveData();
  }
  next();
});

module.exports = mongoose.model('Contact', contactSchema); 
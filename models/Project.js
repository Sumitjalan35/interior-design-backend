const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Project category is required'],
    enum: ['residential', 'commercial', 'kitchen-bath', 'furniture', 'consultation', 'renovation', 'new-construction']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  area: {
    type: Number, // in square feet
    min: [0, 'Area cannot be negative']
  },
  budget: {
    type: Number, // in dollars
    min: [0, 'Budget cannot be negative']
  },
  duration: {
    type: String, // e.g., "3 months", "6 weeks"
    trim: true
  },
  services: [{
    type: String,
    enum: ['interior-design', 'space-planning', 'color-consultation', 'furniture-selection', 'lighting-design', 'renovation', 'custom-furniture']
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  featured: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  client: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Client name cannot exceed 100 characters']
    },
    testimonial: {
      type: String,
      maxlength: [500, 'Testimonial cannot exceed 500 characters']
    }
  },
  beforeAfter: {
    beforeImages: [{
      url: String,
      alt: String
    }],
    afterImages: [{
      url: String,
      alt: String
    }]
  },
  specifications: {
    materials: [String],
    colors: [String],
    furniture: [String],
    lighting: [String]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
projectSchema.index({ category: 1, published: 1, featured: 1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ createdAt: -1 });

// Virtual for category display name
projectSchema.virtual('categoryDisplay').get(function() {
  const categoryMap = {
    'residential': 'Residential Design',
    'commercial': 'Commercial Spaces',
    'kitchen-bath': 'Kitchen & Bath',
    'furniture': 'Furniture Selection',
    'consultation': 'Color Consultation',
    'renovation': 'Renovation',
    'new-construction': 'New Construction'
  };
  return categoryMap[this.category] || this.category;
});

// Virtual for primary image
projectSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

// Virtual for formatted budget
projectSchema.virtual('formattedBudget').get(function() {
  if (!this.budget) return 'Not specified';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(this.budget);
});

// Virtual for formatted area
projectSchema.virtual('formattedArea').get(function() {
  if (!this.area) return 'Not specified';
  return `${this.area.toLocaleString()} sq ft`;
});

// Method to increment views
projectSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to toggle like
projectSchema.methods.toggleLike = function() {
  this.likes += 1;
  return this.save();
};

// Static method to get featured projects
projectSchema.statics.getFeatured = function(limit = 6) {
  return this.find({ 
    published: true, 
    featured: true 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'username');
};

// Static method to get projects by category
projectSchema.statics.getByCategory = function(category, limit = 12) {
  return this.find({ 
    published: true, 
    category: category 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'username');
};

module.exports = mongoose.model('Project', projectSchema); 
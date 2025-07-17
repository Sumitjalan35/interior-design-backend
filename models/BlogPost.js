const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  excerpt: {
    type: String,
    maxlength: [300, 'Excerpt cannot exceed 300 characters']
  },
  featuredImage: {
    url: String,
    alt: String
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['design-tips', 'trends', 'case-studies', 'news', 'inspiration']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  published: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date,
    default: null
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  // SEO fields
  metaTitle: {
    type: String,
    maxlength: [60, 'Meta title cannot exceed 60 characters']
  },
  metaDescription: {
    type: String,
    maxlength: [160, 'Meta description cannot exceed 160 characters']
  },
  metaKeywords: [String],
  ogImage: {
    url: String,
    alt: String
  },
  ogTitle: String,
  ogDescription: String,
  // Reading time estimation
  readingTime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance (removed duplicate slug index)
blogPostSchema.index({ category: 1, published: 1 });
blogPostSchema.index({ publishedAt: -1 });
blogPostSchema.index({ tags: 1 });

// Virtual for category display name
blogPostSchema.virtual('categoryDisplay').get(function() {
  const categoryMap = {
    'design-tips': 'Design Tips',
    'trends': 'Trends',
    'case-studies': 'Case Studies',
    'news': 'News',
    'inspiration': 'Inspiration'
  };
  return categoryMap[this.category] || this.category;
});

// Pre-save middleware to generate slug and reading time
blogPostSchema.pre('save', function(next) {
  // Generate slug from title if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Calculate reading time (average 200 words per minute)
  if (this.content) {
    const wordCount = this.content.split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }

  // Set publishedAt when publishing
  if (this.published && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  next();
});

// Method to increment views
blogPostSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to toggle like
blogPostSchema.methods.toggleLike = function() {
  this.likes += 1;
  return this.save();
};

// Static method to get published posts
blogPostSchema.statics.getPublished = function(limit = 10) {
  return this.find({ published: true })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'username');
};

// Static method to get posts by category
blogPostSchema.statics.getByCategory = function(category, limit = 10) {
  return this.find({ 
    published: true, 
    category: category 
  })
  .sort({ publishedAt: -1 })
  .limit(limit)
  .populate('author', 'username');
};

// Static method to search posts
blogPostSchema.statics.search = function(query, limit = 10) {
  return this.find({
    published: true,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  })
  .sort({ publishedAt: -1 })
  .limit(limit)
  .populate('author', 'username');
};

module.exports = mongoose.model('BlogPost', blogPostSchema); 
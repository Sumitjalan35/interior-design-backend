const mongoose = require('mongoose');

const seoSchema = new mongoose.Schema({
  page: {
    type: String,
    required: [true, 'Page identifier is required'],
    unique: true,
    enum: ['home', 'about', 'services', 'portfolio', 'contact', 'blog', 'global']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    maxlength: [60, 'Title cannot exceed 60 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [160, 'Description cannot exceed 160 characters']
  },
  keywords: [{
    type: String,
    trim: true
  }],
  // Open Graph
  ogTitle: {
    type: String,
    maxlength: [60, 'OG Title cannot exceed 60 characters']
  },
  ogDescription: {
    type: String,
    maxlength: [160, 'OG Description cannot exceed 160 characters']
  },
  ogImage: {
    url: String,
    alt: String,
    width: Number,
    height: Number
  },
  ogType: {
    type: String,
    default: 'website',
    enum: ['website', 'article', 'profile']
  },
  // Twitter Card
  twitterCard: {
    type: String,
    default: 'summary_large_image',
    enum: ['summary', 'summary_large_image', 'app', 'player']
  },
  twitterTitle: String,
  twitterDescription: String,
  twitterImage: {
    url: String,
    alt: String
  },
  // Additional meta tags
  canonical: String,
  robots: {
    type: String,
    default: 'index, follow',
    enum: ['index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow']
  },
  author: String,
  // Schema.org structured data
  structuredData: {
    type: String,
    default: null
  },
  // Custom meta tags
  customMeta: [{
    name: String,
    content: String
  }],
  // Analytics and tracking
  googleAnalytics: String,
  facebookPixel: String,
  // Sitemap settings
  sitemapPriority: {
    type: Number,
    default: 0.5,
    min: 0.0,
    max: 1.0
  },
  sitemapChangeFreq: {
    type: String,
    default: 'weekly',
    enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better performance (removed duplicate page index)

// Pre-save middleware to update lastModified
seoSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

// Static method to get SEO data by page
seoSchema.statics.getByPage = function(page) {
  return this.findOne({ page });
};

// Static method to get all SEO data
seoSchema.statics.getAll = function() {
  return this.find().sort({ page: 1 });
};

// Method to generate sitemap entry
seoSchema.methods.toSitemapEntry = function(baseUrl) {
  return {
    url: `${baseUrl}/${this.page === 'home' ? '' : this.page}`,
    lastmod: this.lastModified.toISOString(),
    changefreq: this.sitemapChangeFreq,
    priority: this.sitemapPriority
  };
};

module.exports = mongoose.model('SEO', seoSchema); 
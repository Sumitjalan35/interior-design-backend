const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, admin, checkPermission } = require('../middleware/auth');
const BlogPost = require('../models/BlogPost');

const router = express.Router();

// Configure multer for blog image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/blog');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// @desc    Get all published blog posts (public)
// @route   GET /api/blog
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category;
  const search = req.query.search;

  const query = { published: true };
  
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const posts = await BlogPost.find(query)
    .populate('author', 'username')
    .sort({ publishedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await BlogPost.countDocuments(query);

  res.json({
    success: true,
    data: posts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// @desc    Get blog posts by category (public)
// @route   GET /api/blog/category/:category
// @access  Public
router.get('/category/:category', asyncHandler(async (req, res) => {
  const { category } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const posts = await BlogPost.getByCategory(category, limit);

  res.json({
    success: true,
    data: posts
  });
}));

// @desc    Search blog posts (public)
// @route   GET /api/blog/search
// @access  Public
router.get('/search', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const limit = parseInt(req.query.limit) || 10;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  const posts = await BlogPost.search(q, limit);

  res.json({
    success: true,
    data: posts
  });
}));

// @desc    Get single blog post by slug (public)
// @route   GET /api/blog/:slug
// @access  Public
router.get('/:slug', asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ 
    slug: req.params.slug,
    published: true 
  }).populate('author', 'username');

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  // Increment views
  await post.incrementViews();

  res.json({
    success: true,
    data: post
  });
}));

// @desc    Create new blog post (admin only)
// @route   POST /api/blog
// @access  Private/Admin
router.post('/', protect, checkPermission('manage_blog'), upload.single('featuredImage'), asyncHandler(async (req, res) => {
  const {
    title,
    content,
    excerpt,
    category,
    tags,
    published,
    metaTitle,
    metaDescription,
    metaKeywords,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    canonical,
    robots,
    author,
    structuredData
  } = req.body;

  // Process uploaded image
  const featuredImage = req.file ? {
    url: `/uploads/blog/${req.file.filename}`,
    alt: req.body.featuredImageAlt || title
  } : null;

  const postData = {
    title,
    content,
    excerpt,
    category,
    tags: tags ? JSON.parse(tags) : [],
    published: published === 'true',
    featuredImage,
    metaTitle,
    metaDescription,
    metaKeywords: metaKeywords ? JSON.parse(metaKeywords) : [],
    ogTitle,
    ogDescription,
    ogImage: ogImage ? JSON.parse(ogImage) : null,
    twitterTitle,
    twitterDescription,
    twitterImage: twitterImage ? JSON.parse(twitterImage) : null,
    canonical,
    robots,
    author,
    structuredData,
    author: req.user.id
  };

  const post = await BlogPost.create(postData);

  res.status(201).json({
    success: true,
    message: 'Blog post created successfully',
    data: post
  });
}));

// @desc    Update blog post (admin only)
// @route   PUT /api/blog/:id
// @access  Private/Admin
router.put('/:id', protect, checkPermission('manage_blog'), upload.single('featuredImage'), asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  const {
    title,
    content,
    excerpt,
    category,
    tags,
    published,
    metaTitle,
    metaDescription,
    metaKeywords,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    canonical,
    robots,
    author,
    structuredData
  } = req.body;

  // Process uploaded image
  if (req.file) {
    // Delete old image if exists
    if (post.featuredImage?.url) {
      const oldImagePath = path.join(__dirname, '..', post.featuredImage.url);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    post.featuredImage = {
      url: `/uploads/blog/${req.file.filename}`,
      alt: req.body.featuredImageAlt || title
    };
  }

  // Update fields
  if (title) post.title = title;
  if (content) post.content = content;
  if (excerpt !== undefined) post.excerpt = excerpt;
  if (category) post.category = category;
  if (tags) post.tags = JSON.parse(tags);
  if (published !== undefined) post.published = published === 'true';
  if (metaTitle) post.metaTitle = metaTitle;
  if (metaDescription) post.metaDescription = metaDescription;
  if (metaKeywords) post.metaKeywords = JSON.parse(metaKeywords);
  if (ogTitle) post.ogTitle = ogTitle;
  if (ogDescription) post.ogDescription = ogDescription;
  if (ogImage) post.ogImage = JSON.parse(ogImage);
  if (twitterTitle) post.twitterTitle = twitterTitle;
  if (twitterDescription) post.twitterDescription = twitterDescription;
  if (twitterImage) post.twitterImage = JSON.parse(twitterImage);
  if (canonical) post.canonical = canonical;
  if (robots) post.robots = robots;
  if (author) post.author = author;
  if (structuredData) post.structuredData = structuredData;

  await post.save();

  res.json({
    success: true,
    message: 'Blog post updated successfully',
    data: post
  });
}));

// @desc    Delete blog post (admin only)
// @route   DELETE /api/blog/:id
// @access  Private/Admin
router.delete('/:id', protect, checkPermission('manage_blog'), asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  // Delete associated image
  if (post.featuredImage?.url) {
    const imagePath = path.join(__dirname, '..', post.featuredImage.url);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  await post.remove();

  res.json({
    success: true,
    message: 'Blog post deleted successfully'
  });
}));

// @desc    Like/unlike blog post (authenticated users)
// @route   POST /api/blog/:id/like
// @access  Private
router.post('/:id/like', protect, asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  await post.toggleLike();

  res.json({
    success: true,
    message: 'Blog post liked',
    data: { likes: post.likes }
  });
}));

// @desc    Get blog statistics (admin only)
// @route   GET /api/blog/stats/overview
// @access  Private/Admin
router.get('/stats/overview', protect, checkPermission('view_analytics'), asyncHandler(async (req, res) => {
  const total = await BlogPost.countDocuments();
  const published = await BlogPost.countDocuments({ published: true });
  const draft = total - published;
  const totalViews = await BlogPost.aggregate([
    { $group: { _id: null, totalViews: { $sum: '$views' } } }
  ]);
  const totalLikes = await BlogPost.aggregate([
    { $group: { _id: null, totalLikes: { $sum: '$likes' } } }
  ]);

  res.json({
    success: true,
    data: {
      total,
      published,
      draft,
      totalViews: totalViews[0]?.totalViews || 0,
      totalLikes: totalLikes[0]?.totalLikes || 0
    }
  });
}));

module.exports = router; 
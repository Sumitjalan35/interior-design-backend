const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, checkPermission } = require('../middleware/auth');
const SEO = require('../models/SEO');

const router = express.Router();

// @desc    Get SEO data by page (public)
// @route   GET /api/seo/:page
// @access  Public
router.get('/:page', asyncHandler(async (req, res) => {
  const { page } = req.params;
  const seoData = await SEO.getByPage(page);

  if (!seoData) {
    return res.status(404).json({
      success: false,
      message: 'SEO data not found for this page'
    });
  }

  res.json({
    success: true,
    data: seoData
  });
}));

// @desc    Get all SEO data (admin only)
// @route   GET /api/seo
// @access  Private/Admin
router.get('/', protect, checkPermission('manage_seo'), asyncHandler(async (req, res) => {
  const seoData = await SEO.getAll();

  res.json({
    success: true,
    data: seoData
  });
}));

// @desc    Create or update SEO data (admin only)
// @route   POST /api/seo
// @access  Private/Admin
router.post('/', protect, checkPermission('manage_seo'), asyncHandler(async (req, res) => {
  const {
    page,
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
    canonical,
    robots,
    author,
    structuredData,
    customMeta,
    googleAnalytics,
    facebookPixel,
    sitemapPriority,
    sitemapChangeFreq
  } = req.body;

  // Check if SEO data already exists for this page
  let seoData = await SEO.findOne({ page });

  if (seoData) {
    // Update existing SEO data
    if (title) seoData.title = title;
    if (description) seoData.description = description;
    if (keywords) seoData.keywords = keywords;
    if (ogTitle) seoData.ogTitle = ogTitle;
    if (ogDescription) seoData.ogDescription = ogDescription;
    if (ogImage) seoData.ogImage = ogImage;
    if (ogType) seoData.ogType = ogType;
    if (twitterCard) seoData.twitterCard = twitterCard;
    if (twitterTitle) seoData.twitterTitle = twitterTitle;
    if (twitterDescription) seoData.twitterDescription = twitterDescription;
    if (twitterImage) seoData.twitterImage = twitterImage;
    if (canonical) seoData.canonical = canonical;
    if (robots) seoData.robots = robots;
    if (author) seoData.author = author;
    if (structuredData) seoData.structuredData = structuredData;
    if (customMeta) seoData.customMeta = customMeta;
    if (googleAnalytics) seoData.googleAnalytics = googleAnalytics;
    if (facebookPixel) seoData.facebookPixel = facebookPixel;
    if (sitemapPriority) seoData.sitemapPriority = sitemapPriority;
    if (sitemapChangeFreq) seoData.sitemapChangeFreq = sitemapChangeFreq;

    await seoData.save();
  } else {
    // Create new SEO data
    seoData = await SEO.create({
      page,
      title,
      description,
      keywords,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      canonical,
      robots,
      author,
      structuredData,
      customMeta,
      googleAnalytics,
      facebookPixel,
      sitemapPriority,
      sitemapChangeFreq
    });
  }

  res.json({
    success: true,
    message: 'SEO data saved successfully',
    data: seoData
  });
}));

// @desc    Update SEO data (admin only)
// @route   PUT /api/seo/:page
// @access  Private/Admin
router.put('/:page', protect, checkPermission('manage_seo'), asyncHandler(async (req, res) => {
  const { page } = req.params;
  const seoData = await SEO.findOne({ page });

  if (!seoData) {
    return res.status(404).json({
      success: false,
      message: 'SEO data not found for this page'
    });
  }

  const {
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
    canonical,
    robots,
    author,
    structuredData,
    customMeta,
    googleAnalytics,
    facebookPixel,
    sitemapPriority,
    sitemapChangeFreq
  } = req.body;

  // Update fields
  if (title) seoData.title = title;
  if (description) seoData.description = description;
  if (keywords) seoData.keywords = keywords;
  if (ogTitle) seoData.ogTitle = ogTitle;
  if (ogDescription) seoData.ogDescription = ogDescription;
  if (ogImage) seoData.ogImage = ogImage;
  if (ogType) seoData.ogType = ogType;
  if (twitterCard) seoData.twitterCard = twitterCard;
  if (twitterTitle) seoData.twitterTitle = twitterTitle;
  if (twitterDescription) seoData.twitterDescription = twitterDescription;
  if (twitterImage) seoData.twitterImage = twitterImage;
  if (canonical) seoData.canonical = canonical;
  if (robots) seoData.robots = robots;
  if (author) seoData.author = author;
  if (structuredData) seoData.structuredData = structuredData;
  if (customMeta) seoData.customMeta = customMeta;
  if (googleAnalytics) seoData.googleAnalytics = googleAnalytics;
  if (facebookPixel) seoData.facebookPixel = facebookPixel;
  if (sitemapPriority) seoData.sitemapPriority = sitemapPriority;
  if (sitemapChangeFreq) seoData.sitemapChangeFreq = sitemapChangeFreq;

  await seoData.save();

  res.json({
    success: true,
    message: 'SEO data updated successfully',
    data: seoData
  });
}));

// @desc    Delete SEO data (admin only)
// @route   DELETE /api/seo/:page
// @access  Private/Admin
router.delete('/:page', protect, checkPermission('manage_seo'), asyncHandler(async (req, res) => {
  const { page } = req.params;
  const seoData = await SEO.findOne({ page });

  if (!seoData) {
    return res.status(404).json({
      success: false,
      message: 'SEO data not found for this page'
    });
  }

  await seoData.remove();

  res.json({
    success: true,
    message: 'SEO data deleted successfully'
  });
}));

// @desc    Generate sitemap XML (public)
// @route   GET /api/seo/sitemap.xml
// @access  Public
router.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const baseUrl = process.env.SITE_URL || 'http://localhost:5173';
  const seoData = await SEO.getAll();

  const sitemapEntries = seoData.map(seo => seo.toSitemapEntry(baseUrl));

  // Add dynamic routes (projects, blog posts, etc.)
  // This would need to be implemented based on your content structure

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
}));

// @desc    Generate robots.txt (public)
// @route   GET /api/seo/robots.txt
// @access  Public
router.get('/robots.txt', asyncHandler(async (req, res) => {
  const baseUrl = process.env.SITE_URL || 'http://localhost:5173';
  
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/api/seo/sitemap.xml

# Disallow admin areas
Disallow: /admin/
Disallow: /api/admin/

# Disallow uploads directory
Disallow: /uploads/`;

  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
}));

module.exports = router; 
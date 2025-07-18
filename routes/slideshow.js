const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const SLIDESHOW_PATH = path.join(__dirname, '../data/slideshow.json');

// Helper to read slideshow data
function readSlideshow() {
  try {
    return JSON.parse(fs.readFileSync(SLIDESHOW_PATH, 'utf8'));
  } catch {
    return [];
  }
}
// Helper to write slideshow data
function writeSlideshow(data) {
  fs.writeFileSync(SLIDESHOW_PATH, JSON.stringify(data, null, 2));
}

// GET /api/slideshow - list all images
router.get('/', (req, res) => {
  const data = readSlideshow();
  res.json(data);
});

// POST /api/slideshow - add new image
router.post('/', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: 'Image is required' });
  const data = readSlideshow();
  data.push(image);
  writeSlideshow(data);
  res.json({ success: true });
});

// DELETE /api/slideshow/:idx - remove image by index
router.delete('/:idx', (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const data = readSlideshow();
  if (isNaN(idx) || idx < 0 || idx >= data.length) {
    return res.status(404).json({ message: 'Not found' });
  }
  data.splice(idx, 1);
  writeSlideshow(data);
  res.json({ success: true });
});

module.exports = router; 
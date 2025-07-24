console.log('EMAIL CONFIG:', process.env.EMAIL_HOST, process.env.EMAIL_PORT, process.env.EMAIL_USER, process.env.EMAIL_PASS);
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const projectRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');
const blogRoutes = require('./routes/blog');
const seoRoutes = require('./routes/seo');
const notificationRoutes = require('./routes/notifications');
const publicRoutes = require('./routes/public');
const slideshowRoutes = require('./routes/slideshow');
const { errorHandler } = require('./middleware/errorHandler');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'BB',
  api_key: process.env.CLOUDINARY_API_KEY || '433893671529262',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'qth_FC6o6lyIgt0oNEa4oNsDEu8',
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'admin_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
  },
});
const upload = multer({ storage: storage });

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Update CORS configuration to allow credentials and set Access-Control-Allow-Origin dynamically
const allowedOrigins = [
  'https://beyondblueprint.co.in',
  'https://www.beyondblueprint.co.in',
  'https://admin.beyondblueprint.co.in',
  'https://api.beyondblueprint.co.in',
  'https://interior-design-frontend-xi.vercel.app'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parser middleware (for JSON and URL-encoded data)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath, stat) => {
    // Only set Access-Control-Allow-Origin for allowed origins
    const allowedOrigins = [
      'https://beyondblueprint.co.in',
      'https://www.beyondblueprint.co.in',
      'https://admin.beyondblueprint.co.in',
      'https://api.beyondblueprint.co.in',
      'https://interior-design-frontend-xi.vercel.app'
    ];
    const origin = res.req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    // Remove any Access-Control-Allow-Credentials header for static files
    res.removeHeader && res.removeHeader('Access-Control-Allow-Credentials');
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', publicRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/slideshow', slideshowRoutes);

// Cloudinary image upload endpoint
app.post('/api/admin/upload-cloudinary', upload.single('images'), (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Cloudinary URL is in req.file.path
  res.json({ url: req.file.path });
});

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Interior Design API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 

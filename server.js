import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.js';
import providersRoutes from './routes/providers.js';
import bookingsRoutes from './routes/bookings.js';
import touristsRoutes from './routes/tourists.js';
import reviewsRoutes from './routes/reviews.js';
import paymentsRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import productsRoutes from './routes/products.js';
import Contact from './models/Contact.js';
import { authenticateToken, isAdmin as adminMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'https://jeep-booking-frontend.vercel.app',
  'https://www.slecotour.com'
];

app.use(cors({
  origin: (origin, callback) => {
    console.log(`[${new Date().toISOString()}] CORS Origin: ${origin}`);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || '*');
    } else {
      console.error(`[${new Date().toISOString()}] CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Access-Control-Allow-Origin']
}));

// Explicitly handle OPTIONS requests
app.options('*', (req, res) => {
  console.log(`[${new Date().toISOString()}] Handling OPTIONS request for: ${req.url}`);
  const origin = req.get('Origin') && allowedOrigins.includes(req.get('Origin')) ? req.get('Origin') : '*';
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept',
    'Access-Control-Max-Age': '86400'
  });
  res.status(204).end();
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Server error:`, err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.raw({ type: 'application/json', limit: '10mb' }));
app.use('/Uploads', express.static(path.join(process.cwd(), 'Uploads')));

// MongoDB Connection with retry logic
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000
    });
    console.log(`[${new Date().toISOString()}] Connected to MongoDB`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] MongoDB connection error:`, err.message);
    console.log(`[${new Date().toISOString()}] Retrying connection in 5 seconds...`);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ status: 'ok', database: dbStatus });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Health check error:`, err.message);
    res.status(500).json({ status: 'error', error: 'Health check failed' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/tourists', touristsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productsRoutes);

app.get('/api/admin/contact-messages', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const messages = await Contact.find().lean();
    console.log(`[${new Date().toISOString()}] Fetched ${messages.length} contact messages for admin`);
    res.json(messages || []);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching contact messages:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch contact messages' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      console.error(`[${new Date().toISOString()}] Missing contact fields:`, { name, email, message });
      return res.status(400).json({ error: 'All fields are required' });
    }
    const contact = new Contact({ name, email, message });
    await contact.save();
    console.log(`[${new Date().toISOString()}] Contact message saved:`, { contactId: contact._id });
    res.status(201).json({ message: 'Contact message submitted' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error saving contact message:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to save contact message' });
  }
});

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// Fallback for debugging 404 errors
app.use((req, res) => {
  console.log(`[${new Date().toISOString()}] 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

export default app;
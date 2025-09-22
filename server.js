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
import { authenticateToken, isAdmin } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3000',
  'https://jeep-booking-frontend.vercel.app',
  'https://jeep-five.vercel.app'
];

// CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    console.log(`[${new Date().toISOString()}] CORS Origin: ${origin}`);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`[${new Date().toISOString()}] CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.raw({ type: 'application/json', limit: '10mb' }));
app.use('/Uploads', express.static(path.join(process.cwd(), 'Uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log(`[${new Date().toISOString()}] Connected to MongoDB`))
  .catch(err => {
    console.error(`[${new Date().toISOString()}] MongoDB connection error: ${err.message}`);
    process.exit(1); // Exit to prevent serving requests without DB
  });

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    mongodb: dbStatus,
    timestamp: new Date().toISOString()
  });
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

// Contact messages routes
app.get('/api/admin/contact-messages', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    const messages = await Contact.find().lean();
    console.log(`[${new Date().toISOString()}] Fetched ${messages.length} contact messages`);
    res.json(messages);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching contact messages: ${err.message}`);
    res.status(500).json({ error: 'Server error: Failed to fetch contact messages' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      console.error(`[${new Date().toISOString()}] Missing required fields for contact:`, req.body);
      return res.status(400).json({ error: 'All fields are required' });
    }
    const contact = new Contact({ name, email, message });
    await contact.save();
    console.log(`[${new Date().toISOString()}] Contact message saved: ${contact._id}`);
    res.status(201).json({ message: 'Contact message submitted' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error saving contact message: ${err.message}`);
    res.status(500).json({ error: 'Server error: Failed to save contact message' });
  }
});

// Favicon handling
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Server error on ${req.method} ${req.path}: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});

export default app;
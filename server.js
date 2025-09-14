import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import env from './config/env.js';
import authRoutes from './routes/auth.js';
import providersRoutes from './routes/providers.js';
import bookingsRoutes from './routes/bookings.js';
import touristsRoutes from './routes/tourists.js';
import reviewsRoutes from './routes/reviews.js';
import paymentsRoutes from './routes/payments.js';

dotenv.config(); // Load .env for redundancy

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://jeep-booking-frontend.vercel.app' : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: 'application/json', limit: '10mb' })); // For Stripe webhook
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // Serve uploads directory

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/tourists', touristsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/payments', paymentsRoutes);

// MongoDB Connection
mongoose.connect(env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
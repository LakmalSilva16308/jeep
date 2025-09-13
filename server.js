import './config/env.js'; // Load environment variables first
   import express from 'express';
   import cors from 'cors';
   import mongoose from 'mongoose';
   import authRoutes from './routes/auth.js';
   import providersRoutes from './routes/providers.js';
   import bookingsRoutes from './routes/bookings.js';
   import reviewsRoutes from './routes/reviews.js';
   import touristsRoutes from './routes/tourists.js';
   import paymentsRoutes from './routes/payments.js';

   const app = express();

   // Middleware
   app.use(cors());
   app.use(express.json());
   app.use('/uploads', express.static('uploads'));

   // Routes
   app.use('/api/auth', authRoutes);
   app.use('/api/providers', providersRoutes);
   app.use('/api/bookings', bookingsRoutes);
   app.use('/api/reviews', reviewsRoutes);
   app.use('/api/tourists', touristsRoutes);
   app.use('/api/payments', paymentsRoutes);

   // Error handling middleware
   app.use((err, req, res, next) => {
     console.error('Server error:', err.message, err.stack);
     res.status(500).json({ error: 'Internal server error' });
   });

   // Connect to MongoDB
   mongoose
     .connect(process.env.MONGODB_URI, {
       useNewUrlParser: true,
       useUnifiedTopology: true,
     })
     .then(() => console.log('MongoDB connected'))
     .catch((err) => console.error('MongoDB connection error:', err));

   // Start server
   const PORT = process.env.PORT || 5000;
   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

   

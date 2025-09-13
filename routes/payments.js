import express from 'express';
import stripe from 'stripe';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not defined in environment variables');
  throw new Error('STRIPE_SECRET_KEY is not defined');
}
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// Create payment intent (Stripe or PayHere)
router.post('/create-intent', authenticateToken, async (req, res) => {
  try {
    console.log('Creating payment intent for user:', { userId: req.user.id, role: req.user.role, payload: req.body });
    if (req.user.role !== 'tourist') {
      return res.status(403).json({ error: 'Access denied: Only tourists can create payments' });
    }

    const { bookingId, paymentMethod } = req.body; // 'stripe' or 'payhere'
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: 'Invalid Booking ID' });
    }

    const booking = await Booking.findById(bookingId).populate('providerId');
    if (!booking || booking.status !== 'pending' || booking.touristId.toString() !== req.user.id.toString()) {
      return res.status(400).json({ error: 'Invalid or unauthorized booking' });
    }

    if (paymentMethod === 'stripe') {
      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: Math.round(booking.totalPrice * 100), // Cents for USD
        currency: 'usd',
        metadata: {
          bookingId: booking._id.toString(),
          touristId: req.user.id.toString(),
          providerId: booking.providerId._id.toString()
        }
      });

      console.log('Stripe payment intent created:', { paymentIntentId: paymentIntent.id, amount: paymentIntent.amount });
      res.json({ clientSecret: paymentIntent.client_secret, method: 'stripe' });
    } else if (paymentMethod === 'payhere') {
      const orderId = booking._id.toString();
      const amount = booking.totalPrice.toFixed(2); // LKR
      const hash = crypto.createHash('md5')
        .update(process.env.PAYHERE_MERCHANT_ID + orderId + amount + process.env.PAYHERE_CURRENCY + process.env.PAYHERE_MERCHANT_SECRET)
        .digest('hex')
        .toUpperCase();

      const payHereData = {
        merchant_id: process.env.PAYHERE_MERCHANT_ID,
        return_url: 'http://localhost:3000/payment-success',
        cancel_url: 'http://localhost:3000/payment-cancel',
        notify_url: 'http://localhost:5000/api/payments/payhere-notification',
        order_id: orderId,
        items: booking.providerId.serviceName || 'Jeep Booking',
        currency: process.env.PAYHERE_CURRENCY || 'LKR',
        amount: amount,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone: '0771234567',
        address: 'Test Address',
        city: 'Colombo',
        country: 'Sri Lanka',
        hash: hash
      };

      console.log('PayHere payment data prepared:', { orderId, amount, currency: process.env.PAYHERE_CURRENCY });
      res.json({ payHereData, method: 'payhere' });
    } else {
      return res.status(400).json({ error: 'Invalid payment method' });
    }
  } catch (err) {
    console.error('Error creating payment intent:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to create payment' });
  }
});

// Stripe Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const bookingId = paymentIntent.metadata.bookingId;
    await Booking.findByIdAndUpdate(bookingId, { status: 'confirmed' });
    console.log('Stripe payment succeeded for booking:', bookingId);
  }

  res.json({ received: true });
});

// PayHere Notification Handler
router.post('/payhere-notification', express.json(), async (req, res) => {
  const { merchant_id, order_id, status_code, md5sig, amount, currency } = req.body;

  const generatedSig = crypto.createHash('md5')
    .update(merchant_id + order_id + amount + currency + status_code + process.env.PAYHERE_MERCHANT_SECRET)
    .digest('hex')
    .toUpperCase();

  if (generatedSig !== md5sig) {
    console.error('PayHere signature verification failed:', { order_id, md5sig, generatedSig });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (status_code === '2') { // 2 = Successful
    await Booking.findByIdAndUpdate(order_id, { status: 'confirmed' });
    console.log('PayHere payment succeeded for booking:', order_id);
  }

  res.status(200).send('OK');
});

export default router;
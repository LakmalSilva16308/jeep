import express from 'express';
import stripe from 'stripe';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import env from '../config/env.js';

const router = express.Router();

// It's a good practice to handle a missing secret key gracefully
const stripeInstance = stripe(env.STRIPE_SECRET_KEY || '');

router.post('/create-intent', authenticateToken, async (req, res) => {
  try {
    console.log('Creating payment intent for user:', { userId: req.user.id, role: req.user.role, payload: req.body });
    if (req.user.role !== 'tourist') {
      return res.status(403).json({ error: 'Access denied: Only tourists can create payments' });
    }

    const { bookingId, paymentMethod } = req.body;
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: 'Invalid Booking ID' });
    }

    const booking = await Booking.findById(bookingId).populate('providerId touristId');
    if (!booking || booking.status !== 'pending' || booking.touristId._id.toString() !== req.user.id.toString()) {
      return res.status(400).json({ error: 'Invalid or unauthorized booking' });
    }

    // Dynamic base URL from request headers
    const baseUrl = req.headers.origin || 'http://localhost:3000';

    // Dynamic notify URL for PayHere
    // Vercel deployment URL will be the domain + '/api'
    const notifyUrl = `${req.protocol}://${req.get('host')}/api/payments/payhere-notification`;

    if (paymentMethod === 'stripe') {
      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: Math.round(booking.totalPrice * 100),
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
      const amount = booking.totalPrice.toFixed(2);
      const merchantId = env.PAYHERE_MERCHANT_ID;
      const merchantSecret = env.PAYHERE_MERCHANT_SECRET;
      const currency = env.PAYHERE_CURRENCY || 'LKR';

      if (!merchantId || !merchantSecret) {
        console.error('PayHere credentials missing:', { merchantId, merchantSecret });
        return res.status(500).json({ error: 'PayHere configuration error' });
      }

      const hashString = `${merchantId}${orderId}${amount}${currency}${merchantSecret}`;
      const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();
      console.log('PayHere hash calculation:', { hashString, hash, merchantId, orderId, amount, currency });

      const payHereData = {
        merchant_id: merchantId,
        return_url: `${baseUrl}/payment-success`,
        cancel_url: `${baseUrl}/payment-cancel`,
        notify_url: notifyUrl,
        order_id: orderId,
        items: booking.providerId.serviceName || 'Jeep Booking',
        currency: currency,
        amount: amount,
        first_name: booking.touristId.fullName.split(' ')[0] || 'Test',
        last_name: booking.touristId.fullName.split(' ')[1] || 'User',
        email: booking.touristId.email || 'test@example.com',
        phone: '0771234567',
        address: 'Test Address',
        city: 'Colombo',
        country: 'Sri Lanka',
        hash: hash
      };

      console.log('PayHere payment data prepared:', { orderId, amount, currency, hash });
      res.json({ payHereData, method: 'payhere' });
    } else {
      return res.status(400).json({ error: 'Invalid payment method' });
    }
  } catch (err) {
    console.error('Error creating payment intent:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to create payment' });
  }
});

router.post('/payhere-notification', express.json(), async (req, res) => {
  const { merchant_id, order_id, status_code, md5sig, amount, currency } = req.body;

  const merchantSecret = env.PAYHERE_MERCHANT_SECRET;
  const hashString = `${merchant_id}${order_id}${amount}${currency}${status_code}${merchantSecret}`;
  const generatedSig = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

  console.log('PayHere notification received:', { merchant_id, order_id, status_code, md5sig, generatedSig, hashString });

  if (generatedSig !== md5sig) {
    console.error('PayHere signature verification failed:', { order_id, md5sig, generatedSig });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (status_code === '2') {
    try {
      await Booking.findByIdAndUpdate(order_id, { status: 'confirmed' });
      console.log('PayHere payment succeeded for booking:', order_id);
    } catch (err) {
      console.error('Error updating booking status:', err.message);
    }
  }

  res.status(200).send('OK');
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET || '');
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

export default router;
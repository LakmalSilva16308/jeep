import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Provider from '../models/Provider.js';
import Tourist from '../models/Tourist.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Create booking (tourist)
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('Creating booking for user:', { userId: req.user.id, role: req.user.role, payload: req.body });
    // Temporarily allow non-tourists for debugging
    // if (req.user.role !== 'tourist') {
    //   console.error('Access denied: Not a tourist', { userId: req.user.id });
    //   return res.status(403).json({ error: 'Access denied: Only tourists can book' });
    // }
    const { providerId, date, time, adults, children, specialNotes } = req.body;
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      console.error('Invalid providerId:', providerId);
      return res.status(400).json({ error: 'Invalid Provider ID' });
    }
    const provider = await Provider.findById(providerId);
    if (!provider) {
      console.error('Provider not found:', providerId);
      return res.status(404).json({ error: 'Provider not found' });
    }
    const totalPrice = provider.price * (parseInt(adults) + 0.5 * parseInt(children || 0));
    const booking = await Booking.create({
      touristId: req.user.id,
      providerId,
      date,
      time,
      adults: parseInt(adults),
      children: parseInt(children || 0),
      specialNotes,
      totalPrice,
      status: 'pending'
    });
    console.log('Booking created:', { bookingId: booking._id, providerId, touristId: req.user.id });
    res.json({ message: 'Booking created', booking });
  } catch (err) {
    console.error('Error creating booking:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to create booking' });
  }
});

// Get tourist's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching bookings for tourist:', { userId: req.user.id, role: req.user.role });
    // Temporarily allow non-tourists for debugging
    // if (req.user.role !== 'tourist') {
    //   console.error('Access denied: Not a tourist', { userId: req.user.id });
    //   return res.status(403).json({ error: 'Access denied: Only tourists can view their bookings' });
    // }
    const bookings = await Booking.find({ touristId: req.user.id })
      .populate({
        path: 'providerId',
        select: 'serviceName category price _id'
      })
      .lean();
    console.log(`Fetched ${bookings.length} bookings for tourist ${req.user.id}:`, bookings);
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching tourist bookings:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

// Get provider's bookings
router.get('/provider-bookings', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching bookings for provider:', { userId: req.user.id, role: req.user.role });
    if (req.user.role !== 'provider') {
      console.error('Access denied: Not a provider', { userId: req.user.id });
      return res.status(403).json({ error: 'Access denied: Only providers can view their bookings' });
    }
    const bookings = await Booking.find({ providerId: req.user.id })
      .populate({
        path: 'touristId',
        select: 'fullName _id'
      })
      .lean();
    console.log(`Fetched ${bookings.length} bookings for provider ${req.user.id}:`, bookings);
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching provider bookings:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

// Get all bookings (admin)
router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: 'touristId',
        select: 'fullName _id'
      })
      .populate({
        path: 'providerId',
        select: 'serviceName category price _id'
      })
      .lean();
    console.log(`Fetched ${bookings.length} bookings for admin`);
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching bookings for admin:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

// Add booking (admin)
router.post('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { providerId, touristId, date, time, adults, children, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(providerId) || !mongoose.Types.ObjectId.isValid(touristId)) {
      console.error('Invalid providerId or touristId:', { providerId, touristId });
      return res.status(400).json({ error: 'Invalid Provider or Tourist ID' });
    }
    const provider = await Provider.findById(providerId);
    if (!provider) {
      console.error('Provider not found:', providerId);
      return res.status(404).json({ error: 'Provider not found' });
    }
    const tourist = await Tourist.findById(touristId);
    if (!tourist) {
      console.error('Tourist not found:', touristId);
      return res.status(404).json({ error: 'Tourist not found' });
    }
    const totalPrice = provider.price * (parseInt(adults) + 0.5 * parseInt(children || 0));
    const booking = await Booking.create({
      touristId,
      providerId,
      date,
      time,
      adults: parseInt(adults),
      children: parseInt(children || 0),
      totalPrice,
      status
    });
    console.log('Booking added by admin:', booking._id);
    res.json({ message: 'Booking added', booking });
  } catch (err) {
    console.error('Error adding booking:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to add booking' });
  }
});

// Approve booking (admin)
router.put('/admin/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('Invalid booking ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid Booking ID' });
    }
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'confirmed' }, { new: true })
      .populate({
        path: 'touristId',
        select: 'fullName _id'
      })
      .populate({
        path: 'providerId',
        select: 'serviceName category price _id'
      })
      .lean();
    if (!booking) {
      console.error('Booking not found:', req.params.id);
      return res.status(404).json({ error: 'Booking not found' });
    }
    console.log('Booking approved:', booking._id);
    res.json({ message: 'Booking approved', booking });
  } catch (err) {
    console.error('Error approving booking:', req.params.id, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to approve booking' });
  }
});

// Delete booking (admin)
router.delete('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('Invalid booking ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid Booking ID' });
    }
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      console.error('Booking not found:', req.params.id);
      return res.status(404).json({ error: 'Booking not found' });
    }
    console.log('Booking deleted:', req.params.id);
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    console.error('Error deleting booking:', req.params.id, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to delete booking' });
  }
});

export default router;
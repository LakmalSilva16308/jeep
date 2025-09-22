import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Contact from '../models/Contact.js';
import Provider from '../models/Provider.js';
import Tourist from '../models/Tourist.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Creating booking for user:`, { userId: req.user.id, role: req.user.role, payload: req.body });
    if (req.user.role !== 'tourist') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a tourist`, { userId: req.user.id });
      return res.status(403).json({ error: 'Access denied: Only tourists can book' });
    }
    const { providerId, date, time, adults, children, specialNotes, contact } = req.body;
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      console.error(`[${new Date().toISOString()}] Invalid providerId: ${providerId}`);
      return res.status(400).json({ error: 'Invalid Provider ID' });
    }
    if (!contact || !contact.name || !contact.email || !contact.message || !contact.phone) {
      console.error(`[${new Date().toISOString()}] Missing contact form details`);
      return res.status(400).json({ error: 'Contact details (name, email, message, phone) are required' });
    }
    const provider = await Provider.findById(providerId);
    if (!provider) {
      console.error(`[${new Date().toISOString()}] Provider not found: ${providerId}`);
      return res.status(404).json({ error: 'Provider not found' });
    }
    const contactDoc = new Contact({
      name: contact.name,
      email: contact.email,
      message: contact.message,
      phone: contact.phone
    });
    await contactDoc.save();
    const totalPrice = provider.price * (parseInt(adults) || 1) + (provider.price * 0.5 * (parseInt(children) || 0)); // Simplified pricing
    const booking = await Booking.create({
      touristId: req.user.id,
      providerId,
      date,
      time,
      adults: parseInt(adults) || 1,
      children: parseInt(children) || 0,
      specialNotes,
      totalPrice,
      status: 'pending',
      contactId: contactDoc._id
    });
    const populatedBooking = await Booking.findById(booking._id)
      .populate('providerId touristId contactId')
      .lean();
    console.log(`[${new Date().toISOString()}] Booking created with contact:`, { bookingId: booking._id, providerId, touristId: req.user.id, contactId: contactDoc._id });
    res.json({ message: 'Booking created', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error creating booking:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to create booking' });
  }
});

router.post('/product', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Creating product booking for user:`, { userId: req.user.id, role: req.user.role, payload: req.body });
    if (req.user.role !== 'tourist') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a tourist`, { userId: req.user.id });
      return res.status(403).json({ error: 'Access denied: Only tourists can book' });
    }
    const { productType, date, time, adults, children, totalPrice, specialNotes, contact } = req.body;
    if (!productType || !date || !time || !adults || !totalPrice || !contact || !contact.name || !contact.email || !contact.message || !contact.phone) {
      console.error(`[${new Date().toISOString()}] Missing required fields for product booking`);
      return res.status(400).json({ error: 'Product type, date, time, adults, total price, and contact details (name, email, message, phone) are required' });
    }
    const contactDoc = new Contact({
      name: contact.name,
      email: contact.email,
      message: contact.message,
      phone: contact.phone
    });
    await contactDoc.save();
    const booking = await Booking.create({
      touristId: req.user.id,
      productType,
      date,
      time,
      adults: parseInt(adults) || 1,
      children: parseInt(children) || 0,
      totalPrice: Number(totalPrice),
      specialNotes,
      status: 'pending',
      contactId: contactDoc._id
    });
    const populatedBooking = await Booking.findById(booking._id)
      .populate('providerId touristId contactId')
      .lean();
    console.log(`[${new Date().toISOString()}] Product booking created with contact:`, { bookingId: booking._id, productType, touristId: req.user.id, contactId: contactDoc._id });
    res.json({ message: 'Product booking created - awaiting admin approval', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error creating product booking:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to create product booking' });
  }
});

router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Fetching bookings for tourist:`, { userId: req.user.id, role: req.user.role });
    if (req.user.role !== 'tourist') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a tourist`, { userId: req.user.id });
      return res.status(403).json({ error: 'Access denied: Only tourists can view their bookings' });
    }
    const bookings = await Booking.find({ touristId: req.user.id })
      .populate({
        path: 'providerId',
        select: 'serviceName category price _id'
      })
      .populate({
        path: 'touristId',
        select: 'fullName email _id'
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt'
      })
      .lean();
    console.log(`[${new Date().toISOString()}] Fetched ${bookings.length} bookings for tourist ${req.user.id}`);
    res.json(bookings);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching tourist bookings:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

router.get('/provider-bookings', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Fetching bookings for provider:`, { userId: req.user.id, role: req.user.role });
    if (req.user.role !== 'provider') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a provider`, { userId: req.user.id });
      return res.status(403).json({ error: 'Access denied: Only providers can view their bookings' });
    }
    const bookings = await Booking.find({ providerId: req.user.id })
      .populate({
        path: 'touristId',
        select: 'fullName email _id'
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt'
      })
      .lean();
    console.log(`[${new Date().toISOString()}] Fetched ${bookings.length} bookings for provider ${req.user.id}`);
    res.json(bookings);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching provider bookings:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Fetching all bookings for admin:`, { userId: req.user.id });
    const bookings = await Booking.find()
      .populate({
        path: 'providerId',
        select: 'serviceName category price _id'
      })
      .populate({
        path: 'touristId',
        select: 'fullName email _id'
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt'
      })
      .lean();
    console.log(`[${new Date().toISOString()}] Fetched ${bookings.length} bookings for admin`);
    res.json(bookings);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching admin bookings:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

router.put('/admin/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Approving booking:`, { bookingId: req.params.id, adminId: req.user.id });
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      console.error(`[${new Date().toISOString()}] Booking not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Booking not found' });
    }
    booking.status = 'confirmed';
    await booking.save();
    const populatedBooking = await Booking.findById(booking._id)
      .populate('providerId touristId contactId')
      .lean();
    console.log(`[${new Date().toISOString()}] Booking approved: ${booking._id}`);
    res.json({ message: 'Booking approved', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error approving booking:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to approve booking' });
  }
});

router.delete('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Deleting booking:`, { bookingId: req.params.id, adminId: req.user.id });
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      console.error(`[${new Date().toISOString()}] Booking not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Booking not found' });
    }
    console.log(`[${new Date().toISOString()}] Booking deleted: ${req.params.id}`);
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error deleting booking:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to delete booking' });
  }
});

router.post('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    console.log(`[${new Date().toISOString()}] Admin creating booking:`, { adminId: req.user.id, payload: req.body });
    const { providerId, touristId, productType, date, time, adults, children, totalPrice, status, specialNotes, contact } = req.body;
    if (!touristId || !date || !time || !adults || (!providerId && !productType)) {
      console.error(`[${new Date().toISOString()}] Missing required fields for admin booking`);
      return res.status(400).json({ error: 'Tourist ID, date, time, adults, and either provider ID or product type are required' });
    }
    if (providerId && !mongoose.Types.ObjectId.isValid(providerId)) {
      console.error(`[${new Date().toISOString()}] Invalid providerId: ${providerId}`);
      return res.status(400).json({ error: 'Invalid Provider ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(touristId)) {
      console.error(`[${new Date().toISOString()}] Invalid touristId: ${touristId}`);
      return res.status(400).json({ error: 'Invalid Tourist ID' });
    }
    let contactId = null;
    if (contact && contact.name && contact.email && contact.message) {
      const contactDoc = new Contact({
        name: contact.name,
        email: contact.email,
        message: contact.message,
        phone: contact.phone || ''
      });
      await contactDoc.save();
      contactId = contactDoc._id;
    }
    const bookingData = {
      touristId,
      date,
      time,
      adults: parseInt(adults) || 1,
      children: parseInt(children) || 0,
      status: status || 'pending',
      specialNotes,
      contactId
    };
    if (providerId) {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        console.error(`[${new Date().toISOString()}] Provider not found: ${providerId}`);
        return res.status(404).json({ error: 'Provider not found' });
      }
      bookingData.providerId = providerId;
      bookingData.totalPrice = totalPrice ? Number(totalPrice) : provider.price * (parseInt(adults) || 1) + (provider.price * 0.5 * (parseInt(children) || 0));
    } else if (productType) {
      bookingData.productType = productType;
      bookingData.totalPrice = Number(totalPrice);
    }
    const booking = await Booking.create(bookingData);
    const populatedBooking = await Booking.findById(booking._id)
      .populate('providerId touristId contactId')
      .lean();
    console.log(`[${new Date().toISOString()}] Admin booking created:`, { bookingId: booking._id, providerId, productType, touristId, contactId });
    res.json({ message: 'Booking created', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error creating admin booking:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to create booking' });
  }
});

export default router;
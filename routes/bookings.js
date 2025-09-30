import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Contact from '../models/Contact.js';
import Provider from '../models/Provider.js';
import Tourist from '../models/Tourist.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Create provider-based booking (tourist)
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating provider-based booking for user:`, { userId: req.user.id, role: req.user.role, payload: req.body });
    if (req.user.role !== 'tourist') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a tourist`, { userId: req.user.id, role: req.user.role });
      return res.status(403).json({ error: 'Access denied: Only tourists can book' });
    }

    const { providerId, date, time, adults, children, specialNotes, contact } = req.body;
    if (!providerId || !date || !time || !adults || !contact || !contact.name || !contact.email || !contact.message || !contact.phone) {
      console.error(`[${new Date().toISOString()}] Missing required fields for provider-based booking`, { payload: req.body });
      return res.status(400).json({ error: 'Provider ID, date, time, adults, and contact details (name, email, message, phone) are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      console.error(`[${new Date().toISOString()}] Invalid providerId: ${providerId}`);
      return res.status(400).json({ error: 'Invalid Provider ID' });
    }

    const provider = await Provider.findById(providerId).lean();
    if (!provider || !provider.approved) {
      console.error(`[${new Date().toISOString()}] Provider not found or not approved: ${providerId}`);
      return res.status(404).json({ error: 'Provider not found or not approved' });
    }

    const contactDoc = await Contact.create({
      name: contact.name,
      email: contact.email,
      message: contact.message,
      phone: contact.phone
    });

    const totalPrice = provider.price * (Number(adults) + 0.5 * Number(children || 0));
    const booking = await Booking.create({
      touristId: req.user.id,
      providerId,
      date: new Date(date),
      time,
      adults: Number(adults),
      children: Number(children || 0),
      specialNotes,
      totalPrice,
      status: 'pending',
      contactId: contactDoc._id
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: 'providerId',
        select: 'serviceName fullName email contact category location price description profilePicture'
      })
      .populate({
        path: 'touristId',
        select: 'fullName email country'
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt'
      })
      .lean();

    console.log(`[${new Date().toISOString()}] Provider-based booking created:`, { bookingId: booking._id, providerId, touristId: req.user.id, contactId: contactDoc._id });
    return res.json({ message: 'Booking created successfully', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error creating provider-based booking:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to create booking' });
  }
});

// Create product booking (tourist)
router.post('/product', authenticateToken, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating product booking for user:`, { userId: req.user.id, role: req.user.role, payload: req.body });
    if (req.user.role !== 'tourist') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a tourist`, { userId: req.user.id, role: req.user.role });
      return res.status(403).json({ error: 'Access denied: Only tourists can book' });
    }

    const { productType, date, time, adults, children, totalPrice, specialNotes, contact } = req.body;
    if (!productType || !date || !time || !adults || !totalPrice || !contact || !contact.name || !contact.email || !contact.message || !contact.phone) {
      console.error(`[${new Date().toISOString()}] Missing required fields for product booking`, { payload: req.body });
      return res.status(400).json({ error: 'Product type, date, time, adults, total price, and contact details (name, email, message, phone) are required' });
    }

    const contactDoc = await Contact.create({
      name: contact.name,
      email: contact.email,
      message: contact.message,
      phone: contact.phone
    });

    const booking = await Booking.create({
      touristId: req.user.id,
      productType,
      date: new Date(date),
      time,
      adults: Number(adults),
      children: Number(children || 0),
      totalPrice: Number(totalPrice) ,
      specialNotes,
      status: 'pending',
      contactId: contactDoc._id
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: 'touristId',
        select: 'fullName email country'
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt'
      })
      .lean();

    console.log(`[${new Date().toISOString()}] Product booking created:`, { bookingId: booking._id, productType, touristId: req.user.id, contactId: contactDoc._id });
    return res.json({ message: 'Product booking created - awaiting admin approval', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error creating product booking:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to create product booking' });
  }
});

// Get tourist's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching bookings for tourist:`, { userId: req.user.id, role: req.user.role });
    if (req.user.role !== 'tourist') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a tourist`, { userId: req.user.id, role: req.user.role });
      return res.status(403).json({ error: 'Access denied: Only tourists can view their bookings' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      console.error(`[${new Date().toISOString()}] Invalid touristId: ${req.user.id}`);
      return res.status(400).json({ error: 'Invalid Tourist ID' });
    }

    const tourist = await Tourist.findById(req.user.id).lean();
    if (!tourist) {
      console.error(`[${new Date().toISOString()}] Tourist not found: ${req.user.id}`);
      return res.status(404).json({ error: 'Tourist not found' });
    }

    const bookings = await Booking.find({ touristId: req.user.id })
      .populate({
        path: 'providerId',
        select: 'serviceName fullName email contact category location price description profilePicture',
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'touristId',
        select: 'fullName email country',
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt',
        match: { _id: { $exists: true } }
      })
      .sort({ date: -1 })
      .lean();

    console.log(`[${new Date().toISOString()}] Fetched ${bookings.length} bookings for tourist ${req.user.id}`);
    return res.json(bookings || []);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching tourist bookings:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

// Get provider's bookings
router.get('/provider-bookings', authenticateToken, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching bookings for provider:`, { userId: req.user.id, role: req.user.role });
    if (req.user.role !== 'provider') {
      console.error(`[${new Date().toISOString()}] Access denied: Not a provider`, { userId: req.user.id, role: req.user.role });
      return res.status(403).json({ error: 'Access denied: Only providers can view their bookings' });
    }

    const provider = await Provider.findById(req.user.id).lean();
    if (!provider || !provider.approved) {
      console.error(`[${new Date().toISOString()}] Provider not found or not approved: ${req.user.id}`);
      return res.status(404).json({ error: 'Provider not found or not approved' });
    }

    const bookings = await Booking.find({ providerId: req.user.id })
      .populate({
        path: 'touristId',
        select: 'fullName email country',
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt',
        match: { _id: { $exists: true } }
      })
      .sort({ date: -1 })
      .lean();

    console.log(`[${new Date().toISOString()}] Fetched ${bookings.length} bookings for provider ${req.user.id}`);
    return res.json(bookings || []);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching provider bookings:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

// Get all bookings (admin)
router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching all bookings for admin:`, { userId: req.user.id });
    const bookings = await Booking.find()
      .populate({
        path: 'providerId',
        select: 'serviceName fullName email contact category location price description profilePicture',
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'touristId',
        select: 'fullName email country',
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt',
        match: { _id: { $exists: true } }
      })
      .sort({ date: -1 })
      .lean();

    console.log(`[${new Date().toISOString()}] Fetched ${bookings.length} bookings for admin`);
    return res.json(bookings || []);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching admin bookings:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to fetch bookings' });
  }
});

// Approve booking (admin)
router.put('/admin/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Approving booking:`, { bookingId: req.params.id, adminId: req.user.id });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`[${new Date().toISOString()}] Invalid bookingId: ${req.params.id}`);
      return res.status(400).json({ error: 'Invalid Booking ID' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      console.error(`[${new Date().toISOString()}] Booking not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Booking not found' });
    }

    booking.status = 'confirmed';
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: 'providerId',
        select: 'serviceName fullName email contact category location price description profilePicture'
      })
      .populate({
        path: 'touristId',
        select: 'fullName email country'
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt'
      })
      .lean();

    console.log(`[${new Date().toISOString()}] Booking approved:`, { bookingId: booking._id });
    return res.json({ message: 'Booking approved successfully', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error approving booking ${req.params.id}:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to approve booking' });
  }
});

// Delete booking (admin)
router.delete('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Deleting booking:`, { bookingId: req.params.id, adminId: req.user.id });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`[${new Date().toISOString()}] Invalid bookingId: ${req.params.id}`);
      return res.status(400).json({ error: 'Invalid Booking ID' });
    }

    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      console.error(`[${new Date().toISOString()}] Booking not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Booking not found' });
    }

    console.log(`[${new Date().toISOString()}] Booking deleted:`, { bookingId: req.params.id });
    return res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error deleting booking ${req.params.id}:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to delete booking' });
  }
});

// Create booking (admin)
router.post('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Admin creating booking:`, { adminId: req.user.id, payload: req.body });
    const { providerId, touristId, productType, date, time, adults, children, totalPrice, status, specialNotes, contact } = req.body;

    if (!touristId || !date || !time || !adults || (!providerId && !productType)) {
      console.error(`[${new Date().toISOString()}] Missing required fields for admin booking`, { payload: req.body });
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

    const tourist = await Tourist.findById(touristId).lean();
    if (!tourist) {
      console.error(`[${new Date().toISOString()}] Tourist not found: ${touristId}`);
      return res.status(404).json({ error: 'Tourist not found' });
    }

    let contactId = null;
    if (contact && contact.name && contact.email && contact.message) {
      const contactDoc = await Contact.create({
        name: contact.name,
        email: contact.email,
        message: contact.message,
        phone: contact.phone || ''
      });
      contactId = contactDoc._id;
    }

    const bookingData = {
      touristId,
      date: new Date(date),
      time,
      adults: Number(adults),
      children: Number(children || 0),
      status: status || 'pending',
      specialNotes,
      contactId
    };

    if (providerId) {
      const provider = await Provider.findById(providerId).lean();
      if (!provider || !provider.approved) {
        console.error(`[${new Date().toISOString()}] Provider not found or not approved: ${providerId}`);
        return res.status(404).json({ error: 'Provider not found or not approved' });
      }
      bookingData.providerId = providerId;
      bookingData.totalPrice = totalPrice ? Number(totalPrice) * 300 : provider.price * 300 * (Number(adults) + 0.5 * Number(children || 0));
    } else if (productType) {
      bookingData.productType = productType;
      bookingData.totalPrice = Number(totalPrice) * 300;
    }

    const booking = await Booking.create(bookingData);
    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: 'providerId',
        select: 'serviceName fullName email contact category location price description profilePicture'
      })
      .populate({
        path: 'touristId',
        select: 'fullName email country'
      })
      .populate({
        path: 'contactId',
        select: 'name email message phone createdAt'
      })
      .lean();

    console.log(`[${new Date().toISOString()}] Admin booking created:`, { bookingId: booking._id, providerId, productType, touristId, contactId });
    return res.json({ message: 'Booking created successfully', booking: populatedBooking });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error creating admin booking:`, err.message, err.stack);
    return res.status(500).json({ error: 'Server error: Failed to create booking' });
  }
});

export default router;
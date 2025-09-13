import express from 'express';
import jwt from 'jsonwebtoken';
import Provider from '../models/Provider.js';
import Booking from '../models/Booking.js';
import Tourist from '../models/Tourist.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Multer configuration for file uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/PNG images are allowed'));
  }
});

// Middleware to verify admin
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get pending providers
router.get('/pending-providers', verifyAdmin, async (req, res) => {
  try {
    const providers = await Provider.find({ approved: false });
    return res.json(providers);
  } catch (err) {
    console.error('Error fetching pending providers:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all providers
router.get('/providers', verifyAdmin, async (req, res) => {
  try {
    const providers = await Provider.find();
    return res.json(providers);
  } catch (err) {
    console.error('Error fetching providers:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Add new provider
router.post('/providers', verifyAdmin, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'photos', maxCount: 5 }
]), async (req, res) => {
  const { serviceName, fullName, email, contact, category, location, price, description, password } = req.body;
  try {
    if (!serviceName || !fullName || !email || !contact || !category || !location || !price || !description || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!req.files || !req.files.profilePicture || !req.files.photos) {
      return res.status(400).json({ error: 'Profile picture and at least one photo are required' });
    }

    const existingProvider = await Provider.findOne({ email });
    if (existingProvider) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const profilePicture = req.files.profilePicture[0].path.replace(/\\/g, '/');
    const photos = req.files.photos.map(file => file.path.replace(/\\/g, '/'));

    const provider = await Provider.create({
      serviceName,
      fullName,
      email,
      contact,
      category,
      location,
      price: Number(price),
      description,
      password: hashedPassword,
      approved: true, // Admin-added providers are auto-approved
      profilePicture,
      photos
    });

    return res.json({ message: 'Provider added', provider });
  } catch (err) {
    console.error('Provider add error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update provider
router.put('/providers/:id', verifyAdmin, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'photos', maxCount: 5 }
]), async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  try {
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    if (req.files.profilePicture) {
      updateData.profilePicture = req.files.profilePicture[0].path.replace(/\\/g, '/');
    }
    if (req.files.photos) {
      updateData.photos = req.files.photos.map(file => file.path.replace(/\\/g, '/'));
    }
    const provider = await Provider.findByIdAndUpdate(id, updateData, { new: true });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    return res.json({ message: 'Provider updated', provider });
  } catch (err) {
    console.error('Provider update error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete provider
router.delete('/providers/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const provider = await Provider.findByIdAndDelete(id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    return res.json({ message: 'Provider deleted' });
  } catch (err) {
    console.error('Provider delete error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Approve provider
router.put('/providers/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    );
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    return res.json({ message: 'Provider approved', provider });
  } catch (err) {
    console.error('Error approving provider:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all bookings
router.get('/bookings', verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('providerId', 'serviceName fullName price')
      .populate('touristId', 'fullName email')
      .sort({ date: -1 });
    return res.json(bookings);
  } catch (err) {
    console.error('Error fetching bookings:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Add new booking
router.post('/bookings', verifyAdmin, async (req, res) => {
  const { providerId, touristId, date, time, adults, children, status } = req.body;
  try {
    if (!providerId || !touristId || !date || !time || !adults) {
      return res.status(400).json({ error: 'Provider ID, Tourist ID, Date, Time, and Adults are required' });
    }
    const provider = await Provider.findById(providerId);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const totalPrice = provider.price * (Number(adults) + Number(children) * 0.5); // Example pricing logic
    const booking = await Booking.create({
      providerId,
      touristId,
      date,
      time,
      adults: Number(adults),
      children: Number(children || 0),
      totalPrice,
      status: status || 'pending'
    });
    return res.json({ message: 'Booking added', booking });
  } catch (err) {
    console.error('Booking add error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update booking
router.put('/bookings/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, date, time, adults, children } = req.body;
  try {
    const updateData = {};
    if (status) updateData.status = status;
    if (date) updateData.date = date;
    if (time) updateData.time = time;
    if (adults) updateData.adults = Number(adults);
    if (children) updateData.children = Number(children);
    if (adults || children) {
      const booking = await Booking.findById(id).populate('providerId');
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      updateData.totalPrice = booking.providerId.price * (Number(adults || booking.adults) + Number(children || booking.children) * 0.5);
    }
    const booking = await Booking.findByIdAndUpdate(id, updateData, { new: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    return res.json({ message: 'Booking updated', booking });
  } catch (err) {
    console.error('Booking update error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete booking
router.delete('/bookings/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await Booking.findByIdAndDelete(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    return res.json({ message: 'Booking deleted' });
  } catch (err) {
    console.error('Booking delete error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all tourists
router.get('/tourists', verifyAdmin, async (req, res) => {
  try {
    const tourists = await Tourist.find();
    return res.json(tourists);
  } catch (err) {
    console.error('Error fetching tourists:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Add new tourist
router.post('/tourists', verifyAdmin, async (req, res) => {
  const { fullName, email, password, country } = req.body;
  try {
    if (!fullName || !email || !password || !country) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingTourist = await Tourist.findOne({ email });
    if (existingTourist) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const tourist = await Tourist.create({ fullName, email, password: hashedPassword, country });
    return res.json({ message: 'Tourist added', tourist });
  } catch (err) {
    console.error('Tourist add error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update tourist
router.put('/tourists/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  try {
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const tourist = await Tourist.findByIdAndUpdate(id, updateData, { new: true });
    if (!tourist) return res.status(404).json({ error: 'Tourist not found' });
    return res.json({ message: 'Tourist updated', tourist });
  } catch (err) {
    console.error('Tourist update error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete tourist
router.delete('/tourists/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const tourist = await Tourist.findByIdAndDelete(id);
    if (!tourist) return res.status(404).json({ error: 'Tourist not found' });
    return res.json({ message: 'Tourist deleted' });
  } catch (err) {
    console.error('Tourist delete error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
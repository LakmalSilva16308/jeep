import express from 'express';
import mongoose from 'mongoose';
import Provider from '../models/Provider.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error('Images only (jpeg, jpg, png)!'));
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    const { approved, limit } = req.query;
    const query = approved === 'true' ? { approved: true } : {};
    const providers = await Provider.find(query)
      .limit(parseInt(limit) || 0)
      .lean();
    console.log(`[${new Date().toISOString()}] Fetched ${providers.length} providers (approved=${approved}, limit=${limit})`);
    res.json(providers);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching providers:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch providers' });
  }
});

router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    const providers = await Provider.find().lean();
    console.log(`[${new Date().toISOString()}] Fetched ${providers.length} providers for admin`);
    res.json(providers);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching providers for admin:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch providers' });
  }
});

router.get('/admin/pending', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    const providers = await Provider.find({ approved: false }).lean();
    console.log(`[${new Date().toISOString()}] Fetched ${providers.length} pending providers for admin`);
    res.json(providers);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching pending providers:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch pending providers' });
  }
});

router.post('/admin', authenticateToken, isAdmin, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'photos', maxCount: 5 }
]), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    const { serviceName, fullName, email, contact, category, location, price, description, password } = req.body;
    if (!serviceName || !fullName || !email || !contact || !category || !location || !price || !description || !password || !req.files['profilePicture']) {
      console.error(`[${new Date().toISOString()}] Missing required fields:`, { body: req.body, files: Object.keys(req.files) });
      return res.status(400).json({ error: 'All fields and profile picture are required' });
    }

    const profilePictureFile = req.files['profilePicture'][0];
    const profileResult = await cloudinary.uploader.upload(
      `data:${profilePictureFile.mimetype};base64,${profilePictureFile.buffer.toString('base64')}`,
      { folder: 'provider_profiles', resource_type: 'image' }
    );
    const profilePicture = profileResult.secure_url;

    const photos = [];
    if (req.files['photos']) {
      for (const file of req.files['photos']) {
        const photoResult = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          { folder: 'provider_photos', resource_type: 'image' }
        );
        photos.push(photoResult.secure_url);
      }
    }

    const provider = await Provider.create({
      serviceName,
      fullName,
      email,
      contact,
      category,
      location,
      price: parseFloat(price),
      description,
      password,
      profilePicture,
      photos,
      approved: true
    });
    console.log(`[${new Date().toISOString()}] Provider added: ${provider._id}`);
    res.json({ message: 'Provider added', provider: provider.toObject() });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error adding provider:`, err.message, err.stack);
    if (err.message === 'Email already exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    if (err.message.includes('Images only')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error: Failed to add provider' });
  }
});

router.put('/admin/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`[${new Date().toISOString()}] Invalid provider ID: ${req.params.id}`);
      return res.status(400).json({ error: 'Invalid Provider ID' });
    }
    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    ).lean();
    if (!provider) {
      console.error(`[${new Date().toISOString()}] Provider not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Provider not found' });
    }
    console.log(`[${new Date().toISOString()}] Provider approved: ${provider._id}`);
    res.json({ message: 'Provider approved', provider });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error approving provider: ${req.params.id}`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to approve provider' });
  }
});

router.delete('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`[${new Date().toISOString()}] Invalid provider ID: ${req.params.id}`);
      return res.status(400).json({ error: 'Invalid Provider ID' });
    }
    const provider = await Provider.findByIdAndDelete(req.params.id);
    if (!provider) {
      console.error(`[${new Date().toISOString()}] Provider not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Provider not found' });
    }
    console.log(`[${new Date().toISOString()}] Provider deleted: ${req.params.id}`);
    res.json({ message: 'Provider deleted' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error deleting provider: ${req.params.id}`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to delete provider' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(`[${new Date().toISOString()}] MongoDB not connected`);
      return res.status(500).json({ error: 'Server error: Database not connected' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`[${new Date().toISOString()}] Invalid provider ID: ${req.params.id}`);
      return res.status(400).json({ error: 'Invalid Provider ID' });
    }
    const provider = await Provider.findById(req.params.id).lean();
    if (!provider) {
      console.error(`[${new Date().toISOString()}] Provider not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Provider not found' });
    }
    console.log(`[${new Date().toISOString()}] Fetched provider: ${provider._id}`);
    res.json(provider);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching provider: ${req.params.id}`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch provider' });
  }
});

export default router;
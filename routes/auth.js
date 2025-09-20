import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import cloudinary from 'cloudinary'; // Import the main Cloudinary library
import dotenv from 'dotenv';
import Tourist from '../models/Tourist.js';
import Provider from '../models/Provider.js';
import Admin from '../models/Admin.js';

dotenv.config();

const router = express.Router();

// Configure Cloudinary with your .env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use multer's memory storage to handle file streams
// This prevents saving the file to the local disk, which is essential for Vercel
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/PNG images are allowed'));
  }
});

router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    console.log('Login attempt:', { email, role });
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }

    let user;
    if (role === 'tourist') {
      user = await Tourist.findOne({ email });
    } else if (role === 'provider') {
      user = await Provider.findOne({ email });
    } else if (role === 'admin') {
      user = await Admin.findOne({ username: email });
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (!user) {
      return res.status(400).json({ error: `No ${role} found with this ${role === 'admin' ? 'username' : 'email'}` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (role === 'provider' && !user.approved) {
      return res.status(403).json({ error: 'Provider not approved yet' });
    }

    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Generated token for user:', { id: user._id, role, token });
    return res.json({ token, role });
  } catch (err) {
    console.error('Login error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Tourist signup
router.post('/tourist/signup', async (req, res) => {
  let { fullName, email, password, country } = req.body;

  try {
    console.log('Tourist signup attempt:', { fullName, email, country });
    if (!fullName || !email || !password || !country) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingTourist = await Tourist.findOne({ email });
    if (existingTourist) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const tourist = await Tourist.create({ fullName, email, password: hashedPassword, country });
    const token = jwt.sign({ id: tourist._id, role: 'tourist' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Tourist signup token:', { id: tourist._id, token });
    return res.json({ token, role: 'tourist' });
  } catch (err) {
    console.error('Tourist signup error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Provider signup
router.post('/provider/signup', upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'photos', maxCount: 5 }
]), async (req, res) => {
  const { serviceName, fullName, email, contact, category, location, price, description, password } = req.body;
  try {
    console.log('Provider signup request:', { body: req.body, files: req.files });

    if (!serviceName || !fullName || !email || !contact || !category || !location || !price || !description || !password) {
      return res.status(400).json({ error: `Missing required fields: ${JSON.stringify(req.body)}` });
    }
    if (!req.files || !req.files.profilePicture || req.files.photos.length === 0) {
      return res.status(400).json({ error: 'Profile picture and at least one photo are required' });
    }

    const existingProvider = await Provider.findOne({ email });
    if (existingProvider) return res.status(400).json({ error: 'Email already exists' });

    // Handle image uploads to Cloudinary
    let profilePictureUrl = null;
    let photosUrls = [];

    // Upload profile picture
    const profilePictureFile = req.files.profilePicture[0];
    const profileResult = await cloudinary.uploader.upload(`data:${profilePictureFile.mimetype};base64,${profilePictureFile.buffer.toString('base64')}`, {
      folder: 'provider_profiles',
    });
    profilePictureUrl = profileResult.secure_url;

    // Upload additional photos
    for (const file of req.files.photos) {
      const photoResult = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
        folder: 'provider_photos',
      });
      photosUrls.push(photoResult.secure_url);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
      approved: false,
      profilePicture: profilePictureUrl, // Save the permanent URL
      photos: photosUrls // Save the array of permanent URLs
    });

    const token = jwt.sign({ id: provider._id, role: 'provider' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Provider signup token:', { id: provider._id, token });
    return res.json({ token, role: 'provider' });
  } catch (err) {
    console.error('Provider signup error:', err.message, err.stack);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

export default router;

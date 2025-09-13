import express from 'express';
import mongoose from 'mongoose';
import Tourist from '../models/Tourist.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all tourists (admin)
router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const tourists = await Tourist.find().lean();
    console.log(`Fetched ${tourists.length} tourists for admin`);
    res.json(tourists);
  } catch (err) {
    console.error('Error fetching tourists for admin:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch tourists' });
  }
});

// Add tourist (admin)
router.post('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { fullName, email, password, country } = req.body;
    if (!fullName || !email || !password || !country) {
      console.error('Missing required fields:', req.body);
      return res.status(400).json({ error: 'All fields are required' });
    }
    const tourist = await Tourist.create({ fullName, email, password, country });
    console.log('Tourist added:', tourist._id);
    res.json({ message: 'Tourist added', tourist });
  } catch (err) {
    console.error('Error adding tourist:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to add tourist' });
  }
});

// Delete tourist (admin)
router.delete('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('Invalid tourist ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid Tourist ID' });
    }
    const tourist = await Tourist.findByIdAndDelete(req.params.id);
    if (!tourist) {
      console.error('Tourist not found:', req.params.id);
      return res.status(404).json({ error: 'Tourist not found' });
    }
    console.log('Tourist deleted:', req.params.id);
    res.json({ message: 'Tourist deleted' });
  } catch (err) {
    console.error('Error deleting tourist:', req.params.id, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to delete tourist' });
  }
});

export default router;
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Provider from '../models/Provider.js';
import Tourist from '../models/Tourist.js';
import { authenticateToken } from '../middleware/auth.js';
import { isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Submit a review (tourists review services, providers review tourists)
router.post('/', authenticateToken, async (req, res) => {
  const { targetId, rating, comment, reviewType } = req.body;
  try {
    // Validate inputs
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      console.error('Invalid targetId format:', targetId);
      return res.status(400).json({ error: `Invalid Service or Tourist ID format: ${targetId}` });
    }
    if (!rating || rating < 1 || rating > 5) {
      console.error('Invalid rating:', rating);
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    if (!comment || comment.trim() === '') {
      console.error('Comment is empty');
      return res.status(400).json({ error: 'Comment is required' });
    }
    if (!['service', 'tourist'].includes(reviewType)) {
      console.error('Invalid reviewType:', reviewType);
      return res.status(400).json({ error: 'Review type must be "service" or "tourist"' });
    }

    // Check user role and permissions
    if (req.user.role === 'tourist' && reviewType === 'service') {
      const provider = await Provider.findById(targetId);
      if (!provider) {
        console.error('Provider not found for targetId:', targetId);
        return res.status(404).json({ error: `Service not found for ID: ${targetId}` });
      }
      const booking = await Booking.findOne({
        touristId: req.user.id,
        providerId: targetId,
        status: 'confirmed'
      });
      if (!booking) {
        console.error('No confirmed booking found for tourist', { userId: req.user.id, targetId });
        return res.status(403).json({ error: `No confirmed booking found for service ID: ${targetId}` });
      }
    } else if (req.user.role === 'provider' && reviewType === 'tourist') {
      const tourist = await Tourist.findById(targetId);
      if (!tourist) {
        console.error('Tourist not found:', targetId);
        return res.status(404).json({ error: `Tourist not found for ID: ${targetId}` });
      }
      const booking = await Booking.findOne({
        providerId: req.user.id,
        touristId: targetId,
        status: 'confirmed'
      });
      if (!booking) {
        console.error('No confirmed booking found for provider', { userId: req.user.id, touristId: targetId });
        return res.status(403).json({ error: `No confirmed booking found for tourist ID: ${targetId}` });
      }
    } else {
      console.error('Invalid role or reviewType', { role: req.user.role, reviewType });
      return res.status(403).json({ error: 'Access denied: Invalid role or review type' });
    }

    const review = await Review.create({
      targetId,
      reviewerId: req.user.id,
      rating,
      comment,
      reviewType,
      approved: reviewType === 'service' // Auto-approve service reviews
    });
    console.log('Review submitted:', { reviewId: review._id, targetId, rating, reviewType });
    res.json({ message: 'Review submitted successfully', review });
  } catch (err) {
    console.error('Error submitting review:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to submit review' });
  }
});

// Get all approved service reviews for home page
router.get('/all', async (req, res) => {
  try {
    // Validate review documents before population
    const reviews = await Review.find({ 
      reviewType: 'service', 
      approved: true,
      reviewerId: { $exists: true, $ne: null },
      targetId: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`Found ${reviews.length} service reviews before population`);
    
    // Manually populate to handle errors gracefully
    const populatedReviews = await Promise.all(reviews.map(async (review) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(review.reviewerId) || !mongoose.Types.ObjectId.isValid(review.targetId)) {
          console.warn(`Skipping review ${review._id}: Invalid ObjectId`, {
            reviewId: review._id,
            reviewerId: review.reviewerId,
            targetId: review.targetId
          });
          return null;
        }

        const reviewer = await Tourist.findById(review.reviewerId)
          .select('fullName')
          .lean();
        const target = await Provider.findById(review.targetId)
          .select('serviceName')
          .lean();
        
        if (!reviewer || !reviewer.fullName || !target || !target.serviceName) {
          console.warn(`Skipping review ${review._id}: Invalid reviewer or target`, {
            reviewId: review._id,
            reviewerId: review.reviewerId,
            hasReviewer: !!reviewer,
            hasFullName: reviewer?.fullName,
            targetId: review.targetId,
            hasTarget: !!target,
            hasServiceName: target?.serviceName
          });
          return null;
        }

        return {
          ...review,
          reviewerId: { _id: reviewer._id, fullName: reviewer.fullName },
          targetId: { _id: target._id, serviceName: target.serviceName }
        };
      } catch (err) {
        console.warn(`Error populating review ${review._id}:`, err.message);
        return null;
      }
    }));

    const filteredReviews = populatedReviews
      .filter(review => review !== null)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
    
    console.log(`Fetched ${filteredReviews.length} approved service reviews for home page`);
    res.json(filteredReviews);
  } catch (err) {
    console.error('Error fetching all service reviews:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Get approved reviews for a service
router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      console.error('Invalid serviceId format:', serviceId);
      return res.status(400).json({ error: `Invalid Service ID format: ${serviceId}` });
    }
    const provider = await Provider.findById(serviceId);
    if (!provider) {
      console.error('Provider not found:', serviceId);
      return res.status(404).json({ error: `Service not found for ID: ${serviceId}` });
    }
    const reviews = await Review.find({ targetId: serviceId, reviewType: 'service', approved: true })
      .populate({
        path: 'reviewerId',
        select: 'fullName'
      })
      .sort({ createdAt: -1 })
      .lean();
    console.log(`Fetched ${reviews.length} approved service reviews for service ${serviceId}`);
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews for service:', req.params.serviceId, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Get approved reviews for a tourist
router.get('/tourist/:touristId', async (req, res) => {
  try {
    const { touristId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(touristId)) {
      console.error('Invalid touristId format:', touristId);
      return res.status(400).json({ error: `Invalid Tourist ID format: ${touristId}` });
    }
    const tourist = await Tourist.findById(touristId);
    if (!tourist) {
      console.error('Tourist not found:', touristId);
      return res.status(404).json({ error: `Tourist not found for ID: ${touristId}` });
    }
    const reviews = await Review.find({ targetId: touristId, reviewType: 'tourist', approved: true })
      .populate({
        path: 'reviewerId',
        select: 'serviceName'
      })
      .sort({ createdAt: -1 })
      .lean();
    console.log(`Fetched ${reviews.length} approved tourist reviews for tourist ${touristId}`);
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews for tourist:', req.params.touristId, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Admin: Get all reviews
router.get('/admin/reviews', authenticateToken, isAdmin, async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate({
        path: 'reviewerId',
        select: 'fullName serviceName'
      })
      .populate({
        path: 'targetId',
        select: 'serviceName fullName'
      })
      .sort({ createdAt: -1 })
      .lean();
    console.log(`Fetched ${reviews.length} reviews for admin`);
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching all reviews for admin:', err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Admin: Approve review
router.put('/admin/reviews/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error('Invalid review ID format:', id);
      return res.status(400).json({ error: `Invalid Review ID format: ${id}` });
    }
    const review = await Review.findByIdAndUpdate(id, { approved: true }, { new: true })
      .populate('reviewerId', 'fullName serviceName')
      .populate('targetId', 'serviceName fullName')
      .lean();
    if (!review) {
      console.error('Review not found:', id);
      return res.status(404).json({ error: 'Review not found' });
    }
    console.log('Review approved:', { reviewId: id });
    res.json({ message: 'Review approved successfully', review });
  } catch (err) {
    console.error('Error approving review:', req.params.id, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to approve review' });
  }
});

// Admin: Delete review
router.delete('/admin/reviews/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error('Invalid review ID format:', id);
      return res.status(400).json({ error: `Invalid Review ID format: ${id}` });
    }
    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      console.error('Review not found:', id);
      return res.status(404).json({ error: 'Review not found' });
    }
    console.log('Review deleted:', { reviewId: id });
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Error deleting review:', req.params.id, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to delete review' });
  }
});

export default router;
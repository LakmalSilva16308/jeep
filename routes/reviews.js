import express from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Provider from '../models/Provider.js';
import Tourist from '../models/Tourist.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Submit a review (tourists review services/products, providers review tourists)
router.post('/', authenticateToken, async (req, res) => {
  const { targetId, rating, comment, reviewType } = req.body;
  try {
    // Validate inputs
    if (!targetId) {
      console.error(`[${new Date().toISOString()}] Missing targetId`);
      return res.status(400).json({ error: 'Target ID is required' });
    }
    if (!rating || rating < 1 || rating > 5) {
      console.error(`[${new Date().toISOString()}] Invalid rating: ${rating}`);
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    if (!comment || comment.trim() === '') {
      console.error(`[${new Date().toISOString()}] Comment is empty`);
      return res.status(400).json({ error: 'Comment is required' });
    }
    if (!['service', 'product', 'tourist'].includes(reviewType)) {
      console.error(`[${new Date().toISOString()}] Invalid reviewType: ${reviewType}`);
      return res.status(400).json({ error: 'Review type must be "service", "product", or "tourist"' });
    }

    // Check user role and permissions
    if (req.user.role === 'tourist') {
      if (reviewType === 'service') {
        if (!mongoose.Types.ObjectId.isValid(targetId)) {
          console.error(`[${new Date().toISOString()}] Invalid service ID format: ${targetId}`);
          return res.status(400).json({ error: `Invalid Service ID format: ${targetId}` });
        }
        const provider = await Provider.findById(targetId);
        if (!provider) {
          console.error(`[${new Date().toISOString()}] Provider not found for targetId: ${targetId}`);
          return res.status(404).json({ error: `Service not found for ID: ${targetId}` });
        }
        const booking = await Booking.findOne({
          touristId: req.user.id,
          providerId: targetId,
          status: 'confirmed'
        });
        if (!booking) {
          console.error(`[${new Date().toISOString()}] No confirmed booking found for tourist`, { userId: req.user.id, targetId });
          return res.status(403).json({ error: `No confirmed booking found for service ID: ${targetId}` });
        }
      } else if (reviewType === 'product') {
        const validProducts = [
          'Jeep Safari', 'Tuk Tuk Adventures', 'Catamaran Boat Ride', 'Village Cooking Experience',
          'Traditional Village Lunch', 'Sundowners Cocktail', 'High Tea', 'Bullock Cart Ride',
          'Budget Village Tour', 'Village Tour'
        ];
        if (!validProducts.includes(targetId)) {
          console.error(`[${new Date().toISOString()}] Invalid product name: ${targetId}`);
          return res.status(400).json({ error: `Invalid Product: ${targetId}` });
        }
        const booking = await Booking.findOne({
          touristId: req.user.id,
          productType: targetId,
          status: 'confirmed'
        });
        if (!booking) {
          console.error(`[${new Date().toISOString()}] No confirmed booking found for tourist`, { userId: req.user.id, targetId });
          return res.status(403).json({ error: `No confirmed booking found for product: ${targetId}` });
        }
      } else {
        console.error(`[${new Date().toISOString()}] Invalid reviewType for tourist`, { role: req.user.role, reviewType });
        return res.status(403).json({ error: 'Tourists can only review services or products' });
      }
    } else if (req.user.role === 'provider' && reviewType === 'tourist') {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        console.error(`[${new Date().toISOString()}] Invalid tourist ID format: ${targetId}`);
        return res.status(400).json({ error: `Invalid Tourist ID format: ${targetId}` });
      }
      const tourist = await Tourist.findById(targetId);
      if (!tourist) {
        console.error(`[${new Date().toISOString()}] Tourist not found: ${targetId}`);
        return res.status(404).json({ error: `Tourist not found for ID: ${targetId}` });
      }
      const booking = await Booking.findOne({
        providerId: req.user.id,
        touristId: targetId,
        status: 'confirmed'
      });
      if (!booking) {
        console.error(`[${new Date().toISOString()}] No confirmed booking found for provider`, { userId: req.user.id, touristId: targetId });
        return res.status(403).json({ error: `No confirmed booking found for tourist ID: ${targetId}` });
      }
    } else {
      console.error(`[${new Date().toISOString()}] Invalid role or reviewType`, { role: req.user.role, reviewType });
      return res.status(403).json({ error: 'Access denied: Invalid role or review type' });
    }

    const review = await Review.create({
      targetId,
      reviewerId: req.user.id,
      rating,
      comment,
      reviewType,
      approved: reviewType === 'service' || reviewType === 'product'
    });
    console.log(`[${new Date().toISOString()}] Review submitted:`, { reviewId: review._id, targetId, rating, reviewType });
    res.json({ message: 'Review submitted successfully', review });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error submitting review:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to submit review' });
  }
});

// Get all approved service and product reviews for home page
router.get('/all', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching approved service/product reviews`);
    const reviews = await Review.find({ 
      reviewType: { $in: ['service', 'product'] }, 
      approved: true,
      reviewerId: { $exists: true, $ne: null },
      targetId: { $exists: true, $ne: null }
    }).lean();

    console.log(`[${new Date().toISOString()}] Found ${reviews.length} reviews (service/product) before population`);
    
    const populatedReviews = await Promise.all(reviews.map(async (review) => {
      try {
        if (!review.reviewerId || !review.targetId) {
          console.warn(`[${new Date().toISOString()}] Skipping review ${review._id}: Missing reviewerId or targetId`, {
            reviewId: review._id,
            reviewerId: review.reviewerId,
            targetId: review.targetId
          });
          return null;
        }

        if (review.reviewType === 'service') {
          if (!mongoose.Types.ObjectId.isValid(review.reviewerId) || !mongoose.Types.ObjectId.isValid(review.targetId)) {
            console.warn(`[${new Date().toISOString()}] Skipping service review ${review._id}: Invalid ObjectId`, {
              reviewId: review._id,
              reviewerId: review.reviewerId,
              targetId: review.targetId
            });
            return null;
          }

          const [reviewer, target] = await Promise.all([
            Tourist.findById(review.reviewerId).select('fullName').lean(),
            Provider.findById(review.targetId).select('serviceName').lean()
          ]);

          if (!reviewer || !reviewer.fullName || !target || !target.serviceName) {
            console.warn(`[${new Date().toISOString()}] Skipping service review ${review._id}: Invalid reviewer or target`, {
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
        } else {
          if (!mongoose.Types.ObjectId.isValid(review.reviewerId)) {
            console.warn(`[${new Date().toISOString()}] Skipping product review ${review._id}: Invalid reviewerId`, {
              reviewId: review._id,
              reviewerId: review.reviewerId
            });
            return null;
          }

          const reviewer = await Tourist.findById(review.reviewerId).select('fullName').lean();
          if (!reviewer || !reviewer.fullName) {
            console.warn(`[${new Date().toISOString()}] Skipping product review ${review._id}: Invalid reviewer`, {
              reviewId: review._id,
              reviewerId: review.reviewerId,
              hasReviewer: !!reviewer,
              hasFullName: reviewer?.fullName
            });
            return null;
          }
          return {
            ...review,
            reviewerId: { _id: reviewer._id, fullName: reviewer.fullName },
            targetId: { serviceName: review.targetId }
          };
        }
      } catch (err) {
        console.warn(`[${new Date().toISOString()}] Error populating review ${review._id}:`, err.message);
        return null;
      }
    }));

    const filteredReviews = populatedReviews
      .filter(review => review !== null)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
    
    console.log(`[${new Date().toISOString()}] Fetched ${filteredReviews.length} approved service/product reviews for home page`);
    res.json(filteredReviews);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching all reviews:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Get approved reviews for a service
router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      console.error(`[${new Date().toISOString()}] Invalid serviceId format: ${serviceId}`);
      return res.status(400).json({ error: `Invalid Service ID format: ${serviceId}` });
    }
    const provider = await Provider.findById(serviceId).lean();
    if (!provider) {
      console.error(`[${new Date().toISOString()}] Provider not found: ${serviceId}`);
      return res.status(404).json({ error: `Service not found for ID: ${serviceId}` });
    }
    const reviews = await Review.find({ targetId: serviceId, reviewType: 'service', approved: true })
      .populate({
        path: 'reviewerId',
        select: 'fullName'
      })
      .sort({ createdAt: -1 })
      .lean();
    console.log(`[${new Date().toISOString()}] Fetched ${reviews.length} approved service reviews for service ${serviceId}`);
    res.json(reviews);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching reviews for service ${req.params.serviceId}:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Get approved reviews for a tourist
router.get('/tourist/:touristId', async (req, res) => {
  try {
    const { touristId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(touristId)) {
      console.error(`[${new Date().toISOString()}] Invalid touristId format: ${touristId}`);
      return res.status(400).json({ error: `Invalid Tourist ID format: ${touristId}` });
    }
    const tourist = await Tourist.findById(touristId).lean();
    if (!tourist) {
      console.error(`[${new Date().toISOString()}] Tourist not found: ${touristId}`);
      return res.status(404).json({ error: `Tourist not found for ID: ${touristId}` });
    }
    const reviews = await Review.find({ targetId: touristId, reviewType: 'tourist', approved: true })
      .populate({
        path: 'reviewerId',
        select: 'serviceName'
      })
      .sort({ createdAt: -1 })
      .lean();
    console.log(`[${new Date().toISOString()}] Fetched ${reviews.length} approved tourist reviews for tourist ${touristId}`);
    res.json(reviews);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching reviews for tourist ${req.params.touristId}:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Admin: Get all reviews
router.get('/admin/reviews', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching all reviews for admin`);
    const reviews = await Review.find()
      .populate({
        path: 'reviewerId',
        select: 'fullName serviceName'
      })
      .sort({ createdAt: -1 })
      .lean();

    const populatedReviews = await Promise.all(reviews.map(async (review) => {
      try {
        if (!review.reviewerId || !review.targetId) {
          console.warn(`[${new Date().toISOString()}] Skipping review ${review._id}: Missing reviewerId or targetId`, {
            reviewId: review._id,
            reviewerId: review.reviewerId,
            targetId: review.targetId
          });
          return null;
        }
        if (review.reviewType === 'service' || review.reviewType === 'tourist') {
          const targetModel = review.reviewType === 'service' ? Provider : Tourist;
          const target = await targetModel.findById(review.targetId)
            .select(review.reviewType === 'service' ? 'serviceName' : 'fullName')
            .lean();
          if (!target) {
            console.warn(`[${new Date().toISOString()}] Skipping review ${review._id}: Target not found`, { targetId: review.targetId });
            return null;
          }
          return {
            ...review,
            targetId: {
              _id: target._id,
              [review.reviewType === 'service' ? 'serviceName' : 'fullName']: target[review.reviewType === 'service' ? 'serviceName' : 'fullName']
            }
          };
        } else {
          return {
            ...review,
            targetId: { serviceName: review.targetId }
          };
        }
      } catch (err) {
        console.warn(`[${new Date().toISOString()}] Error populating review ${review._id}:`, err.message);
        return null;
      }
    }));

    const filteredReviews = populatedReviews.filter(review => review !== null);
    console.log(`[${new Date().toISOString()}] Fetched ${filteredReviews.length} reviews for admin`);
    res.json(filteredReviews);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching all reviews for admin:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to fetch reviews' });
  }
});

// Admin: Approve review
router.put('/admin/reviews/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error(`[${new Date().toISOString()}] Invalid review ID format: ${id}`);
      return res.status(400).json({ error: `Invalid Review ID format: ${id}` });
    }
    const review = await Review.findByIdAndUpdate(id, { approved: true }, { new: true })
      .populate({
        path: 'reviewerId',
        select: 'fullName serviceName'
      })
      .lean();
    if (!review) {
      console.error(`[${new Date().toISOString()}] Review not found: ${id}`);
      return res.status(404).json({ error: 'Review not found' });
    }

    let populatedReview = review;
    if (review.reviewType === 'service' || review.reviewType === 'tourist') {
      const targetModel = review.reviewType === 'service' ? Provider : Tourist;
      const target = await targetModel.findById(review.targetId)
        .select(review.reviewType === 'service' ? 'serviceName' : 'fullName')
        .lean();
      if (target) {
        populatedReview = {
          ...review,
          targetId: {
            _id: target._id,
            [review.reviewType === 'service' ? 'serviceName' : 'fullName']: target[review.reviewType === 'service' ? 'serviceName' : 'fullName']
          }
        };
      }
    } else {
      populatedReview = {
        ...review,
        targetId: { serviceName: review.targetId }
      };
    }

    console.log(`[${new Date().toISOString()}] Review approved:`, { reviewId: id });
    res.json({ message: 'Review approved successfully', review: populatedReview });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error approving review ${req.params.id}:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to approve review' });
  }
});

// Admin: Delete review
router.delete('/admin/reviews/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error(`[${new Date().toISOString()}] Invalid review ID format: ${id}`);
      return res.status(400).json({ error: `Invalid Review ID format: ${id}` });
    }
    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      console.error(`[${new Date().toISOString()}] Review not found: ${id}`);
      return res.status(404).json({ error: 'Review not found' });
    }
    console.log(`[${new Date().toISOString()}] Review deleted:`, { reviewId: id });
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error deleting review ${req.params.id}:`, err.message, err.stack);
    res.status(500).json({ error: 'Server error: Failed to delete review' });
  }
});

export default router;
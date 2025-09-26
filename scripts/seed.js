import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Tourist from '../models/Tourist.js';
import Provider from '../models/Provider.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Contact from '../models/Contact.js';
import Admin from '../models/Admin.js';
import cloudinary from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const seedDB = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Connecting to MongoDB with URI: ${process.env.MONGODB_URI.replace(/:.*@/, ':<hidden>@')}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[${new Date().toISOString()}] Connected to MongoDB`);

    // Clear existing data
    await Promise.all([
      Tourist.deleteMany({}),
      Provider.deleteMany({}),
      Booking.deleteMany({}),
      Review.deleteMany({}),
      Contact.deleteMany({}),
      Admin.deleteMany({})
    ]);
    console.log(`[${new Date().toISOString()}] Cleared existing data`);

    // Create admin
    const adminHashedPassword = await bcrypt.hash('Admin123!', 10);
    const admin = await Admin.create({
      username: 'admin@jeepbooking.com',
      password: adminHashedPassword,
      role: 'admin'
    });
    console.log(`[${new Date().toISOString()}] Created admin: ${admin._id}`);

    // Create tourist
    const hashedPassword = await bcrypt.hash('Tourist123!', 10);
    const tourist = await Tourist.create({
      _id: new mongoose.Types.ObjectId('68d2c8e753f6a3586d9429fa'), // Match token ID
      fullName: 'Test Tourist',
      email: 'tourist@jeepbooking.com',
      password: hashedPassword,
      country: 'Sri Lanka'
    });
    console.log(`[${new Date().toISOString()}] Created tourist: ${tourist._id}`);

    // Create provider
    const provider = await Provider.create({
      serviceName: 'Test Jeep Safari',
      fullName: 'Test Provider',
      email: 'provider@jeepbooking.com',
      contact: '1234567890',
      category: 'Jeep Safari',
      location: 'Hiriwadunna',
      price: 100,
      description: 'A thrilling jeep safari experience',
      password: hashedPassword,
      profilePicture: process.env.CLOUDINARY_CLOUD_NAME
        ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/provider_profiles/placeholder.jpg`
        : 'images/placeholder.jpg',
      photos: [],
      approved: true
    });
    console.log(`[${new Date().toISOString()}] Created provider: ${provider._id}`);

    // Create contact
    const contact = await Contact.create({
      name: 'Test Contact',
      email: 'contact@jeepbooking.com',
      message: 'Test booking inquiry',
      phone: '9876543210'
    });
    console.log(`[${new Date().toISOString()}] Created contact: ${contact._id}`);

    // Create booking
    const booking = await Booking.create({
      touristId: tourist._id,
      providerId: provider._id,
      date: new Date(),
      time: '10:00',
      adults: 2,
      children: 0,
      totalPrice: provider.price * 300 * 2,
      status: 'confirmed',
      contactId: contact._id
    });
    console.log(`[${new Date().toISOString()}] Created booking: ${booking._id}`);

    // Create review
    const review = await Review.create({
      targetId: provider._id.toString(),
      reviewerId: tourist._id,
      rating: 5,
      comment: 'Amazing experience!',
      reviewType: 'service',
      approved: true
    });
    console.log(`[${new Date().toISOString()}] Created review: ${review._id}`);

    console.log(`[${new Date().toISOString()}] Database seeded successfully`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error seeding database:`, err.message, err.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log(`[${new Date().toISOString()}] MongoDB connection closed`);
  }
};

seedDB();
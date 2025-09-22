import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs'; // Changed to bcryptjs
import dotenv from 'dotenv';
import Tourist from '../models/Tourist.js';
import Provider from '../models/Provider.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Contact from '../models/Contact.js';
import Admin from '../models/Admin.js'; // Added Admin model

dotenv.config();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`[${new Date().toISOString()}] Connected to MongoDB`);

    // Clear existing data
    await Tourist.deleteMany({});
    await Provider.deleteMany({});
    await Booking.deleteMany({});
    await Review.deleteMany({});
    await Contact.deleteMany({});
    await Admin.deleteMany({}); // Clear admins
    console.log(`[${new Date().toISOString()}] Cleared existing data`);

    // Create admin
    const adminHashedPassword = await bcryptjs.hash('Admin123!', 10);
    const admin = await Admin.create({
      username: 'admin@jeepbooking.com', // Matches auth.js admin login
      password: adminHashedPassword,
      role: 'admin'
    });
    console.log(`[${new Date().toISOString()}] Created admin: ${admin._id}`);

    // Create tourist
    const hashedPassword = await bcryptjs.hash('Tourist123!', 10);
    const tourist = await Tourist.create({
      _id: '68caa8ef0339acb2e2d125c8', // Match the ID from the token
      fullName: 'Test Tourist',
      email: 'tourist@jeepbooking.com',
      password: hashedPassword,
      role: 'tourist',
      country: 'Sri Lanka' // Added to match schema
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
      profilePicture: 'https://res.cloudinary.com/your_cloud_name/image/upload/provider_profiles/test.jpg',
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
      targetId: provider._id,
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
  } finally {
    mongoose.connection.close();
  }
};

seedDB();
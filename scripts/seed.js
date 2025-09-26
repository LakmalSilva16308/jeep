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
      _id: new mongoose.Types.ObjectId('68d2c8e753f6a3586d9429fa'),
      fullName: 'Test Tourist',
      email: 'tourist@jeepbooking.com',
      password: hashedPassword,
      country: 'Sri Lanka'
    });
    console.log(`[${new Date().toISOString()}] Created tourist: ${tourist._id}`);

    // Define image path
    const imagePath = process.env.CLOUDINARY_CLOUD_NAME
      ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/provider_profiles/bicycle.jpg`
      : 'images/bicycle.jpeg';

    // Create providers
    const providers = await Provider.insertMany([
      {
        serviceName: 'Test Jeep Safari',
        fullName: 'Test Provider',
        email: 'provider@jeepbooking.com',
        contact: '1234567890',
        category: 'Jeep Safari',
        location: 'Hiriwadunna',
        price: 100,
        description: 'A thrilling jeep safari experience',
        password: hashedPassword,
        profilePicture: imagePath,
        photos: [],
        approved: true
      },
      {
        serviceName: 'Hiriwadunna Village Tour and Jeep Safari One Day Tour',
        fullName: 'Hiriwadunna Tour Operator',
        email: 'hiriwadunna@jeepbooking.com',
        contact: '1234567891',
        category: 'Village Tour',
        location: 'Hiriwadunna',
        price: 45,
        description: 'Embark on an immersive one-day adventure combining the cultural charm of Hiriwadunna village with an exhilarating Jeep Safari. Explore traditional village life, interact with locals, and experience the thrill of a safari through Sri Lanka’s stunning landscapes, spotting wildlife and soaking in the natural beauty.',
        password: hashedPassword,
        profilePicture: imagePath,
        photos: [],
        approved: true
      },
      {
        serviceName: 'Village Tour and Jeep Safari Sigiriya Tour Dambulla Temple',
        fullName: 'Sigiriya Tour Operator',
        email: 'sigiriya@jeepbooking.com',
        contact: '1234567892',
        category: 'Village Tour',
        location: 'Sigiriya',
        price: 78,
        description: 'Discover the heart of Sri Lanka with this two-day tour, blending cultural exploration and adventure. Wander through authentic villages, conquer the iconic Sigiriya Rock Fortress, visit the historic Dambulla Cave Temple, and enjoy a thrilling Jeep Safari through the wilderness, all while immersing yourself in the rich heritage and natural wonders.',
        password: hashedPassword,
        profilePicture: imagePath,
        photos: [],
        approved: true
      }
    ]);
    console.log(`[${new Date().toISOString()}] Created providers: ${providers.map(p => p._id).join(', ')}`);

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
      providerId: providers[0]._id,
      date: new Date(),
      time: '10:00',
      adults: 2,
      children: 0,
      totalPrice: providers[0].price * 300 * 2,
      status: 'confirmed',
      contactId: contact._id
    });
    console.log(`[${new Date().toISOString()}] Created booking: ${booking._id}`);

    // Create review
    const review = await Review.create({
      targetId: providers[0]._id.toString(),
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
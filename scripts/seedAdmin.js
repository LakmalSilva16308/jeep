import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'admin@jeepbooking.com' });
    if (existingAdmin) {
      console.log('Admin user already exists. Skipping...');
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('Admin123!', saltRounds);

    // Create admin user
    const admin = new Admin({
      username: 'admin@jeepbooking.com',
      password: hashedPassword,
      role: 'admin'
    });
    await admin.save();
    console.log('Admin user created successfully:', {
      username: admin.username,
      role: admin.role
    });

    console.log('Seeding complete. Login with: admin@jeepbooking.com / Admin123!');
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

seedAdmin();
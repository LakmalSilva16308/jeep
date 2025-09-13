import mongoose from 'mongoose';

// Define the Admin schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }
});

const Admin = mongoose.model('Admin', adminSchema);

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/adventurebooking', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

// Main function to add admin
async function addAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin);
      await mongoose.connection.close();
      return;
    }

    // Insert admin user with the hashed password
    const admin = await Admin.create({
      username: 'admin',
      password: '$2b$10$Zw2aG9aVajbDNded5H0f4.gLY02ZUf9a0LlQr878Fk8SWphyfo2cO',
      role: 'admin'
    });
    console.log('Admin user created successfully:', admin);
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error creating admin:', err);
    await mongoose.connection.close();
  }
}

// Run the script
connectToMongoDB().then(addAdmin);
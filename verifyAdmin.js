import mongoose from 'mongoose';

// Define the Admin schema
const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String
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

// Verify admins in database
async function verifyAdmins() {
  try {
    const admins = await Admin.find({});
    if (admins.length === 0) {
      console.log('No admins found in the database');
    } else {
      console.log('Admins in database:', admins);
    }
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error querying admins:', err);
    await mongoose.connection.close();
  }
}

// Run the script
connectToMongoDB().then(verifyAdmins);
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const providerSchema = new mongoose.Schema({
  serviceName: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  contact: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Jeep Safari', 'Tuk Tuk Ride', 'Catamaran Boat Ride', 'Bullock Cart Ride', 'Village Lunch']
  },
  location: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, required: true },
  password: { type: String, required: true },
  approved: { type: Boolean, default: false },
  profilePicture: { type: String, required: true },
  photos: [{ type: String }],
}, {
  timestamps: true
});

// Hash password before saving
providerSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    try {
      this.password = await bcryptjs.hash(this.password, 10);
      console.log(`[${new Date().toISOString()}] Hashed password for provider: ${this.email}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error hashing password for provider ${this.email}: ${err.message}`);
      return next(err);
    }
  }
  next();
});

// Handle duplicate email
providerSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    console.error(`[${new Date().toISOString()}] Duplicate email detected: ${doc.email}`);
    next(new Error('Email already exists'));
  } else if (error) {
    console.error(`[${new Date().toISOString()}] Error saving provider ${doc.email}: ${error.message}`);
    next(error);
  } else {
    console.log(`[${new Date().toISOString()}] Provider saved: ${doc.email}`);
    next();
  }
});

export default mongoose.model('Provider', providerSchema);
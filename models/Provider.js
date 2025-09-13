import mongoose from 'mongoose';

const providerSchema = new mongoose.Schema({
  serviceName: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contact: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Jeep Safari', 'Tuk Tuk Ride', 'Catamaran Boat Ride', 'Bullock Cart Ride', 'Village Lunch']
  },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  password: { type: String, required: true },
  approved: { type: Boolean, default: false },
  profilePicture: { type: String },
  photos: [{ type: String }]
});

export default mongoose.model('Provider', providerSchema);
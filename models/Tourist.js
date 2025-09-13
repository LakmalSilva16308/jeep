import mongoose from 'mongoose';

const touristSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  country: { type: String, required: true }
});

export default mongoose.model('Tourist', touristSchema);
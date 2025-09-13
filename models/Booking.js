import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  touristId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tourist', required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  adults: { type: Number, required: true, min: 1 },
  children: { type: Number, default: 0, min: 0 },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' }
});

export default mongoose.model('Booking', bookingSchema);
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file in development or if .env exists
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath, quiet: true }); // Suppress dotenv logs
if (result.error && result.error.code !== 'ENOENT') {
  console.error('Error loading .env file:', result.error);
} else if (result.error) {
  console.log('No .env file found; relying on environment variables (e.g., Vercel).');
}

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'JWT_SECRET',
  'PAYHERE_MERCHANT_ID',
  'PAYHERE_MERCHANT_SECRET',
  'PAYHERE_CURRENCY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  } else {
    console.warn('Running in production with missing environment variables; ensure they are set in Vercel dashboard.');
  }
}

export default {
  MONGODB_URI: process.env.MONGODB_URI,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  PAYHERE_MERCHANT_ID: process.env.PAYHERE_MERCHANT_ID,
  PAYHERE_MERCHANT_SECRET: process.env.PAYHERE_MERCHANT_SECRET,
  PAYHERE_CURRENCY: process.env.PAYHERE_CURRENCY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
};
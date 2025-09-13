import dotenv from 'dotenv';

     // Load .env file only in development (optional for Railway)
     if (process.env.NODE_ENV !== 'production') {
       const result = dotenv.config({ path: './.env' });
       if (result.error && result.error.code !== 'ENOENT') {
         console.error('Error loading .env file:', result.error);
       } else if (result.error) {
         console.log('No .env file found locally; relying on environment variables.');
       }
     }

     // Validate required environment variables
     const requiredEnvVars = [
       'MONGODB_URI',
       'STRIPE_SECRET_KEY',
       'JWT_SECRET',
       'PAYHERE_MERCHANT_ID',
       'PAYHERE_MERCHANT_SECRET',
       'PAYHERE_CURRENCY'
     ];

     const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
     if (missingVars.length > 0) {
       throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
     }

     export default {
       MONGODB_URI: process.env.MONGODB_URI,
       STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      //  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || null, // Optional
       JWT_SECRET: process.env.JWT_SECRET,
       PAYHERE_MERCHANT_ID: process.env.PAYHERE_MERCHANT_ID,
       PAYHERE_MERCHANT_SECRET: process.env.PAYHERE_MERCHANT_SECRET,
       PAYHERE_CURRENCY: process.env.PAYHERE_CURRENCY
     };
import dotenv from 'dotenv';
   import path from 'path';
   import { fileURLToPath } from 'url';

   const __filename = fileURLToPath(import.meta.url);
   const __dirname = path.dirname(__filename);

   const envPath = path.resolve(__dirname, '../.env');
   console.log('Loading .env from:', envPath);
   const dotenvResult = dotenv.config({ path: envPath });

   if (dotenvResult.error) {
     console.error('Error loading .env file:', dotenvResult.error);
     process.exit(1); // Exit if .env fails to load
   } else {
     console.log('.env file loaded successfully');
     console.log('Environment variables:');
     console.log('PORT:', process.env.PORT);
     console.log('MONGODB_URI:', process.env.MONGODB_URI);
     console.log('JWT_SECRET:', process.env.JWT_SECRET);
     console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);
   }

   export default dotenvResult;
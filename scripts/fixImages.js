import mongoose from 'mongoose';
import Provider from '../models/Provider.js'; // Adjust the path to your Provider model
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI; // Make sure this is in your .env file
const PLACEHOLDER_IMAGE_URL = 'https://placehold.co/600x400/cccccc/333333?text=Image+Not+Found';

async function fixBrokenImageUrls() {
  try {
    // 1. Connect to the MongoDB database
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    // 2. Find all providers with old 'uploads/' URLs
    // We check both the profilePicture field and the photos array
    const providersToUpdate = await Provider.find({
      $or: [
        { profilePicture: { $regex: 'uploads/' } },
        { photos: { $elemMatch: { $regex: 'uploads/' } } }
      ]
    });

    if (providersToUpdate.length === 0) {
      console.log('✅ No providers with old image URLs found. Exiting.');
      await mongoose.disconnect();
      return;
    }

    console.log(`🔎 Found ${providersToUpdate.length} providers with broken image URLs.`);

    // 3. Loop through each provider and update their image fields
    const updatePromises = providersToUpdate.map(async (provider) => {
      // Update the profile picture if it's an old URL
      if (provider.profilePicture && provider.profilePicture.includes('uploads/')) {
        provider.profilePicture = PLACEHOLDER_IMAGE_URL;
      }

      // Update each photo in the photos array if it's an old URL
      if (provider.photos && provider.photos.length > 0) {
        provider.photos = provider.photos.map(photoUrl =>
          photoUrl.includes('uploads/') ? PLACEHOLDER_IMAGE_URL : photoUrl
        );
      }

      await provider.save();
      console.log(`🔄 Updated provider ${provider._id}`);
    });

    await Promise.all(updatePromises);

    console.log('🎉 All providers with old image URLs have been updated.');
  } catch (error) {
    console.error('❌ An error occurred during the update script:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB.');
  }
}

// Run the function
fixBrokenImageUrls();


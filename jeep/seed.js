const mongoose = require('mongoose');
const Provider = require('./models/provider');

const seedTours = async () => {
  await mongoose.connect('mongodb://localhost:27017/jeep_booking', { useNewUrlParser: true, useUnifiedTopology: true });

  const tours = [
    {
      serviceName: 'Hiriwadunna Village Tour and Jeep Safari One Day Tour',
      category: 'Village Tour',
      price: 45,
      description: 'Embark on an immersive one-day adventure combining the cultural charm of Hiriwadunna village with an exhilarating Jeep Safari. Explore traditional village life, interact with locals, and experience the thrill of a safari through Sri Lanka’s stunning landscapes, spotting wildlife and soaking in the natural beauty.',
      profilePicture: 'images/bicycle.jpeg',
      approved: true,
    },
    {
      serviceName: 'Village Tour and Jeep Safari Sigiriya Tour Dambulla Temple',
      category: 'Village Tour',
      price: 78,
      description: 'Discover the heart of Sri Lanka with this two-day tour, blending cultural exploration and adventure. Wander through authentic villages, conquer the iconic Sigiriya Rock Fortress, visit the historic Dambulla Cave Temple, and enjoy a thrilling Jeep Safari through the wilderness, all while immersing yourself in the rich heritage and natural wonders.',
      profilePicture: 'images/bicycle.jpeg',
      approved: true,
    },
  ];

  await Provider.deleteMany({});
  await Provider.insertMany(tours);
  console.log('Tours seeded successfully');
  mongoose.connection.close();
};

seedTours();
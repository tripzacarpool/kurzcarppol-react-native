import mongoose from 'mongoose';
import './src/loadEnv.js';
import { env } from './src/config/env.js';
import { RideOffer, UserProfile } from './src/config/models.js';

const routes = [
  ['Connaught Place, Delhi', 'Indira Gandhi Airport T3, Delhi', 28.6315, 77.2167, 28.5562, 77.1],
  ['Karol Bagh, Delhi', 'Cyber City, Gurugram', 28.651, 77.1909, 28.4949, 77.0884],
  ['Lajpat Nagar, Delhi', 'Noida Sector 62', 28.5677, 77.2433, 28.627, 77.3723],
  ['Rajiv Chowk, Delhi', 'Saket, Delhi', 28.6328, 77.2197, 28.5245, 77.2066],
  ['Dwarka Sector 21, Delhi', 'Gurugram Huda City Centre', 28.5523, 77.0583, 28.4595, 77.0722],
  ['Rohini Sector 18, Delhi', 'Netaji Subhash Place, Delhi', 28.7383, 77.1393, 28.6959, 77.1526],
  ['Mayur Vihar, Delhi', 'Akshardham, Delhi', 28.6081, 77.2928, 28.6127, 77.2773],
  ['Vasant Kunj, Delhi', 'Aerocity, Delhi', 28.5206, 77.1587, 28.5488, 77.1208],
  ['Noida Sector 18', 'Connaught Place, Delhi', 28.5708, 77.3261, 28.6315, 77.2167],
  ['Ghaziabad Vaishali', 'India Gate, Delhi', 28.6494, 77.339, 28.6129, 77.2295],
];

const names = [
  'Aarav Sharma',
  'Riya Mehta',
  'Kabir Singh',
  'Nisha Verma',
  'Arjun Rao',
  'Meera Kapoor',
  'Dev Malhotra',
  'Ananya Gupta',
  'Ishaan Jain',
  'Tara Bansal',
];

const vehicles = [
  ['Honda City', 'White'],
  ['Hyundai i20', 'Silver'],
  ['Maruti Baleno', 'Blue'],
  ['Tata Nexon', 'Grey'],
  ['Kia Seltos', 'Black'],
];

const jitter = (value, amount = 0.015) => value + (Math.random() - 0.5) * amount;

async function main() {
  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI is missing');
  }

  await mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbDb,
    maxPoolSize: env.mongodbMaxPoolSize,
    minPoolSize: env.mongodbMinPoolSize,
    serverSelectionTimeoutMS: env.mongodbServerSelectionTimeoutMs,
    socketTimeoutMS: env.mongodbSocketTimeoutMs,
  });

  const seedTag = 'homefeed_seed_20260518';
  await RideOffer.deleteMany({ notes: seedTag });
  await UserProfile.deleteMany({ clerkId: new RegExp(`^${seedTag}`) });

  const users = [];
  const offers = [];
  const now = Date.now();

  for (let index = 0; index < 80; index += 1) {
    const name = names[index % names.length];
    const [firstName, lastName] = name.split(' ');
    const clerkId = `${seedTag}_${index + 1}`;
    const [model, color] = vehicles[index % vehicles.length];
    const route = routes[index % routes.length];
    const departureTime = new Date(now + (20 + index * 9) * 60 * 1000);

    users.push({
      clerkId,
      email: `${clerkId}@tripza.test`,
      firstName,
      lastName,
      role: 'ride_partner',
      phone: `99999${String(index).padStart(5, '0')}`,
      rating: 4.4 + (index % 6) * 0.1,
      totalTrips: 20 + index,
      vehicleInfo: {
        model,
        color,
        licensePlate: `DL${String(index % 10).padStart(2, '0')}TR${String(1000 + index)}`,
        year: 2020 + (index % 5),
      },
      driverVerified: true,
      isActive: true,
      location: {
        city: 'Delhi',
        country: 'India',
        latitude: jitter(route[2]),
        longitude: jitter(route[3]),
        updatedAt: new Date(),
      },
    });
  }

  const createdUsers = await UserProfile.insertMany(users);

  createdUsers.forEach((user, index) => {
    const route = routes[index % routes.length];
    const [model, color] = vehicles[index % vehicles.length];
    const departureTime = new Date(now + (20 + index * 9) * 60 * 1000);
    const totalSeats = index % 5 === 0 ? 3 : 4;
    const availableSeats = totalSeats === 3 ? [2, 3] : [2, 3, 4];

    offers.push({
      userId: user._id,
      clerkId: user.clerkId,
      driverId: user.clerkId,
      from: route[0],
      to: route[1],
      totalSeats,
      availableSeats,
      farePerSeat: 80 + (index % 9) * 25,
      vehicleType: 'four_wheeler',
      driverMode: index % 3 === 0 ? 'daily' : 'commuter',
      notes: seedTag,
      womenOnly: index % 7 === 0,
      pickupLatitude: jitter(route[2]),
      pickupLongitude: jitter(route[3]),
      pickupCity: 'Delhi NCR',
      pickupCountry: 'India',
      dropoffLatitude: jitter(route[4]),
      dropoffLongitude: jitter(route[5]),
      dropoffCity: 'Delhi NCR',
      dropoffCountry: 'India',
      departureTime,
      status: 'waiting',
      approvalMode: index % 4 === 0 ? 'manual' : 'auto',
      requiresManualApproval: index % 4 === 0,
      vehicle: {
        model,
        color,
        number: user.vehicleInfo.licensePlate,
      },
      driver: {
        name: `${user.firstName} ${user.lastName}`,
        profileImage: 'https://www.gravatar.com/avatar?d=mp',
        rating: user.rating,
        ridesCompleted: user.totalTrips,
        gender: index % 5 === 0 ? 'female' : 'male',
      },
      bookings: [],
    });
  });

  await RideOffer.insertMany(offers);
  console.log(`Seeded ${createdUsers.length} users and ${offers.length} ride offers for home feed testing.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

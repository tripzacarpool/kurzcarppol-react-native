import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurzcarppol')
  .then(async () => {
    const RideOffer = mongoose.model('RideOffer', new mongoose.Schema({}, { strict: false }));
    
    console.log('\nÌ¥ç Checking ALL ride offers...\n');
    const allRides = await RideOffer.find({}).sort({ createdAt: -1 }).limit(10);
    
    console.log(`Total rides found: ${allRides.length}\n`);
    
    allRides.forEach((ride, index) => {
      console.log(`\n[${index + 1}] Ride:`, {
        id: ride._id.toString(),
        from: ride.from?.substring(0, 30),
        to: ride.to?.substring(0, 30),
        status: ride.status,
        departureTime: ride.departureTime,
        availableSeats: ride.availableSeats,
        availableSeatsLength: ride.availableSeats?.length,
        clerkId: ride.clerkId,
        totalSeats: ride.totalSeats
      });
    });
    
    console.log('\n\nÌ¥ç Checking WAITING rides with available seats...\n');
    const waitingRides = await RideOffer.find({ 
      status: 'waiting',
      availableSeats: { $exists: true, $ne: [] }
    }).sort({ createdAt: -1 });
    
    console.log(`Waiting rides with seats: ${waitingRides.length}\n`);
    
    if (waitingRides.length > 0) {
      console.log('Sample waiting ride:', {
        id: waitingRides[0]._id.toString(),
        from: waitingRides[0].from,
        to: waitingRides[0].to,
        status: waitingRides[0].status,
        departureTime: waitingRides[0].departureTime,
        availableSeats: waitingRides[0].availableSeats,
        clerkId: waitingRides[0].clerkId
      });
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('‚ùå Error:', err);
    process.exit(1);
  });

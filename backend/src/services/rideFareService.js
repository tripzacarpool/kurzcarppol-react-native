const VEHICLE_TYPES = ['two_wheeler', 'three_wheeler', 'four_wheeler'];

export const normalizeVehicleType = (value) =>
  VEHICLE_TYPES.includes(value) ? value : 'four_wheeler';

export const getDefaultSharedSeatLimit = (vehicleType) => {
  if (vehicleType === 'two_wheeler') return 1;
  if (vehicleType === 'three_wheeler') return 3;
  return 4;
};

export const roundMoney = (value) => Math.max(0, Math.round(Number(value) || 0));

export const recalculateRideRequestFareSplit = (ride) => {
  const participants = (ride.fareSplit?.participants || [])
    .filter((participant) => participant.status !== 'cancelled')
    .map((participant) => ({
      ...(participant.toObject?.() || participant),
      seatCount: Math.max(1, Number(participant.seatCount) || 1),
    }));

  const totalSeats = participants.reduce(
    (sum, participant) => sum + participant.seatCount,
    0,
  );
  const totalFare = roundMoney(
    ride.driverGuaranteedFare || ride.requestedTotalFare || ride.fare,
  );

  if (!totalSeats || !totalFare) {
    ride.fareSplit = {
      totalFare,
      totalSeats,
      perSeatEstimate: 0,
      driverGuaranteedFare: totalFare,
      updatedAt: new Date(),
      participants,
    };
    return ride.fareSplit;
  }

  const rawShares = participants.map((participant, index) => {
    const rawShare = (totalFare * participant.seatCount) / totalSeats;
    const flooredShare = Math.floor(rawShare);
    return {
      participant,
      index,
      flooredShare,
      fraction: rawShare - flooredShare,
    };
  });

  const assignedTotal = rawShares.reduce(
    (sum, item) => sum + item.flooredShare,
    0,
  );
  let remainder = totalFare - assignedTotal;
  const byFraction = [...rawShares].sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    return a.index - b.index;
  });

  const extraByIndex = new Map();
  for (let index = 0; index < byFraction.length && remainder > 0; index += 1) {
    extraByIndex.set(
      byFraction[index].index,
      (extraByIndex.get(byFraction[index].index) || 0) + 1,
    );
    remainder -= 1;
  }

  const splitParticipants = rawShares.map((item) => ({
    ...item.participant,
    shareAmount: item.flooredShare + (extraByIndex.get(item.index) || 0),
  }));

  ride.fare = totalFare;
  ride.requestedTotalFare = totalFare;
  ride.driverGuaranteedFare = totalFare;
  ride.fareSplit = {
    totalFare,
    totalSeats,
    perSeatEstimate: Math.ceil(totalFare / totalSeats),
    driverGuaranteedFare: totalFare,
    updatedAt: new Date(),
    participants: splitParticipants,
  };

  return ride.fareSplit;
};

export const getRequesterParticipant = (ride, user, payload = {}) => ({
  clerkId: ride.clerkId,
  userId: user._id,
  name:
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    user.email ||
    'Passenger',
  phone: payload.passengerPhone || user.phone || '',
  seatCount: Math.max(1, Number(ride.passengers) || 1),
  role: 'requester',
  paymentMethod: payload.paymentMethod || 'unknown',
  status: 'confirmed',
  joinedAt: new Date(),
});

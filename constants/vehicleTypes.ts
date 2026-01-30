export type RideVehicleType = 'two_wheeler' | 'four_wheeler';

export const VEHICLE_TYPE_OPTIONS: Array<{
  value: RideVehicleType;
  label: string;
  subtitle?: string;
}> = [
  {
    value: 'two_wheeler',
    label: 'Two Wheeler',
    subtitle: 'Bike or scooter rides for quick solo trips',
  },
  {
    value: 'four_wheeler',
    label: 'Four Wheeler',
    subtitle: 'Car rides with extra seats and comfort',
  },
];

export const getVehicleTypeLabel = (value: RideVehicleType) => {
  const option = VEHICLE_TYPE_OPTIONS.find((item) => item.value === value);
  return option ? option.label : value;
};

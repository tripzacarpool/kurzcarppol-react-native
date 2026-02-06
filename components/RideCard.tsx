import { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Car, Star, Clock, MapPin, Users, Timer, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { DRIVER_MODE_META } from '@/constants/driverModes';
import { Ride } from '@/types';
import { useRideTimer, formatTimeRemaining, getTimeColor } from '@/hooks/useRideTimer';
import TimeExtensionPicker from './TimeExtensionPicker';
import VerificationBadge from './VerificationBadge';

interface RideCardProps {
  ride: Ride;
  onPress: () => void;
  isOwner?: boolean;
  onExtendTime?: (rideId: string, newTime: Date) => void;
}

function RideCardComponent({ ride, onPress, isOwner = false, onExtendTime }: RideCardProps) {
  const modeMeta = DRIVER_MODE_META[ride.driverMode];
  const timeRemaining = useRideTimer(ride.departureTime);
  const [showExtendPicker, setShowExtendPicker] = useState(false);
  const [expandedAddress, setExpandedAddress] = useState(false);

  const truncateAddress = (address: string, maxLength: number = 30) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + '...';
  };

  const handleExtendTime = (newTime: Date) => {
    if (onExtendTime) {
      onExtendTime(ride.id, newTime);
    }
    setShowExtendPicker(false);
  };

  // Don't render expired rides
  if (timeRemaining.isExpired) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.card, ride.isWomenOnly && styles.womenOnlyCard]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.driverInfo}>
          <View style={[styles.avatar, ride.driver.gender === 'female' && styles.femaleAvatar]}>
            <Text style={styles.avatarText}>{ride.driver.name[0]}</Text>
          </View>
          <View style={styles.driverDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.driverName}>{ride.driver.name}</Text>
              <VerificationBadge
                verificationBatch={ride.driver.verificationBatch}
                driverVerified={ride.driver.driverVerified}
                size="small"
                showLabel={false}
              />
              {ride.isWomenOnly && (
                <View style={styles.womenBadge}>
                  <Text style={styles.womenBadgeText}>Women Only</Text>
                </View>
              )}
            </View>
            <View style={styles.ratingRow}>
              <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
              <Text style={styles.rating}>{ride.driver.rating}</Text>
              <Text style={styles.rides}>• {ride.driver.ridesCompleted} {ride.driver.ridesCompleted === 1 ? 'ride' : 'rides'}</Text>
            </View>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeLabel}>{modeMeta.label}</Text>
              <Text style={styles.modeBadgeTagline}>{modeMeta.tagline}</Text>
            </View>
          </View>
        </View>
        <View style={styles.fareContainer}>
          <Text style={styles.fare}>₹{ride.farePerSeat}</Text>
          <Text style={styles.perSeat}>per seat</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Timer Display */}
      <View style={[styles.timerContainer, { borderColor: getTimeColor(timeRemaining) + '40' }]}>
        <Timer size={16} color={getTimeColor(timeRemaining)} />
        <Text style={[styles.timerText, { color: getTimeColor(timeRemaining) }]}>
          Departing in {formatTimeRemaining(timeRemaining)}
        </Text>
        {isOwner && (
          <TouchableOpacity
            style={styles.extendButton}
            onPress={() => setShowExtendPicker(true)}>
            <Plus size={14} color={Colors.dark.gold} />
            <Text style={styles.extendButtonText}>Extend</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.routeContainer}>
        <TouchableOpacity 
          style={styles.routeRow}
          onPress={() => setExpandedAddress(!expandedAddress)}
          activeOpacity={0.7}
        >
          <MapPin size={14} color={Colors.dark.gold} />
          <Text style={styles.location} numberOfLines={expandedAddress ? undefined : 1}>
            {expandedAddress ? ride.from : truncateAddress(ride.from)}
          </Text>
        </TouchableOpacity>
        <View style={styles.routeLine} />
        <TouchableOpacity 
          style={styles.routeRow}
          onPress={() => setExpandedAddress(!expandedAddress)}
          activeOpacity={0.7}
        >
          <MapPin size={14} color={Colors.dark.pink} />
          <Text style={styles.location} numberOfLines={expandedAddress ? undefined : 1}>
            {expandedAddress ? ride.to : truncateAddress(ride.to)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <Clock size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText}>{ride.departureTime}</Text>
        </View>
        <View style={styles.infoItem}>
          <Car size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText}>{ride.vehicle.model}</Text>
        </View>
        <View style={styles.infoItem}>
          <Users size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText}>{ride.availableSeats.length} seats</Text>
        </View>
      </View>
      
      <TimeExtensionPicker
        visible={showExtendPicker}
        currentTime={new Date(ride.departureTime)}
        onConfirm={handleExtendTime}
        onCancel={() => setShowExtendPicker(false)}
      />
    </TouchableOpacity>
  );
}

export const RideCard = memo(RideCardComponent);


const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  womenOnlyCard: {
    borderColor: Colors.dark.pink + '40',
    backgroundColor: Colors.dark.card + 'ee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.gold + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  femaleAvatar: {
    backgroundColor: Colors.dark.pink + '30',
  },
  avatarText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  driverDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverName: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  womenBadge: {
    backgroundColor: Colors.dark.pink + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  womenBadgeText: {
    color: Colors.dark.pink,
    fontSize: 10,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  rides: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginLeft: 4,
  },
  modeBadge: {
    marginTop: 6,
    backgroundColor: Colors.dark.border + '33',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  modeBadgeLabel: {
    color: Colors.dark.gold,
    fontWeight: '700',
    fontSize: 11,
  },
  modeBadgeTagline: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  fareContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  fare: {
    color: Colors.dark.gold,
    fontSize: 24,
    fontWeight: '700',
  },
  perSeat: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  timerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  extendButtonText: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '600',
  },
  routeContainer: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  location: {
    color: Colors.dark.text,
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.dark.border,
    marginLeft: 6,
    marginVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginLeft: 4,
  },
});

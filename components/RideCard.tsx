import { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Car, Star, Clock, MapPin, Users, Timer, Plus, IndianRupee, ShieldCheck, Hand } from 'lucide-react-native';
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
  onHoldRequest?: (rideId: string) => void;
  holding?: boolean;
}

function RideCardComponent({ ride, onPress, isOwner = false, onExtendTime, onHoldRequest, holding = false }: RideCardProps) {
  const modeMeta = DRIVER_MODE_META[ride.driverMode] || DRIVER_MODE_META.commuter;
  const driver = ride.driver || {};
  const vehicle = ride.vehicle || {};
  const driverName = driver.name || 'Tripza Driver';
  const driverInitial = driverName.trim()[0] || 'T';
  const driverGender = driver.gender || 'other';
  const driverRating = Number(driver.rating ?? 5);
  const ridesCompleted = driver.ridesCompleted ?? 0;
  const trustBatch = (ride as any).trustBatch || (driver as any).trustBatch || 'new';
  const privacyLabel = (driver as any).privacyLabel || ((ride as any).driverPrivacyType === 'full_detail' ? 'Full detail driver' : 'Private vehicle driver');
  const vehicleModel = vehicle.model || 'Vehicle';
  const availableSeats = Array.isArray(ride.availableSeats) ? ride.availableSeats : [];
  const womenOnly = ride.isWomenOnly || (ride as any).womenOnly;
  const from = ride.from || 'Pickup location';
  const to = ride.to || 'Drop location';
  const departureDate = new Date(ride.departureTime);
  const readableDepartureTime = Number.isNaN(departureDate.getTime())
    ? 'Time not set'
    : departureDate.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
  const timeRemaining = useRideTimer(ride.departureTime);
  const [showExtendPicker, setShowExtendPicker] = useState(false);
  const [expandedAddress, setExpandedAddress] = useState(false);

  const truncateAddress = (address: string, maxLength: number = 30) => {
    if (!address || address.length <= maxLength) return address || '';
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
      style={[styles.card, womenOnly && styles.womenOnlyCard]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.driverInfo}>
          <View style={[styles.avatar, driverGender === 'female' && styles.femaleAvatar]}>
            <Text style={styles.avatarText}>{driverInitial}</Text>
          </View>
          <View style={styles.driverDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.driverName}>{driverName}</Text>
              <VerificationBadge
                verificationBatch={driver.verificationBatch}
                driverVerified={driver.driverVerified}
                size="small"
                showLabel={false}
              />
              {womenOnly && (
                <View style={styles.womenBadge}>
                  <Text style={styles.womenBadgeText}>Women Only</Text>
                </View>
              )}
            </View>
            <View style={styles.ratingRow}>
              <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
              <Text style={styles.rating}>{driverRating.toFixed(1)}</Text>
              <Text style={styles.rides}>- {ridesCompleted} {ridesCompleted === 1 ? 'ride' : 'rides'}</Text>
            </View>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeLabel}>{modeMeta.label}</Text>
              <Text style={styles.modeBadgeTagline}>{modeMeta.tagline}</Text>
            </View>
            <View style={styles.trustRow}>
              <ShieldCheck size={12} color={Colors.dark.success} />
              <Text style={styles.trustText}>
                {trustBatch.charAt(0).toUpperCase() + trustBatch.slice(1)} trust - {privacyLabel}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.fareContainer}>
          <View style={styles.fareRow}>
            <IndianRupee size={18} color={Colors.dark.gold} strokeWidth={2.8} />
            <Text style={styles.fare}>{ride.farePerSeat}</Text>
          </View>
          <Text style={styles.perSeat}>per seat</Text>
          {ride.status === 'ongoing' && (
            <View style={styles.liveStatusBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveStatusText}>In Progress</Text>
            </View>
          )}
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
            {expandedAddress ? from : truncateAddress(from)}
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
            {expandedAddress ? to : truncateAddress(to)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <Clock size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText}>{readableDepartureTime}</Text>
        </View>
        <View style={styles.infoItem}>
          <Car size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText}>{vehicleModel}</Text>
        </View>
        <View style={styles.infoItem}>
          <Users size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText}>{availableSeats.length} seats</Text>
        </View>
      </View>

      {!isOwner && onHoldRequest && (
        <TouchableOpacity
          style={[styles.holdButton, holding && styles.holdButtonDisabled]}
          onPress={() => onHoldRequest(ride.id)}
          disabled={holding}
          activeOpacity={0.78}>
          <Hand size={15} color={Colors.dark.gold} />
          <Text style={styles.holdButtonText}>
            {holding ? 'Sending hold request...' : 'Ask driver to wait'}
          </Text>
        </TouchableOpacity>
      )}
      
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
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  trustText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  fareContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
  liveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.success,
  },
  liveStatusText: {
    color: Colors.dark.success,
    fontSize: 10,
    fontWeight: '600',
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
  holdButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '55',
    backgroundColor: Colors.dark.gold + '14',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  holdButtonDisabled: {
    opacity: 0.6,
  },
  holdButtonText: {
    color: Colors.dark.gold,
    fontSize: 13,
    fontWeight: '800',
  },
});

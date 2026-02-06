import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Clock, Calendar, MapPin, ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import TimeExtensionPicker from '@/components/TimeExtensionPicker';
import { extendRideOfferTime, getRideOfferById } from '@/lib/api';

export default function ExtendTimeScreen() {
  const params = useLocalSearchParams();
  const { offerId, rideId, from, to, departureTime } = params;

  const [loading, setLoading] = useState(false);
  const [rideDetails, setRideDetails] = useState<any>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    if (offerId) {
      fetchRideDetails();
    }
  }, [offerId]);

  const fetchRideDetails = async () => {
    try {
      setLoading(true);
      const response = await getRideOfferById(offerId as string);
      if (response.success && response.rideOffer) {
        setRideDetails(response.rideOffer);
      }
    } catch (error) {
      console.error('Error fetching ride details:', error);
      Alert.alert('Error', 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  const handleExtendTime = async (additionalMinutes: number) => {
    try {
      setExtending(true);
      const response = await extendRideOfferTime(
        offerId as string,
        additionalMinutes,
      );

      if (response.success) {
        Alert.alert(
          '✅ Time Extended',
          `Your ride time has been extended by ${additionalMinutes} minutes`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowTimePicker(false);
                router.back();
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', 'Failed to extend ride time');
      }
    } catch (error) {
      console.error('Error extending time:', error);
      Alert.alert('Error', 'Failed to extend ride time');
    } finally {
      setExtending(false);
    }
  };

  const getDepartureDate = () => {
    const date = new Date(
      (rideDetails?.departureTime || departureTime) as string,
    );
    return date;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const departure = getDepartureDate();
    const diff = departure.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Expired';
    }

    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Loading ride details...</Text>
      </View>
    );
  }

  const ride = rideDetails || { from, to, departureTime };
  const departure = getDepartureDate();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Extend Ride Time</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Alert Banner */}
        <View style={styles.alertBanner}>
          <Clock size={24} color={Colors.gold} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.alertTitle}>Ride Departing Soon!</Text>
            <Text style={styles.alertMessage}>
              Your ride is scheduled to depart in {getTimeRemaining()}. Extend
              the time if you need more time to prepare.
            </Text>
          </View>
        </View>

        {/* Ride Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ride Details</Text>

          {/* Route */}
          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={[styles.dot, styles.dotStart]} />
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeText}>{ride.from}</Text>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={[styles.dot, styles.dotEnd]} />
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routeText}>{ride.to}</Text>
            </View>
          </View>

          {/* Time Info */}
          <View style={styles.timeContainer}>
            <View style={styles.timeRow}>
              <Calendar size={20} color={Colors.gold} />
              <Text style={styles.timeLabel}>Date</Text>
              <Text style={styles.timeValue}>{formatDate(departure)}</Text>
            </View>

            <View style={styles.timeRow}>
              <Clock size={20} color={Colors.gold} />
              <Text style={styles.timeLabel}>Departure</Text>
              <Text style={styles.timeValue}>{formatTime(departure)}</Text>
            </View>
          </View>
        </View>

        {/* Extension Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Quick Tip</Text>
          <Text style={styles.infoText}>
            Extending your ride time will update the departure time for all
            passengers. They'll be notified of the change.
          </Text>
        </View>

        {/* Extend Button */}
        <TouchableOpacity
          style={styles.extendButton}
          onPress={() => setShowTimePicker(true)}
          disabled={extending}
        >
          {extending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Clock size={24} color="#000" />
              <Text style={styles.extendButtonText}>Extend Ride Time</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Time Extension Picker Modal */}
      <TimeExtensionPicker
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onConfirm={handleExtendTime}
        currentDepartureTime={departure}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: '#999',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  alertBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  alertTitle: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertMessage: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  routeContainer: {
    marginBottom: 20,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  dotStart: {
    backgroundColor: Colors.gold,
  },
  dotEnd: {
    backgroundColor: '#4ade80',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#333',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeLabel: {
    color: '#999',
    fontSize: 12,
    marginRight: 8,
    width: 40,
  },
  routeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  timeContainer: {
    gap: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeLabel: {
    color: '#999',
    fontSize: 14,
    flex: 1,
  },
  timeValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    color: '#818cf8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 18,
    gap: 8,
    marginBottom: 32,
  },
  extendButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
});

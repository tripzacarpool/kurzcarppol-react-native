import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Power,
  DollarSign,
  Clock,
  Star,
  Users,
  MapPin,
  Check,
  X,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import Animated from 'react-native-reanimated';
import { FadeInDown } from 'react-native-reanimated';

const mockRequests = [
  {
    id: '1',
    passenger: 'Priya Sharma',
    from: 'Connaught Place',
    to: 'Cyber City',
    seats: 1,
    fare: 120,
    customRequest: 'Can we stop at a ATM on the way?',
  },
  {
    id: '2',
    passenger: 'Rahul Verma',
    from: 'CP Metro',
    to: 'Gurgaon',
    seats: 2,
    fare: 150,
    customFare: 130,
  },
];

export default function DriverDashboard() {
  const router = useRouter();
  const [isLive, setIsLive] = useState(false);
  const [womenOnlyMode, setWomenOnlyMode] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Dashboard</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Power size={24} color={isLive ? Colors.dark.success : Colors.dark.textSecondary} />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isLive ? 'You are Live' : 'Go Live'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isLive
                  ? 'Accepting ride requests'
                  : 'Toggle to start accepting rides'}
              </Text>
            </View>
            <Switch
              value={isLive}
              onValueChange={setIsLive}
              trackColor={{ false: Colors.dark.border, true: Colors.dark.success }}
              thumbColor={Colors.dark.text}
            />
          </View>

          {isLive && (
            <View style={styles.womenOnlyContainer}>
              <Text style={styles.womenOnlyLabel}>Women Only Mode</Text>
              <Switch
                value={womenOnlyMode}
                onValueChange={setWomenOnlyMode}
                trackColor={{ false: Colors.dark.border, true: Colors.dark.pink }}
                thumbColor={Colors.dark.text}
              />
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <DollarSign size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.statValue}>₹2,450</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Users size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Rides Today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Star size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Clock size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.statValue}>6.5h</Text>
            <Text style={styles.statLabel}>Online Time</Text>
          </View>
        </View>

        {isLive && mockRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>Incoming Requests</Text>
            {mockRequests.map((request, index) => (
              <Animated.View
                key={request.id}
                entering={FadeInDown.delay(index * 100).springify()}>
                <View style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.passengerName}>{request.passenger}</Text>
                    <Text style={styles.requestFare}>₹{request.fare}</Text>
                  </View>

                  <View style={styles.requestRoute}>
                    <View style={styles.routeRow}>
                      <MapPin size={14} color={Colors.dark.gold} />
                      <Text style={styles.routeText}>{request.from}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <MapPin size={14} color={Colors.dark.pink} />
                      <Text style={styles.routeText}>{request.to}</Text>
                    </View>
                  </View>

                  <View style={styles.requestDetails}>
                    <View style={styles.detailRow}>
                      <Users size={14} color={Colors.dark.textSecondary} />
                      <Text style={styles.detailText}>
                        {request.seats} {request.seats === 1 ? 'seat' : 'seats'}
                      </Text>
                    </View>
                  </View>

                  {request.customRequest && (
                    <View style={styles.customRequestBox}>
                      <Text style={styles.customRequestLabel}>Custom Request:</Text>
                      <Text style={styles.customRequestText}>
                        {request.customRequest}
                      </Text>
                    </View>
                  )}

                  {request.customFare && (
                    <View style={styles.customFareBox}>
                      <Text style={styles.customFareLabel}>
                        Suggested Fare: ₹{request.customFare}
                      </Text>
                    </View>
                  )}

                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      activeOpacity={0.7}>
                      <X size={20} color={Colors.dark.error} />
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      activeOpacity={0.7}>
                      <Check size={20} color={Colors.dark.background} />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {isLive && mockRequests.length === 0 && (
          <View style={styles.emptyState}>
            <Users size={48} color={Colors.dark.textSecondary} />
            <Text style={styles.emptyText}>Waiting for requests...</Text>
            <Text style={styles.emptySubtext}>
              You'll see ride requests here
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  womenOnlyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  womenOnlyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.pink,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  requestsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  requestFare: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  requestRoute: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    color: Colors.dark.text,
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: Colors.dark.border,
    marginLeft: 6,
    marginVertical: 4,
  },
  requestDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginLeft: 6,
  },
  customRequestBox: {
    backgroundColor: Colors.dark.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  customRequestLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  customRequestText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  customFareBox: {
    backgroundColor: Colors.dark.gold + '20',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  customFareLabel: {
    fontSize: 13,
    color: Colors.dark.gold,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.error + '20',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  rejectButtonText: {
    color: Colors.dark.error,
    fontSize: 15,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  acceptButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
});

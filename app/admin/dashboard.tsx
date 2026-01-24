import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Car,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

const mockDrivers = [
  {
    id: 'd1',
    name: 'Anjali Verma',
    vehicle: 'Honda City - DL 8C 5432',
    rating: 4.9,
    ridesCompleted: 234,
    earnings: 45600,
    status: 'active',
    verified: true,
  },
  {
    id: 'd2',
    name: 'Rahul Kumar',
    vehicle: 'Maruti Swift - DL 3C 9876',
    rating: 4.7,
    ridesCompleted: 189,
    earnings: 38200,
    status: 'active',
    verified: true,
  },
  {
    id: 'd3',
    name: 'Neha Singh',
    vehicle: 'Hyundai i20 - DL 5C 1234',
    rating: 4.8,
    ridesCompleted: 156,
    earnings: 32100,
    status: 'inactive',
    verified: false,
  },
  {
    id: 'd4',
    name: 'Amit Patel',
    vehicle: 'Toyota Innova - DL 1C 7890',
    rating: 4.6,
    ridesCompleted: 278,
    earnings: 52400,
    status: 'active',
    verified: true,
  },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [drivers, setDrivers] = useState(mockDrivers);

  const toggleDriverStatus = (id: string) => {
    setDrivers(
      drivers.map((d) =>
        d.id === id
          ? { ...d, status: d.status === 'active' ? 'inactive' : 'active' }
          : d
      )
    );
  };

  const activeDrivers = drivers.filter((d) => d.status === 'active').length;
  const totalRides = drivers.reduce((sum, d) => sum + d.ridesCompleted, 0);
  const totalRevenue = drivers.reduce((sum, d) => sum + d.earnings, 0);
  const pendingVerifications = drivers.filter((d) => !d.verified).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Search size={20} color={Colors.dark.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.dark.gold + '20' }]}>
              <Users size={24} color={Colors.dark.gold} />
            </View>
            <Text style={styles.statValue}>{activeDrivers}</Text>
            <Text style={styles.statLabel}>Active Drivers</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.dark.success + '20' }]}>
              <Car size={24} color={Colors.dark.success} />
            </View>
            <Text style={styles.statValue}>{totalRides}</Text>
            <Text style={styles.statLabel}>Total Rides</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.dark.gold + '20' }]}>
              <DollarSign size={24} color={Colors.dark.gold} />
            </View>
            <Text style={styles.statValue}>₹{(totalRevenue / 1000).toFixed(1)}k</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.dark.warning + '20' }]}>
              <TrendingUp size={24} color={Colors.dark.warning} />
            </View>
            <Text style={styles.statValue}>{pendingVerifications}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Management</Text>
          {drivers.map((driver, index) => (
            <View key={driver.id}>
              <View style={styles.driverCard}>
                <View style={styles.driverHeader}>
                  <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>
                        {driver.name[0]}
                      </Text>
                    </View>
                    <View style={styles.driverDetails}>
                      <View style={styles.driverNameRow}>
                        <Text style={styles.driverName}>{driver.name}</Text>
                        {driver.verified ? (
                          <View style={styles.verifiedBadge}>
                            <CheckCircle size={14} color={Colors.dark.success} />
                          </View>
                        ) : (
                          <View style={styles.unverifiedBadge}>
                            <XCircle size={14} color={Colors.dark.warning} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.driverVehicle}>{driver.vehicle}</Text>
                    </View>
                  </View>
                  <Switch
                    value={driver.status === 'active'}
                    onValueChange={() => toggleDriverStatus(driver.id)}
                    trackColor={{
                      false: Colors.dark.border,
                      true: Colors.dark.success,
                    }}
                    thumbColor={Colors.dark.text}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.driverStats}>
                  <View style={styles.driverStat}>
                    <Text style={styles.driverStatValue}>{driver.rating}</Text>
                    <Text style={styles.driverStatLabel}>Rating</Text>
                  </View>
                  <View style={styles.driverStat}>
                    <Text style={styles.driverStatValue}>
                      {driver.ridesCompleted}
                    </Text>
                    <Text style={styles.driverStatLabel}>Rides</Text>
                  </View>
                  <View style={styles.driverStat}>
                    <Text style={styles.driverStatValue}>
                      ₹{(driver.earnings / 1000).toFixed(1)}k
                    </Text>
                    <Text style={styles.driverStatLabel}>Earnings</Text>
                  </View>
                </View>

                {!driver.verified && (
                  <TouchableOpacity style={styles.verifyButton}>
                    <CheckCircle size={16} color={Colors.dark.background} />
                    <Text style={styles.verifyButtonText}>Verify Driver</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
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
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  driverCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.gold + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  driverDetails: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginRight: 8,
  },
  verifiedBadge: {
    backgroundColor: Colors.dark.success + '20',
    padding: 4,
    borderRadius: 12,
  },
  unverifiedBadge: {
    backgroundColor: Colors.dark.warning + '20',
    padding: 4,
    borderRadius: 12,
  },
  driverVehicle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  driverStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  driverStat: {
    alignItems: 'center',
  },
  driverStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  driverStatLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.success,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  verifyButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
});

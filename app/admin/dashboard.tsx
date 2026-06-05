import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Car,
  DollarSign,
  CheckCircle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Star,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuthContext } from '@/contexts/AuthContext';
import AdminSOSPanel from '@/components/AdminSOSPanel';
import {
  getAdminDrivers,
  getAdminOverview,
  setAuthToken,
  updateAdminDriver,
} from '@/lib/api';

type DriverPrivacyType = 'full_detail' | 'private_vehicle';
type DriverTrustBatch = 'new' | 'community' | 'trusted' | 'featured';

interface AdminDriver {
  clerkId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  active: boolean;
  mode: string;
  vehicleType: string;
  driverPrivacyType: DriverPrivacyType;
  trustBatch: DriverTrustBatch;
  trustScore: number;
  publicityScore: number;
  rating: number;
  totalTrips: number;
  driverVerified: boolean;
  verificationBatch?: string;
  vehicle: {
    model: string;
    number: string;
  };
}

interface AdminOverview {
  totalUsers: number;
  passengers: number;
  drivers: number;
  activeDrivers: number;
  pendingDrivers: number;
  privateDrivers: number;
  fullDetailDrivers: number;
  activeRideOffers: number;
  completedRideOffers: number;
  totalBookings: number;
  totalRevenue: number;
}

const trustOptions: DriverTrustBatch[] = ['new', 'community', 'trusted', 'featured'];

export default function AdminDashboard() {
  const router = useRouter();
  const { getAuthToken } = useAuthContext();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingClerkId, setUpdatingClerkId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | DriverPrivacyType>('all');

  const filteredDrivers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return drivers.filter((driver) => {
      const matchesPrivacy =
        privacyFilter === 'all' || driver.driverPrivacyType === privacyFilter;
      if (!normalizedQuery) return matchesPrivacy;
      const haystack = [
        driver.name,
        driver.email,
        driver.phone,
        driver.vehicle?.model,
        driver.vehicle?.number,
        driver.trustBatch,
        driver.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesPrivacy && haystack.includes(normalizedQuery);
    });
  }, [drivers, privacyFilter, query]);

  const loadAdminData = useCallback(async () => {
    const token = await getAuthToken();
    if (token) setAuthToken(token);

    const [overviewResponse, driverResponse] = await Promise.all([
      getAdminOverview(),
      getAdminDrivers(),
    ]);

    setOverview(overviewResponse.overview);
    setDrivers(driverResponse.drivers || []);
  }, [getAuthToken]);

  useEffect(() => {
    loadAdminData()
      .catch((error) => {
        console.error('Unable to load admin dashboard:', error);
      })
      .finally(() => setLoading(false));
  }, [loadAdminData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAdminData();
    } finally {
      setRefreshing(false);
    }
  };

  const patchDriver = async (driver: AdminDriver, payload: Record<string, any>) => {
    setUpdatingClerkId(driver.clerkId);
    try {
      const response = await updateAdminDriver(driver.clerkId, payload);
      setDrivers((current) =>
        current.map((item) =>
          item.clerkId === driver.clerkId ? response.driver : item,
        ),
      );
      await loadAdminData();
    } finally {
      setUpdatingClerkId(null);
    }
  };

  const stats = overview || {
    totalUsers: 0,
    passengers: 0,
    drivers: 0,
    activeDrivers: 0,
    pendingDrivers: 0,
    privateDrivers: 0,
    fullDetailDrivers: 0,
    activeRideOffers: 0,
    completedRideOffers: 0,
    totalBookings: 0,
    totalRevenue: 0,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
          <RefreshCw size={20} color={Colors.dark.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
          <Text style={styles.loadingText}>Loading admin data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.statsGrid}>
            <StatCard icon={Users} label="Users" value={String(stats.totalUsers)} color={Colors.dark.gold} />
            <StatCard icon={Car} label="Drivers" value={String(stats.drivers)} color={Colors.dark.success} />
            <StatCard icon={ShieldCheck} label="Pending" value={String(stats.pendingDrivers)} color={Colors.dark.warning} />
            <StatCard icon={DollarSign} label="Revenue" value={`Rs ${(stats.totalRevenue / 1000).toFixed(1)}k`} color={Colors.dark.gold} />
          </View>

          <View style={styles.summaryBand}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.privateDrivers}</Text>
              <Text style={styles.summaryLabel}>Private vehicle</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.fullDetailDrivers}</Text>
              <Text style={styles.summaryLabel}>Full detail</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.activeRideOffers}</Text>
              <Text style={styles.summaryLabel}>Active rides</Text>
            </View>
          </View>

          <View style={styles.sosPanel}>
            <AdminSOSPanel />
          </View>

          <View style={styles.searchPanel}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search drivers, vehicles, status"
              placeholderTextColor={Colors.dark.textSecondary}
              value={query}
              onChangeText={setQuery}
            />
            <View style={styles.filterRow}>
              {(['all', 'private_vehicle', 'full_detail'] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterChip, privacyFilter === item && styles.filterChipActive]}
                  onPress={() => setPrivacyFilter(item)}>
                  <Text style={[styles.filterChipText, privacyFilter === item && styles.filterChipTextActive]}>
                    {item === 'all' ? 'All' : item === 'private_vehicle' ? 'Private' : 'Full detail'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Driver Review</Text>
            <Text style={styles.sectionSubtitle}>{filteredDrivers.length} visible</Text>
          </View>

          {filteredDrivers.map((driver) => {
            const isUpdating = updatingClerkId === driver.clerkId;
            const isPrivate = driver.driverPrivacyType === 'private_vehicle';
            return (
              <View key={driver.clerkId} style={styles.driverCard}>
                <View style={styles.driverHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{driver.name?.[0] || 'D'}</Text>
                  </View>
                  <View style={styles.driverMain}>
                    <View style={styles.driverTitleRow}>
                      <Text style={styles.driverName} numberOfLines={1}>{driver.name}</Text>
                      {driver.driverVerified ? (
                        <CheckCircle size={16} color={Colors.dark.success} />
                      ) : (
                        <XCircle size={16} color={Colors.dark.warning} />
                      )}
                    </View>
                    <Text style={styles.driverMeta} numberOfLines={1}>{driver.email}</Text>
                    <Text style={styles.driverMeta} numberOfLines={1}>
                      {driver.vehicle.model} {driver.vehicle.number ? `- ${driver.vehicle.number}` : ''}
                    </Text>
                  </View>
                  <Switch
                    value={driver.active}
                    disabled={isUpdating}
                    onValueChange={(value) => patchDriver(driver, { isActive: value })}
                    trackColor={{ false: Colors.dark.border, true: Colors.dark.success }}
                    thumbColor={Colors.dark.text}
                  />
                </View>

                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    {isPrivate ? <EyeOff size={13} color={Colors.dark.gold} /> : <Eye size={13} color={Colors.dark.gold} />}
                    <Text style={styles.badgeText}>{isPrivate ? 'Private vehicle' : 'Full detail'}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Star size={13} color={Colors.dark.gold} fill={Colors.dark.gold} />
                    <Text style={styles.badgeText}>{driver.trustBatch} trust</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Trust {driver.trustScore}/100</Text>
                  </View>
                </View>

                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    disabled={isUpdating}
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => patchDriver(driver, { status: 'approved', note: 'Approved from admin dashboard' })}>
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={isUpdating}
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => patchDriver(driver, { status: 'rejected', note: 'Rejected from admin dashboard' })}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    disabled={isUpdating}
                    style={styles.secondaryAction}
                    onPress={() =>
                      patchDriver(driver, {
                        driverPrivacyType: isPrivate ? 'full_detail' : 'private_vehicle',
                      })
                    }>
                    <Text style={styles.secondaryActionText}>
                      Set {isPrivate ? 'full detail' : 'private'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={isUpdating}
                    style={styles.secondaryAction}
                    onPress={() => {
                      const currentIndex = trustOptions.indexOf(driver.trustBatch);
                      const next = trustOptions[(currentIndex + 1) % trustOptions.length];
                      patchDriver(driver, { trustBatch: next });
                    }}>
                    <Text style={styles.secondaryActionText}>Next trust batch</Text>
                  </TouchableOpacity>
                </View>

                {driver.verificationBatch ? (
                  <Text style={styles.verificationText}>
                    Government verification batch: {driver.verificationBatch}
                  </Text>
                ) : (
                  <Text style={styles.verificationText}>
                    Government verification batch: not assigned
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Icon size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  iconButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  summaryBand: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 14,
    padding: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.dark.border,
  },
  summaryValue: {
    color: Colors.dark.gold,
    fontSize: 19,
    fontWeight: '900',
  },
  summaryLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  searchPanel: {
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
    marginTop: 14,
  },
  sosPanel: {
    marginTop: 14,
  },
  searchInput: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    color: Colors.dark.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  filterChipText: {
    color: Colors.dark.textSecondary,
    fontWeight: '800',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: Colors.dark.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  driverCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
    marginBottom: 12,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.dark.gold + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '900',
  },
  driverMain: {
    flex: 1,
    minWidth: 0,
  },
  driverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverName: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '900',
  },
  driverMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  badgeText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
  },
  approveButton: {
    backgroundColor: Colors.dark.success + '20',
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  rejectButton: {
    backgroundColor: Colors.dark.error + '15',
    borderWidth: 1,
    borderColor: Colors.dark.error,
  },
  approveText: {
    color: Colors.dark.success,
    fontWeight: '900',
  },
  rejectText: {
    color: Colors.dark.error,
    fontWeight: '900',
  },
  secondaryAction: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryActionText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '800',
  },
  verificationText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Star, MapPin, Shield, Bell, HelpCircle, LogOut, ChevronRight, Users, Car, UserCog, Check, Globe, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { mockUser } from '@/data/mockData';
import { UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { getUserProfile } from '@/lib/ipService';
import ForceLogoutButton from '@/components/ForceLogoutButton';
import CustomAlert, { AlertType } from '@/components/CustomAlert';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { location, hasPermission, requestPermission, updateLocation } = useLocation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(hasPermission);
  const [currentRole, setCurrentRole] = useState<UserRole>('passenger');
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
    buttons?: any[];
  }>({ title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: AlertType = 'info', buttons?: any[]) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const hideAlert = () => {
    setAlertVisible(false);
    setTimeout(() => {
      setAlertConfig({ title: '', message: '', type: 'info' });
    }, 300);
  };

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role) {
      setCurrentRole(user.role);
    }
  }, [user?.role]);

  useEffect(() => {
    setLocationEnabled(hasPermission);
  }, [hasPermission]);

  const loadUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const handleLogout = async () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      'warning',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚪 User confirmed logout');
              await signOut();
              console.log('⏳ Waiting for state to update...');
              await new Promise(resolve => setTimeout(resolve, 500));
              console.log('🔄 Redirecting to login...');
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('❌ Logout error:', error);
              showAlert('Error', 'Failed to logout. Please try again.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleLocationToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestPermission();
      if (granted) {
        await updateLocation();
        setLocationEnabled(true);
        showAlert('Success', 'Location services enabled!', 'success');
      } else {
        showAlert('Permission Denied', 'Please enable location in your device settings.', 'warning');
      }
    } else {
      setLocationEnabled(false);
    }
  };

  const userDisplayName = userProfile?.full_name || (user?.firstName + ' ' + (user?.lastName || '')) || mockUser.name;
  const userEmail = user?.email || mockUser.email;
  const userRating = userProfile?.rating || mockUser.rating;
  const totalTrips = userProfile?.total_trips || 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, mockUser.gender === 'female' && styles.femaleAvatar]}>
              <User size={48} color={Colors.dark.text} />
            </View>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{userDisplayName}</Text>
          <Text style={styles.email}>{userEmail}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Star size={16} color={Colors.dark.gold} fill={Colors.dark.gold} />
              <Text style={styles.statText}>{userRating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <Car size={16} color={Colors.dark.gold} />
              <Text style={styles.statText}>{totalTrips}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
          </View>
        </View>

        {userProfile?.ip_address && (
          <View style={styles.infoCard}>
            <Globe size={20} color={Colors.dark.gold} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>IP Address</Text>
              <Text style={styles.infoValue}>{userProfile.ip_address}</Text>
            </View>
          </View>
        )}

        {location && (
          <View style={styles.infoCard}>
            <Navigation size={20} color={Colors.dark.gold} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Current Location</Text>
              <Text style={styles.infoValue}>
                {location.city && location.country
                  ? `${location.city}, ${location.country}`
                  : `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
              </Text>
              <Text style={styles.infoSubtext}>
                Last updated: {userProfile?.last_location_update ? new Date(userProfile.last_location_update).toLocaleString() : 'Never'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Switch Mode</Text>
          <View style={styles.roleSwitcher}>
            <TouchableOpacity
              style={[styles.roleCard, currentRole === 'passenger' && styles.roleCardActive]}
              onPress={() => setCurrentRole('passenger')}
              activeOpacity={0.7}>
              <View style={[styles.roleIcon, currentRole === 'passenger' && styles.roleIconActive]}>
                <User size={24} color={currentRole === 'passenger' ? Colors.dark.background : Colors.dark.gold} />
              </View>
              <Text style={[styles.roleTitle, currentRole === 'passenger' && styles.roleTitleActive]}>
                Traveler
              </Text>
              {currentRole === 'passenger' && (
                <View style={styles.activeIndicator}>
                  <Check size={16} color={Colors.dark.background} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, currentRole === 'ride_partner' && styles.roleCardActive]}
              onPress={() => setCurrentRole('ride_partner')}
              activeOpacity={0.7}>
              <View style={[styles.roleIcon, currentRole === 'ride_partner' && styles.roleIconActive]}>
                <Car size={24} color={currentRole === 'ride_partner' ? Colors.dark.background : Colors.dark.gold} />
              </View>
              <Text style={[styles.roleTitle, currentRole === 'ride_partner' && styles.roleTitleActive]}>
                Ride Partner
              </Text>
              {currentRole === 'ride_partner' && (
                <View style={styles.activeIndicator}>
                  <Check size={16} color={Colors.dark.background} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, currentRole === 'admin' && styles.roleCardActive]}
              onPress={() => setCurrentRole('admin')}
              activeOpacity={0.7}>
              <View style={[styles.roleIcon, currentRole === 'admin' && styles.roleIconActive]}>
                <UserCog size={24} color={currentRole === 'admin' ? Colors.dark.background : Colors.dark.gold} />
              </View>
              <Text style={[styles.roleTitle, currentRole === 'admin' && styles.roleTitleActive]}>
                Admin
              </Text>
              {currentRole === 'admin' && (
                <View style={styles.activeIndicator}>
                  <Check size={16} color={Colors.dark.background} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {currentRole === 'ride_partner' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/driver/dashboard')}
              activeOpacity={0.7}>
              <Car size={20} color={Colors.dark.background} />
              <Text style={styles.actionButtonText}>Go to Ride Partner Dashboard</Text>
            </TouchableOpacity>
          )}

          {currentRole === 'admin' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/admin/dashboard')}
              activeOpacity={0.7}>
              <UserCog size={20} color={Colors.dark.background} />
              <Text style={styles.actionButtonText}>Go to Admin Panel</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <User size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.menuText}>Personal Information</Text>
            <ChevronRight size={20} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <MapPin size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.menuText}>Saved Addresses</Text>
            <ChevronRight size={20} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          {currentRole === 'passenger' && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/driver/onboarding')}>
              <View style={styles.menuIcon}>
                <Car size={20} color={Colors.dark.gold} />
              </View>
              <Text style={styles.menuText}>Become a Ride Partner</Text>
              <ChevronRight size={20} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <Bell size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: Colors.dark.border, true: Colors.dark.gold }}
              thumbColor={Colors.dark.text}
            />
          </View>
          <View style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <MapPin size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.menuText}>Location Services</Text>
            <Switch
              value={locationEnabled}
              onValueChange={handleLocationToggle}
              trackColor={{ false: Colors.dark.border, true: Colors.dark.gold }}
              thumbColor={Colors.dark.text}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety & Support</Text>
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, styles.pinkIcon]}>
              <Shield size={20} color={Colors.dark.pink} />
            </View>
            <Text style={styles.menuText}>Safety Center</Text>
            <ChevronRight size={20} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <HelpCircle size={20} color={Colors.dark.gold} />
            </View>
            <Text style={styles.menuText}>Help & Support</Text>
            <ChevronRight size={20} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={20} color={Colors.dark.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <ForceLogoutButton label="Force Logout (No Prompt)" />
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.gold + '30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.dark.gold,
  },
  femaleAvatar: {
    backgroundColor: Colors.dark.pink + '30',
    borderColor: Colors.dark.pink,
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editButtonText: {
    color: Colors.dark.background,
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statText: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  infoSubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pinkIcon: {
    backgroundColor: Colors.dark.pink + '20',
  },
  menuText: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.error + '40',
    gap: 8,
  },
  logoutText: {
    color: Colors.dark.error,
    fontSize: 16,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginBottom: 40,
  },
  roleSwitcher: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.border,
    position: 'relative',
  },
  roleCardActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '20',
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleIconActive: {
    backgroundColor: Colors.dark.gold,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  roleTitleActive: {
    color: Colors.dark.gold,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '700',
  },
});

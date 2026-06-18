import { useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  CarFront,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react-native';
import AppLogo from '@/components/AppLogo';
import { Colors } from '@/constants/Colors';
import { mockRides } from '@/data/mockData';

const normalize = (value: string) => value.toLowerCase().trim();

const formatSeats = (count: number) => `${count} seat${count === 1 ? '' : 's'}`;

export default function PublicHomepage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const isWide = width >= 960;
  const previewRides = useMemo(() => {
    const cleaned = normalize(query);
    const source = [...mockRides].sort((a, b) => Number.parseInt(a.departureTime, 10) - Number.parseInt(b.departureTime, 10));

    if (!cleaned) {
      return source.slice(0, 3);
    }

    return source
      .filter((ride) => {
        const haystack = [
          ride.from,
          ride.to,
          ride.driver?.name,
          ride.vehicle?.model,
          ride.vehicle?.color,
        ]
          .filter(Boolean)
          .join(' ');
        return normalize(haystack).includes(cleaned);
      })
      .slice(0, 3);
  }, [query]);

  const featureCards = [
    {
      icon: MapPin,
      title: 'Nearby rides',
      copy: 'Search a route or area and see rides that match right away.',
    },
    {
      icon: ShieldCheck,
      title: 'Safer by design',
      copy: 'Women-only rides, driver checks, and safety tools stay visible.',
    },
    {
      icon: Zap,
      title: 'Fast booking',
      copy: 'Book a seat, hold a ride, or request a custom trip in a few taps.',
    },
  ];

  const handlePrimaryAction = () => {
    if (query.trim()) {
      scrollRef.current?.scrollTo({ y: 460, animated: true });
      return;
    }
    router.push('/(auth)/login');
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#0a0a0a', '#111111', '#171717']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.shell}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <AppLogo size={44} />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>RaahEasy</Text>
              <Text style={styles.brandTag}>Ride sharing that feels immediate</Text>
            </View>
          </View>

          <View style={styles.topActions}>
            <TouchableOpacity style={styles.ghostButton} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.ghostButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.heroGrid, isWide ? styles.heroGridWide : styles.heroGridStack]}>
          <View style={styles.heroCopy}>
            <View style={styles.badge}>
              <Sparkles size={14} color={Colors.dark.gold} />
              <Text style={styles.badgeText}>Find rides near you</Text>
            </View>

            <Text style={styles.heroTitle}>Start with a location. See the ride options that fit.</Text>
            <Text style={styles.heroSubtitle}>
              Open the app, search by place, and move into booking without hunting through a maze of screens.
            </Text>

            <View style={styles.searchBox}>
              <View style={styles.searchIcon}>
                <Search size={18} color={Colors.dark.gold} />
              </View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by city, landmark, or route"
                placeholderTextColor={Colors.dark.textSecondary}
                style={styles.searchInput}
                autoCapitalize="words"
                returnKeyType="search"
                onSubmitEditing={handlePrimaryAction}
              />
              <TouchableOpacity style={styles.searchAction} onPress={handlePrimaryAction}>
                <ArrowRight size={18} color={Colors.dark.background} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.statPill}>
                <Users size={14} color={Colors.dark.gold} />
                <Text style={styles.statText}>Trusted riders and drivers</Text>
              </View>
              <View style={styles.statPill}>
                <CarFront size={14} color={Colors.dark.gold} />
                <Text style={styles.statText}>Live ride previews</Text>
              </View>
              <View style={styles.statPill}>
                <Clock3 size={14} color={Colors.dark.gold} />
                <Text style={styles.statText}>Quick booking flow</Text>
              </View>
            </View>

            <View style={styles.ctaRow}>
              <TouchableOpacity style={styles.ctaPrimary} onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.ctaPrimaryText}>Join as Passenger</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/(auth)/driver-signup')}>
                <Text style={styles.ctaSecondaryText}>Join as Driver</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.previewPane}>
            <LinearGradient
              colors={['#151515', '#1d1d1d', '#232323']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewCard}
            >
              <View style={styles.previewHeader}>
                <View>
                  <Text style={styles.previewLabel}>Live preview</Text>
                  <Text style={styles.previewTitle}>Rides near your search</Text>
                </View>
                <View style={styles.previewLiveBadge}>
                  <View style={styles.previewLiveDot} />
                  <Text style={styles.previewLiveText}>Live</Text>
                </View>
              </View>

              <View style={styles.previewBadgeRow}>
                <View style={styles.previewMiniBadge}>
                  <MapPin size={12} color={Colors.dark.gold} />
                  <Text style={styles.previewMiniText}>
                    {query.trim() ? query.trim() : 'Connaught Place'}
                  </Text>
                </View>
                <View style={styles.previewMiniBadge}>
                  <ShieldCheck size={12} color={Colors.dark.gold} />
                  <Text style={styles.previewMiniText}>Safety first</Text>
                </View>
              </View>

              <Image source={require('@/assets/icon.png')} style={styles.heroImage} resizeMode="contain" />

              <View style={styles.previewRideList}>
                {previewRides.map((ride) => (
                  <View key={ride.id} style={styles.previewRideCard}>
                    <View style={styles.previewRideTop}>
                      <View style={styles.previewRideTitleWrap}>
                        <Text style={styles.previewRideRoute} numberOfLines={1}>
                          {ride.from} to {ride.to}
                        </Text>
                        <Text style={styles.previewRideMeta} numberOfLines={1}>
                          {ride.driver.name} • {ride.vehicle.model}
                        </Text>
                      </View>
                      <View style={styles.previewFarePill}>
                        <Text style={styles.previewFareText}>Rs {ride.farePerSeat}</Text>
                      </View>
                    </View>
                    <View style={styles.previewRideBottom}>
                      <Text style={styles.previewRideSecondary}>
                        {formatSeats(ride.availableSeats.length)} available
                      </Text>
                      <Text style={styles.previewRideSecondary}>{ride.departureTime} away</Text>
                    </View>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Built for quick decisions</Text>
          <View style={[styles.featureGrid, isWide ? styles.featureGridWide : styles.featureGridStack]}>
            {featureCards.map((item) => {
              const Icon = item.icon;
              return (
                <View key={item.title} style={styles.featureCard}>
                  <View style={styles.featureIcon}>
                    <Icon size={20} color={Colors.dark.gold} />
                  </View>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureCopy}>{item.copy}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.splitBand, isWide ? styles.splitBandWide : styles.splitBandStack]}>
          <View style={styles.bandCard}>
            <Text style={styles.bandLabel}>For passengers</Text>
            <Text style={styles.bandTitle}>Find a ride fast, without losing context.</Text>
            <Text style={styles.bandCopy}>
              Search by place, compare options, and open booking with the route already in view.
            </Text>
          </View>
          <View style={styles.bandCard}>
            <Text style={styles.bandLabel}>For drivers</Text>
            <Text style={styles.bandTitle}>Offer rides, manage seats, and keep control.</Text>
            <Text style={styles.bandCopy}>
              Driver signup and dashboard paths stay one tap away for when you are ready to switch roles.
            </Text>
          </View>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  pageContent: {
    flexGrow: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  brandCopy: {
    minWidth: 0,
    flex: 1,
  },
  brandName: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '900',
  },
  brandTag: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  ghostButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  ghostButtonText: {
    color: Colors.dark.text,
    fontWeight: '700',
    fontSize: 13,
  },
  primaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.gold,
  },
  primaryButtonText: {
    color: Colors.dark.background,
    fontWeight: '800',
    fontSize: 13,
  },
  heroGrid: {
    gap: 18,
    marginBottom: 24,
  },
  heroGridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroGridStack: {
    flexDirection: 'column',
  },
  heroCopy: {
    flex: 1,
    gap: 18,
    paddingVertical: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.dark.gold + '18',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '33',
  },
  badgeText: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: Colors.dark.text,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    maxWidth: 760,
  },
  heroSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
    minHeight: 58,
  },
  searchIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: Colors.dark.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchAction: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    marginLeft: 8,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  ctaPrimary: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  ctaPrimaryText: {
    color: Colors.dark.background,
    fontWeight: '800',
    fontSize: 14,
  },
  ctaSecondary: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  ctaSecondaryText: {
    color: Colors.dark.text,
    fontWeight: '800',
    fontSize: 14,
  },
  previewPane: {
    flex: 1,
    minWidth: 0,
  },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 18,
    gap: 14,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewLabel: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  previewLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#10b98120',
    borderWidth: 1,
    borderColor: '#10b98155',
  },
  previewLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  previewLiveText: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  previewBadgeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  previewMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  previewMiniText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  heroImage: {
    width: '100%',
    height: 150,
    alignSelf: 'center',
  },
  previewRideList: {
    gap: 10,
  },
  previewRideCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
    gap: 8,
  },
  previewRideTop: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  previewRideTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  previewRideRoute: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '800',
  },
  previewRideMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  previewFarePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.dark.gold + '20',
    alignSelf: 'flex-start',
  },
  previewFareText: {
    color: Colors.dark.gold,
    fontWeight: '900',
    fontSize: 12,
  },
  previewRideBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewRideSecondary: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 14,
  },
  featureGrid: {
    gap: 12,
  },
  featureGridWide: {
    flexDirection: 'row',
  },
  featureGridStack: {
    flexDirection: 'column',
  },
  featureCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.dark.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    gap: 10,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold + '16',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '30',
  },
  featureTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '800',
  },
  featureCopy: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  splitBand: {
    gap: 12,
  },
  splitBandWide: {
    flexDirection: 'row',
  },
  splitBandStack: {
    flexDirection: 'column',
  },
  bandCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.dark.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    gap: 8,
  },
  bandLabel: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bandTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '800',
  },
  bandCopy: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});

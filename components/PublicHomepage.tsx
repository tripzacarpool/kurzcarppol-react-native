import { useMemo, useRef, useState } from 'react';
import {
  ImageBackground,
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
  Star,
  Users,
  Zap,
} from 'lucide-react-native';
import AppLogo from '@/components/AppLogo';
import { Colors } from '@/constants/Colors';
import { mockRides } from '@/data/mockData';

const formatSeats = (count: number) => `${count} seat${count === 1 ? '' : 's'}`;

const rideVisuals = [
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1502865395757-40c7dd2ff0f0?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80',
];

export default function PublicHomepage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const isWide = width >= 960;

  const latestRideCarousel = useMemo(() => {
    return [...mockRides]
      .sort((a, b) => Number.parseInt(a.departureTime, 10) - Number.parseInt(b.departureTime, 10))
      .slice(0, 5)
      .map((ride, index) => ({
        ...ride,
        visual: rideVisuals[index % rideVisuals.length],
      }));
  }, []);

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
      scrollRef.current?.scrollTo({ y: 520, animated: true });
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
        <View style={[styles.topBar, !isWide && styles.topBarStack]}>
          <View style={styles.brandRow}>
            <AppLogo size={44} />
            <View style={styles.brandCopy}>
              <Text style={[styles.brandName, !isWide && styles.brandNameCompact]}>RaahEasy</Text>
              <Text style={styles.brandTag}>Ride sharing that feels immediate</Text>
            </View>
          </View>

          <View style={[styles.topActions, !isWide && styles.topActionsStack]}>
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

            <Text style={[styles.heroTitle, !isWide && styles.heroTitleCompact]}>
              Start with a location. See the ride options that fit.
            </Text>
            <Text style={[styles.heroSubtitle, !isWide && styles.heroSubtitleCompact]}>
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
            <View style={styles.previewCard}>
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

              <ImageBackground
                source={{ uri: latestRideCarousel[0]?.visual || rideVisuals[0] }}
                style={styles.featuredImage}
                imageStyle={styles.featuredImageLayer}
              >
                <LinearGradient
                  colors={['#00000000', '#00000055', '#000000d5']}
                  style={styles.featuredOverlay}
                >
                  <View style={styles.featuredTopRow}>
                    <View style={styles.featuredScore}>
                      <Star size={12} color="#f8d66d" />
                      <Text style={styles.featuredScoreText}>4.9 live</Text>
                    </View>
                    <View style={styles.featuredScore}>
                      <Clock3 size={12} color={Colors.dark.gold} />
                      <Text style={styles.featuredScoreText}>Fastest pickup</Text>
                    </View>
                  </View>
                  <View style={styles.featuredBottom}>
                    <Text style={styles.featuredHeadline}>
                      {latestRideCarousel[0]?.from} to {latestRideCarousel[0]?.to}
                    </Text>
                    <Text style={styles.featuredSubline}>
                      {latestRideCarousel[0]?.driver?.name} • {latestRideCarousel[0]?.vehicle?.model}
                    </Text>
                  </View>
                </LinearGradient>
              </ImageBackground>

              <View style={styles.carouselSection}>
                <View style={styles.carouselHeader}>
                  <Text style={styles.carouselTitle}>Latest rides</Text>
                  <Text style={styles.carouselHint}>Swipe for more options</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToAlignment="start"
                  snapToInterval={width < 700 ? Math.min(width * 0.82, 330) + 14 : 360}
                  contentContainerStyle={styles.carouselContent}
                >
                  {latestRideCarousel.map((ride, index) => (
                    <View
                      key={ride.id}
                      style={[
                        styles.carouselCard,
                        {
                          width: width < 700 ? Math.min(width * 0.82, 330) : 340,
                        },
                      ]}
                    >
                      <ImageBackground
                        source={{ uri: ride.visual }}
                        style={styles.carouselCardImage}
                        imageStyle={styles.carouselCardImageLayer}
                      >
                        <LinearGradient colors={['#00000010', '#00000088']} style={styles.carouselCardOverlay}>
                          <View style={styles.carouselCardTopRow}>
                            <View style={styles.carouselRoutePill}>
                              <MapPin size={12} color={Colors.dark.gold} />
                              <Text style={styles.carouselRouteText}>{ride.from}</Text>
                            </View>
                            <View style={styles.carouselFarePill}>
                              <Text style={styles.carouselFareText}>Rs {ride.farePerSeat}</Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </ImageBackground>
                      <View style={styles.carouselCardBody}>
                        <Text style={styles.carouselRideTitle} numberOfLines={1}>
                          {ride.from} to {ride.to}
                        </Text>
                        <Text style={styles.carouselRideMeta} numberOfLines={1}>
                          {ride.driver.name} • {ride.vehicle.model}
                        </Text>
                        <View style={styles.carouselCardFooter}>
                          <Text style={styles.carouselRideSecondary}>
                            {formatSeats(ride.availableSeats.length)} available
                          </Text>
                          <Text style={styles.carouselRideSecondary}>{ride.departureTime} away</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
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
  topBarStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
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
  brandNameCompact: {
    fontSize: 20,
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
  topActionsStack: {
    justifyContent: 'flex-start',
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
  heroTitleCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
  heroSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720,
  },
  heroSubtitleCompact: {
    fontSize: 15,
    lineHeight: 22,
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
    gap: 16,
    overflow: 'hidden',
    backgroundColor: Colors.dark.card,
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
  featuredImage: {
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 2,
  },
  featuredImageLayer: {
    borderRadius: 18,
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  featuredTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  featuredScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#00000088',
  },
  featuredScoreText: {
    color: Colors.dark.text,
    fontSize: 11,
    fontWeight: '800',
  },
  featuredBottom: {
    gap: 4,
  },
  featuredHeadline: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: '#00000055',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  featuredSubline: {
    color: Colors.dark.text,
    fontSize: 12,
    opacity: 0.9,
    fontWeight: '600',
  },
  carouselSection: {
    gap: 10,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  carouselTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '900',
  },
  carouselHint: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  carouselContent: {
    paddingRight: 4,
    gap: 12,
  },
  carouselCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  carouselCardImage: {
    height: 140,
  },
  carouselCardImageLayer: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  carouselCardOverlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  carouselCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  carouselRoutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '72%',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#00000088',
  },
  carouselRouteText: {
    color: Colors.dark.text,
    fontSize: 11,
    fontWeight: '800',
  },
  carouselFarePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.dark.gold,
  },
  carouselFareText: {
    color: Colors.dark.background,
    fontSize: 11,
    fontWeight: '900',
  },
  carouselCardBody: {
    padding: 12,
    gap: 5,
  },
  carouselRideTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '900',
  },
  carouselRideMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  carouselCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  carouselRideSecondary: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
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


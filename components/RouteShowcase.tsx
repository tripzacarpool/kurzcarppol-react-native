import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MapPin, AlertCircle, Users, DollarSign, Clock } from 'lucide-react-native';
import type { RouteType, CoverageLevel } from '@/types';
import { ROUTE_TYPES, COVERAGE_EXPANSION_LEVELS } from '@/constants/routeTypes';

interface RouteCard {
  id: string;
  type: RouteType;
  from: string;
  to: string;
  distance: number;
  estimatedFare: number;
  availableRides: number;
  duration: string;
  coverageLevel: CoverageLevel;
  features: string[];
}

interface DistrictRouteShowcaseProps {
  routes: RouteCard[];
  onSelectRoute: (route: RouteCard) => void;
}

export const DistrictRouteShowcase: React.FC<DistrictRouteShowcaseProps> = ({
  routes,
  onSelectRoute,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>🚗 District Rides</Text>
        <Text style={styles.subtitle}>Affordable inter-district routes</Text>
      </View>

      {routes.map((route) => (
        <TouchableOpacity
          key={route.id}
          style={styles.routeCard}
          onPress={() => onSelectRoute(route)}
          activeOpacity={0.8}
        >
          <View style={styles.routeHeader}>
            <View style={styles.routeLocations}>
              <View style={styles.location}>
                <MapPin size={18} color="#3B82F6" />
                <Text style={styles.locationText}>{route.from}</Text>
              </View>
              <View style={styles.arrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>
              <View style={styles.location}>
                <MapPin size={18} color="#10B981" />
                <Text style={styles.locationText}>{route.to}</Text>
              </View>
            </View>
            <View style={styles.priceTag}>
              <Text style={styles.price}>₹{route.estimatedFare}</Text>
            </View>
          </View>

          <View style={styles.routeDetails}>
            <View style={styles.detailItem}>
              <Clock size={14} color="#6B7280" />
              <Text style={styles.detailText}>{route.duration}</Text>
            </View>
            <View style={styles.detailItem}>
              <MapPin size={14} color="#6B7280" />
              <Text style={styles.detailText}>{route.distance} km</Text>
            </View>
            <View style={styles.detailItem}>
              <Users size={14} color="#6B7280" />
              <Text style={styles.detailText}>{route.availableRides} rides available</Text>
            </View>
          </View>

          {route.features.length > 0 && (
            <View style={styles.features}>
              {route.features.map((feature, idx) => (
                <Text key={idx} style={styles.featureTag}>
                  {feature}
                </Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

interface VillagePickupMapProps {
  nearbyPickups: Array<{
    id: string;
    name: string;
    distance: number;
    lat: number;
    lng: number;
  }>;
  onSelectPickup: (pickup: any) => void;
}

export const VillagePickupSelector: React.FC<VillagePickupMapProps> = ({
  nearbyPickups,
  onSelectPickup,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <View style={styles.villageContainer}>
      <View style={styles.villageHeader}>
        <Text style={styles.villageTitle}>🏘️ Village Pickups Nearby</Text>
        <Text style={styles.villageSubtitle}>
          {nearbyPickups.length} villages within 15 km
        </Text>
      </View>

      {nearbyPickups.length === 0 ? (
        <View style={styles.emptyState}>
          <AlertCircle size={40} color="#9CA3AF" />
          <Text style={styles.emptyStateText}>No nearby villages found</Text>
          <Text style={styles.emptyStateSubtext}>
            Expand your radius or try a nearby location
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.pickupList} horizontal showsHorizontalScrollIndicator={false}>
          {nearbyPickups.map((pickup, idx) => (
            <TouchableOpacity
              key={pickup.id}
              style={[
                styles.pickupCard,
                selectedIndex === idx && styles.pickupCardActive,
              ]}
              onPress={() => {
                setSelectedIndex(idx);
                onSelectPickup(pickup);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.pickupEmoji}>📍</Text>
              <Text style={styles.pickupName}>{pickup.name}</Text>
              <Text style={styles.pickupDistance}>{pickup.distance.toFixed(1)} km away</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

interface RailwayConnectorProps {
  stations: Array<{
    id: string;
    name: string;
    city: string;
    category: string;
    availableRides: number;
    surgeMultiplier: number;
  }>;
  onSelectStation: (station: any) => void;
}

export const RailwayConnectorShowcase: React.FC<RailwayConnectorProps> = ({
  stations,
  onSelectStation,
}) => {
  return (
    <View style={styles.railwayContainer}>
      <View style={styles.railwayHeader}>
        <Text style={styles.railwayTitle}>🚉 Railway Station Connectors</Text>
        <Text style={styles.railwaySubtitle}>Premium pricing for convenience</Text>
      </View>

      {stations.map((station) => (
        <TouchableOpacity
          key={station.id}
          style={styles.stationCard}
          onPress={() => onSelectStation(station)}
          activeOpacity={0.8}
        >
          <View style={styles.stationInfo}>
            <Text style={styles.stationName}>{station.name}</Text>
            <Text style={styles.stationCity}>{station.city}</Text>
            <Text style={styles.stationCategory}>
              {station.category === 'category_A' && '⭐⭐⭐ Major Metro'}
              {station.category === 'category_B' && '⭐⭐ Business Hub'}
              {station.category === 'category_C' && '⭐ Junction'}
            </Text>
          </View>

          <View style={styles.stationStats}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Rides</Text>
              <Text style={styles.statValue}>{station.availableRides}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Surge</Text>
              <Text style={styles.statValue}>{station.surgeMultiplier.toFixed(1)}x</Text>
            </View>
          </View>

          <View
            style={[
              styles.premiumBadge,
              station.surgeMultiplier > 1.3 && styles.premiumBadgeHigh,
            ]}
          >
            <DollarSign size={14} color="#fff" />
            <Text style={styles.premiumText}>Premium</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  routeCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  routeLocations: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 6,
  },
  arrow: {
    marginHorizontal: 8,
  },
  arrowText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  priceTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureTag: {
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: '600',
    marginRight: 6,
    marginBottom: 4,
  },
  villageContainer: {
    paddingVertical: 12,
  },
  villageHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  villageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  villageSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  pickupList: {
    marginHorizontal: 0,
    paddingHorizontal: 12,
  },
  pickupCard: {
    width: 140,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  pickupCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  pickupEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  pickupName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  pickupDistance: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  railwayContainer: {
    paddingVertical: 12,
  },
  railwayHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  railwayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  railwaySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  stationCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  stationCity: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  stationCategory: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 4,
  },
  stationStats: {
    flexDirection: 'row',
    marginHorizontal: 12,
  },
  statBox: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  premiumBadgeHigh: {
    backgroundColor: '#EF4444',
  },
  premiumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});

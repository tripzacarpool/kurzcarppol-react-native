import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Users, TrendingDown } from 'lucide-react-native';
import { FESTIVALS } from '@/constants/festivals';
import type { Festival } from '@/types';

interface FestivalPoolCardProps {
  festival: Festival;
  rideCount: number;
  averageDiscount: number;
  onSelectFestival: (festival: Festival) => void;
  upcomingDate?: string;
}

export const FestivalPoolCard: React.FC<FestivalPoolCardProps> = ({
  festival,
  rideCount,
  averageDiscount,
  onSelectFestival,
  upcomingDate,
}) => {
  const festivalData = FESTIVALS[festival];
  const colors = getFestivalColors(festival);

  return (
    <TouchableOpacity
      onPress={() => onSelectFestival(festival)}
      activeOpacity={0.9}
      style={styles.container}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>{festivalData.emoji}</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>{festivalData.title}</Text>
            {upcomingDate && (
              <Text style={styles.date}>
                {new Date(upcomingDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.description}>{festivalData.description}</Text>

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Users size={16} color="#fff" />
            <Text style={styles.statValue}>{rideCount}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.stat}>
            <TrendingDown size={16} color="#fff" />
            <Text style={styles.statValue}>{averageDiscount}%</Text>
            <Text style={styles.statLabel}>Avg Discount</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.stat}>
            <Gift size={16} color="#fff" />
            <Text style={styles.statValue}>Return</Text>
            <Text style={styles.statLabel}>Trip Bonus</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => onSelectFestival(festival)}
        >
          <Text style={styles.exploreButtonText}>Explore Rides →</Text>
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
};

function getFestivalColors(festival: Festival): [string, string] {
  const colorMap: Record<Festival, [string, string]> = {
    diwali: ['#FF6B35', '#FF4500'],
    holi: ['#FF69B4', '#FF1493'],
    eid: ['#4169E1', '#1E90FF'],
    chhath: ['#FFD700', '#FFA500'],
    wedding: ['#FF69B4', '#FF6347'],
  };
  return colorMap[festival] || ['#6B4CE6', '#8B5CF6'];
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 40,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  date: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  exploreButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  exploreButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Award, Leaf, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SafeDriverTier, RideStreak, CarbonCounter } from '@/types';

interface SafeDriverTierBadgeProps {
  tier: SafeDriverTier;
}

export const SafeDriverTierBadge: React.FC<SafeDriverTierBadgeProps> = ({ tier }) => {
  const tierColors = getTierColors(tier.tier);

  return (
    <LinearGradient
      colors={tierColors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.tierBadgeContainer}
    >
      <View style={styles.tierBadgeContent}>
        <Award size={24} color="#fff" strokeWidth={2} />
        <View style={styles.tierInfo}>
          <Text style={styles.tierLabel}>Safe Driver</Text>
          <Text style={styles.tierLevel}>{tier.tier.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.tierStats}>
        <View style={styles.tierStat}>
          <Text style={styles.statValue}>{tier.safeRidesCount}</Text>
          <Text style={styles.statLabel}>Safe Rides</Text>
        </View>
        <View style={styles.tierStatDivider} />
        <View style={styles.tierStat}>
          <Text style={styles.statValue}>{tier.ratingAverage.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.tierStatDivider} />
        <View style={styles.tierStat}>
          <Text style={styles.statValue}>{(tier.cancellationRate * 100).toFixed(0)}%</Text>
          <Text style={styles.statLabel}>Cancellation</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

interface RideStreakDisplayProps {
  streak: RideStreak;
  onStreakBonus?: (bonus: number) => void;
}

export const RideStreakDisplay: React.FC<RideStreakDisplayProps> = ({
  streak,
  onStreakBonus,
}) => {
  const getLongestStreakEmoji = (length: number) => {
    if (length >= 50) return '🔥🔥🔥';
    if (length >= 20) return '🔥🔥';
    if (length >= 5) return '🔥';
    return '';
  };

  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakEmoji}>{getLongestStreakEmoji(streak.currentStreak)}</Text>
        <View style={styles.streakHeaderText}>
          <Text style={styles.streakTitle}>Ride Streak Active</Text>
          <Text style={styles.streakSubtitle}>
            Don't break it! Earn up to {Math.round(streak.streakBonusMultiplier * 100)}% bonus
          </Text>
        </View>
      </View>

      <View style={styles.streakStats}>
        <View style={styles.streakStatBlock}>
          <Text style={styles.streakStatNumber}>{streak.currentStreak}</Text>
          <Text style={styles.streakStatLabel}>Current</Text>
        </View>

        <View style={styles.streakStatBlock}>
          <Text style={styles.streakStatNumber}>{streak.longestStreak}</Text>
          <Text style={styles.streakStatLabel}>Personal Best</Text>
        </View>

        <View style={styles.streakStatBlock}>
          <Text style={styles.streakStatNumber}>
            {Math.round((streak.streakBonusMultiplier - 1) * 100)}%
          </Text>
          <Text style={styles.streakStatLabel}>Bonus</Text>
        </View>
      </View>

      <View style={styles.streakWarning}>
        <Text style={styles.streakWarningIcon}>⏱️</Text>
        <Text style={styles.streakWarningText}>
          Next ride required by {streak.lastRideDate}
        </Text>
      </View>
    </View>
  );
};

interface CarbonCounterDisplayProps {
  carbon: CarbonCounter;
}

export const CarbonCounterDisplay: React.FC<CarbonCounterDisplayProps> = ({ carbon }) => {
  const progressPercentage = Math.min((carbon.emissionsSavedKg / 5000) * 100, 100);
  const points = carbon.contributePoints;

  return (
    <LinearGradient
      colors={['#10B981', '#059669']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.carbonContainer}
    >
      <View style={styles.carbonHeader}>
        <Leaf size={28} color="#fff" strokeWidth={2} />
        <View style={styles.carbonHeaderText}>
          <Text style={styles.carbonTitle}>Eco Warrior</Text>
          <Text style={styles.carbonSubtitle}>{points} Points</Text>
        </View>
      </View>

      <View style={styles.carbonStats}>
        <View style={styles.carbonStat}>
          <Text style={styles.carbonValue}>{carbon.totalRides}</Text>
          <Text style={styles.carbonLabel}>Rides</Text>
        </View>
        <View style={styles.carbonStat}>
          <Text style={styles.carbonValue}>{carbon.carpooledPassengers}</Text>
          <Text style={styles.carbonLabel}>Carpooled</Text>
        </View>
        <View style={styles.carbonStat}>
          <Text style={styles.carbonValue}>{carbon.emissionsSavedKg.toFixed(0)}</Text>
          <Text style={styles.carbonLabel}>kg CO₂</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progress to 5000 kg</Text>
          <Text style={styles.progressPercent}>{Math.round(progressPercentage)}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercentage}%` },
            ]}
          />
        </View>
        <Text style={styles.nextMilestone}>
          {5000 - carbon.emissionsSavedKg > 0
            ? `${(5000 - carbon.emissionsSavedKg).toFixed(0)} kg to next level`
            : '🎉 Milestone reached!'}
        </Text>
      </View>
    </LinearGradient>
  );
};

interface BadgeListProps {
  badges: Array<{
    type: string;
    displayName: string;
    level: string;
    awardedAt: string;
  }>;
}

export const BadgeList: React.FC<BadgeListProps> = ({ badges }) => {
  if (badges.length === 0) {
    return (
      <View style={styles.emptyBadges}>
        <Award size={32} color="#D1D5DB" />
        <Text style={styles.emptyBadgesText}>No badges yet. Keep riding! 🚗</Text>
      </View>
    );
  }

  return (
    <View style={styles.badgesGrid}>
      {badges.map((badge, index) => (
        <View key={index} style={styles.badgeItem}>
          <View style={styles.badgeIconContainer}>
            <Text style={styles.badgeIcon}>{getBadgeEmoji(badge.type)}</Text>
          </View>
          <Text style={styles.badgeName}>{badge.displayName}</Text>
          <Text style={styles.badgeLevel}>{badge.level}</Text>
        </View>
      ))}
    </View>
  );
};

function getTierColors(tier: string): { gradient: [string, string]; accent: string } {
  const tierMap: Record<string, { gradient: [string, string]; accent: string }> = {
    platinum: {
      gradient: ['#C0A080', '#FFD700'],
      accent: '#FFD700',
    },
    gold: {
      gradient: ['#FF8C00', '#FFD700'],
      accent: '#FFB6C1',
    },
    silver: {
      gradient: ['#C0C0C0', '#E8E8E8'],
      accent: '#E8E8E8',
    },
    bronze: {
      gradient: ['#8B4513', '#CD7F32'],
      accent: '#D2B48C',
    },
  };
  return tierMap[tier] || tierMap.bronze;
}

function getBadgeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    campus: '🎓',
    safe_driver: '⭐',
    eco_warrior: '🌱',
    festival_pro: '🎉',
    group_booking: '👥',
  };
  return emojiMap[type] || '🏆';
}

const styles = StyleSheet.create({
  tierBadgeContainer: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
  },
  tierBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tierInfo: {
    marginLeft: 12,
  },
  tierLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tierLevel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  tierStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  tierStat: {
    flex: 1,
    alignItems: 'center',
  },
  tierStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  streakContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakEmoji: {
    fontSize: 32,
    marginRight: 10,
  },
  streakHeaderText: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#78350F',
  },
  streakSubtitle: {
    fontSize: 12,
    color: '#A16207',
    marginTop: 2,
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  streakStatBlock: {
    alignItems: 'center',
  },
  streakStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  streakStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  streakWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  streakWarningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  streakWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
  },
  carbonContainer: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
  },
  carbonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  carbonHeaderText: {
    marginLeft: 12,
  },
  carbonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  carbonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  carbonStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  carbonStat: {
    alignItems: 'center',
  },
  carbonValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  carbonLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  progressSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  nextMilestone: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  emptyBadges: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  emptyBadgesText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  badgeItem: {
    width: '30%',
    alignItems: 'center',
    marginVertical: 12,
  },
  badgeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  badgeLevel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
});

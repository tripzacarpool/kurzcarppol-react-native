import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Shield, Info } from 'lucide-react-native';
import { INSURANCE_PLANS, INSURANCE_BADGE_BENEFITS } from '@/constants/insurance';
import type { InsurancePlan } from '@/types';

interface InsuredRideBadgeProps {
  plan: InsurancePlan;
  onInfoPress?: () => void;
  compact?: boolean;
}

export const InsuredRideBadge: React.FC<InsuredRideBadgeProps> = ({
  plan,
  onInfoPress,
  compact = false,
}) => {
  const planDetails = INSURANCE_PLANS[plan];
  const coverageAmount = (planDetails.coverage / 1000).toFixed(0);

  if (compact) {
    return (
      <View style={styles.compactBadge}>
        <Shield size={16} color="#10B981" />
        <Text style={styles.compactText}>Insured</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onInfoPress}
      activeOpacity={0.7}
    >
      <View style={styles.badgeContent}>
        <View style={styles.iconContainer}>
          <Shield size={24} color="#fff" strokeWidth={2.5} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.badgeTitle}>{INSURANCE_BADGE_BENEFITS.displayName}</Text>
          <Text style={styles.coverage}>₹{coverageAmount}K Coverage</Text>
          <Text style={styles.benefit}>
            +{INSURANCE_BADGE_BENEFITS.trustFactor}
          </Text>
        </View>

        {onInfoPress && (
          <View style={styles.infoButton}>
            <Info size={18} color="#F59E0B" />
          </View>
        )}
      </View>

      <View style={styles.details}>
        <Text style={styles.detailsText}>
          {INSURANCE_BADGE_BENEFITS.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

interface AvailableInsurancePlansProps {
  onSelectPlan: (plan: InsurancePlan) => void;
}

export const AvailableInsurancePlans: React.FC<AvailableInsurancePlansProps> = ({
  onSelectPlan,
}) => {
  const plans: InsurancePlan[] = ['basic', 'premium', 'annual'];

  return (
    <View style={styles.plansContainer}>
      <Text style={styles.plansTitle}>Choose Insurance Plan</Text>

      {plans.map((plan) => {
        const details = INSURANCE_PLANS[plan];
        const coverage = (details.coverage / 1000).toFixed(0);

        return (
          <TouchableOpacity
            key={plan}
            style={styles.planCard}
            onPress={() => onSelectPlan(plan)}
            activeOpacity={0.7}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{details.name}</Text>
              <Text style={styles.planPrice}>₹{details.premium}</Text>
            </View>

            <Text style={styles.planDescription}>{details.description}</Text>

            <View style={styles.planFeatures}>
              <View style={styles.feature}>
                <Text style={styles.featureLabel}>Coverage:</Text>
                <Text style={styles.featureValue}>₹{coverage}K</Text>
              </View>
              <View style={styles.feature}>
                <Text style={styles.featureLabel}>Deductible:</Text>
                <Text style={styles.featureValue}>
                  {details.deductible === 0 ? 'Nil' : `₹${details.deductible}`}
                </Text>
              </View>
              <View style={styles.feature}>
                <Text style={styles.featureLabel}>Claims/Month:</Text>
                <Text style={styles.featureValue}>{details.maxClaimsPerMonth}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => onSelectPlan(plan)}
            >
              <Text style={styles.selectButtonText}>Select Plan</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    marginVertical: 8,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
  },
  coverage: {
    fontSize: 13,
    color: '#059669',
    marginTop: 2,
  },
  benefit: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
  infoButton: {
    padding: 8,
  },
  details: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  detailsText: {
    fontSize: 12,
    color: '#059669',
    lineHeight: 16,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 6,
  },
  plansContainer: {
    marginVertical: 12,
  },
  plansTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1F2937',
  },
  planCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  planDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
  },
  planFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  feature: {
    flex: 1,
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  featureValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  selectButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

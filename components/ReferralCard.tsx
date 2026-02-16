import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Image,
  TextInput,
} from 'react-native';
import { Copy, Share2, Gift, Users, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ReferralCardProps {
  referralCode: string;
  referrerBonus: number;
  referreeBonus: number;
  referralsCount: number;
  totalEarnings: number;
  onShare: () => void;
  onCopy: () => void;
  onNavigateToHistory: () => void;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({
  referralCode,
  referrerBonus,
  referreeBonus,
  referralsCount,
  totalEarnings,
  onShare,
  onCopy,
  onNavigateToHistory,
}) => {
  return (
    <LinearGradient
      colors={['#6B4CE6', '#8B5CF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Refer & Earn</Text>
        <Text style={styles.subtitle}>Invite friends, get rewards!</Text>
      </View>

      {/* Referral Code Section */}
      <View style={styles.codeSection}>
        <Text style={styles.codeLabel}>Your Referral Code</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{referralCode}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={onCopy}>
            <Copy size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Earnings Summary */}
      <View style={styles.earningsSummary}>
        <View style={styles.earningsCard}>
          <Gift size={20} color="#FCD34D" />
          <Text style={styles.earningValue}>₹{totalEarnings}</Text>
          <Text style={styles.earningLabel}>Total Earned</Text>
        </View>
        <View style={styles.earningsCard}>
          <Users size={20} color="#34D399" />
          <Text style={styles.earningValue}>{referralsCount}</Text>
          <Text style={styles.earningLabel}>Referrals</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.shareButton} onPress={onShare}>
          <Share2 size={18} color="#fff" />
          <Text style={styles.shareButtonText}>Share Code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.historyButton} onPress={onNavigateToHistory}>
          <Text style={styles.historyButtonText}>View History</Text>
        </TouchableOpacity>
      </View>

      {/* Benefit Info */}
      <View style={styles.benefitInfo}>
        <View style={styles.benefitRow}>
          <Text style={styles.benefitEmoji}>👤</Text>
          <View style={styles.benefitText}>
            <Text style={styles.benefitLabel}>You Get</Text>
            <Text style={styles.benefitValue}>₹{referrerBonus} per referral</Text>
          </View>
        </View>
        <View style={styles.benefitRow}>
          <Text style={styles.benefitEmoji}>👥</Text>
          <View style={styles.benefitText}>
            <Text style={styles.benefitLabel}>They Get</Text>
            <Text style={styles.benefitValue}>₹{referreeBonus} on first ride</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

interface RedeemReferralCodeProps {
  onRedeem: (code: string) => Promise<void>;
  onError: (error: string) => void;
}

export const RedeemReferralCode: React.FC<RedeemReferralCodeProps> = ({
  onRedeem,
  onError,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      onError('Please enter a referral code');
      return;
    }

    setLoading(true);
    try {
      await onRedeem(code);
      setCode('');
    } catch (err: any) {
      onError(err.message || 'Failed to redeem code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.redeemContainer}>
      <Text style={styles.redeemTitle}>Have a Referral Code?</Text>
      <Text style={styles.redeemSubtitle}>Enter it to get instant discount</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter referral code (e.g., RAAH12345)"
          placeholderTextColor="#9CA3AF"
          value={code}
          onChangeText={setCode}
          editable={!loading}
          maxLength={20}
        />
        <TouchableOpacity
          style={[styles.redeemButton, loading && styles.redeemButtonDisabled]}
          onPress={handleRedeem}
          disabled={loading}
        >
          <Zap size={16} color="#fff" />
          <Text style={styles.redeemButtonText}>
            {loading ? 'Redeeming...' : 'Redeem'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface ReferralHistoryProps {
  referrals: Array<{
    id: string;
    friendName: string;
    redeemedAt: string;
    bonusAmount: number;
    status: 'completed' | 'pending' | 'cancelled';
  }>;
}

export const ReferralHistory: React.FC<ReferralHistoryProps> = ({ referrals }) => {
  return (
    <View style={styles.historyContainer}>
      <Text style={styles.historyTitle}>Referral History</Text>

      {referrals.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Users size={48} color="#D1D5DB" />
          <Text style={styles.emptyHistoryText}>No referrals yet</Text>
          <Text style={styles.emptyHistorySubtext}>
            Share your code to start earning!
          </Text>
        </View>
      ) : (
        referrals.map((referral) => (
          <View key={referral.id} style={styles.historyItem}>
            <View style={styles.historyItemContent}>
              <View style={styles.historyItemHeader}>
                <Text style={styles.friendName}>{referral.friendName}</Text>
                <Text
                  style={[
                    styles.statusBadge,
                    referral.status === 'completed' && styles.statusCompleted,
                    referral.status === 'pending' && styles.statusPending,
                    referral.status === 'cancelled' && styles.statusCancelled,
                  ]}
                >
                  {referral.status.charAt(0).toUpperCase() + referral.status.slice(1)}
                </Text>
              </View>
              <Text style={styles.redeemDate}>
                {new Date(referral.redeemedAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.bonusAmount}>
              <Text style={styles.bonusText}>+₹{referral.bonusAmount}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  codeSection: {
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  code: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  copyButton: {
    padding: 8,
  },
  earningsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  earningsCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  earningValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  earningLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  buttons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  historyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
  },
  historyButtonText: {
    color: '#8B5CF6',
    fontWeight: '700',
    fontSize: 14,
  },
  benefitInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  benefitText: {
    flex: 1,
  },
  benefitLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  benefitValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  redeemContainer: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  redeemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  redeemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  redeemButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  redeemButtonDisabled: {
    opacity: 0.6,
  },
  redeemButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  historyContainer: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 8,
  },
  emptyHistorySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  friendName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusCompleted: {
    backgroundColor: '#ECFDF5',
    color: '#10B981',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
    color: '#F59E0B',
  },
  statusCancelled: {
    backgroundColor: '#FEE2E2',
    color: '#EF4444',
  },
  redeemDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  bonusAmount: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bonusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
});

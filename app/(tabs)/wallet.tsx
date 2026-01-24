import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, CreditCard } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { mockUser } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/lib/ipService';

const transactions = [
  { id: 't1', type: 'credit', amount: 120, description: 'Wallet Added', date: 'Today, 2:30 PM' },
  { id: 't2', type: 'debit', amount: 80, description: 'Ride Payment', date: 'Today, 9:15 AM' },
  { id: 't3', type: 'credit', amount: 200, description: 'Wallet Added', date: 'Yesterday, 6:45 PM' },
  { id: 't4', type: 'debit', amount: 100, description: 'Ride Payment', date: 'Jan 12, 10:30 AM' },
  { id: 't5', type: 'credit', amount: 150, description: 'Refund', date: 'Jan 11, 3:20 PM' },
];

export default function WalletScreen() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.firstName?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>KruZ Wallet</Text>
          <Text style={styles.subtitle}>Hey {userName}!</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Wallet size={32} color={Colors.dark.gold} />
            <Text style={styles.balanceLabel}>Available Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{mockUser.walletBalance}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.addMoneyButton} activeOpacity={0.7}>
              <Plus size={20} color={Colors.dark.background} />
              <Text style={styles.addMoneyText}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bankButton} activeOpacity={0.7}>
              <CreditCard size={20} color={Colors.dark.gold} />
              <Text style={styles.bankText}>To Bank</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.map((transaction, index) => (
            <View key={transaction.id}>
              <View style={styles.transactionCard}>
                <View
                  style={[
                    styles.transactionIcon,
                    transaction.type === 'credit'
                      ? styles.creditIcon
                      : styles.debitIcon,
                  ]}>
                  {transaction.type === 'credit' ? (
                    <ArrowDownRight size={20} color={Colors.dark.success} />
                  ) : (
                    <ArrowUpRight size={20} color={Colors.dark.error} />
                  )}
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.type === 'credit'
                      ? styles.creditAmount
                      : styles.debitAmount,
                  ]}>
                  {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount}
                </Text>
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
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  balanceCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.dark.gold,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addMoneyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addMoneyText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '700',
  },
  bankButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
    gap: 8,
  },
  bankText: {
    color: Colors.dark.gold,
    fontSize: 15,
    fontWeight: '700',
  },
  transactionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  creditIcon: {
    backgroundColor: Colors.dark.success + '20',
  },
  debitIcon: {
    backgroundColor: Colors.dark.error + '20',
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDate: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  creditAmount: {
    color: Colors.dark.success,
  },
  debitAmount: {
    color: Colors.dark.error,
  },
});

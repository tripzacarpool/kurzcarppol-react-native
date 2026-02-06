import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, ActivityIndicator } from 'react-native';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, CreditCard } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/lib/ipService';
import { getWalletBalance, getWalletTransactions } from '@/lib/api';

export default function WalletScreen() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadWalletData();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const loadWalletData = async () => {
    if (user) {
      try {
        setLoading(true);
        const [balance, txns] = await Promise.all([
          getWalletBalance(user.id),
          getWalletTransactions(user.id),
        ]);
        setWalletBalance(balance);
        setTransactions(txns);
      } catch (error) {
        console.error('Error loading wallet data:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.firstName?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>RaahEasy Wallet</Text>
          <Text style={styles.subtitle}>Hey {userName}!</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.gold}
          />
        }
      >
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Wallet size={32} color={Colors.dark.gold} />
            <Text style={styles.balanceLabel}>Available Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>
            {loading ? '...' : `₹${walletBalance.toFixed(2)}`}
          </Text>
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
          {loading && transactions.length === 0 && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={Colors.dark.gold} />
              <Text style={styles.emptyText}>Loading transactions...</Text>
            </View>
          )}
          {!loading && transactions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          )}
          {transactions.map((transaction, index) => (
            <View key={transaction.id || transaction._id}>
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
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.createdAt || transaction.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.type === 'credit'
                      ? styles.creditAmount
                      : styles.debitAmount,
                  ]}>
                  {transaction.type === 'credit' ? '+' : '-'}₹{Math.abs(transaction.amount || 0).toFixed(2)}
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
  emptyState: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginTop: 12,
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

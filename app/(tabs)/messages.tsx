import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { MessageSquare, User, Clock, Phone } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import ChatModal from '@/components/ChatModal';
import { markMessagesAsRead, setAuthToken } from '@/lib/api';
import { useFocusEffect } from '@react-navigation/native';
import { useMessages } from '@/contexts/MessagesContext';
import { setBadgeCount } from '@/lib/notificationService';
import { useAuth as useClerkAuth } from '@/lib/clerkHooks';

interface Conversation {
  _id: string;
  rideId: string;
  participants: string[];
  driverId: string;
  passengerId: string;
  lastMessage: string;
  lastMessageAt: string;
}

interface ConversationWithDetails extends Conversation {
  otherUserName: string;
  otherUserId: string;
  rideDetails?: {
    from: string;
    to: string;
  };
  otherUserPhone?: string;
  unreadCount?: number;
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const { 
    conversations, 
    totalUnreadMessages, 
    loadingMessages: loading, 
    loadConversations,
    refreshMessages
  } = useMessages();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);

  // Update app icon badge when unread count changes
  useEffect(() => {
    setBadgeCount(totalUnreadMessages);
  }, [totalUnreadMessages]);

  useEffect(() => {
    console.log('📱 Messages screen mounted');
    // Context handles the loading and socket connections
    // Just trigger an initial load
    if (user?.id) {
      loadConversations();
    }
  }, [loadConversations, user?.id]);

  // Real-time socket connection is now handled by MessagesContext
  // No need for local socket setup

  // Mark all messages as read when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id && conversations.length > 0) {
        const markAllAsRead = async () => {
          try {
            console.log('👁️ Messages screen focused, marking conversations as read');
            
            // Mark all conversations with unread messages as read
            const conversationsToMarkRead = conversations.filter(conv => conv.unreadCount && conv.unreadCount > 0);
            const token = await getToken();
            if (token) {
              setAuthToken(token);
            }
            
            for (const conv of conversationsToMarkRead) {
              await markMessagesAsRead({
                conversationId: conv._id,
                userId: user.id
              });
            }
            
            if (conversationsToMarkRead.length > 0) {
              console.log('✅ Marked', conversationsToMarkRead.length, 'conversations as read');
              // Clear the badge
              await setBadgeCount(0);
              // Refresh conversations to update UI
              setTimeout(() => {
                refreshMessages();
              }, 500);
            }
          } catch (error) {
            console.error('❌ Error marking messages as read:', error);
          }
        };
        
        markAllAsRead();
      }
    }, [conversations, refreshMessages, user?.id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMessages();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refreshMessages]);

  const handleOpenChat = (conversation: ConversationWithDetails) => {
    setSelectedConversation(conversation);
    setChatModalVisible(true);
  };

  const handleCloseChat = () => {
    setChatModalVisible(false);
    // Reload conversations to refresh last message
    refreshMessages();
  };

  const handleCall = (phoneNumber: string | undefined) => {
    if (!phoneNumber) {
      Alert.alert('Phone number not available', 'This user has not provided a phone number.');
      return;
    }
    
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Not Supported', 'Phone call not supported on this device');
        }
      })
      .catch((error) => {
        console.error('Error opening phone dialer:', error);
        Alert.alert('Error', 'Failed to open phone dialer');
      });
  };

  const renderConversation = ({ item }: { item: ConversationWithDetails }) => {
    const timeAgo = getTimeAgo(new Date(item.lastMessageAt));

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleOpenChat(item)}
      >
        <View style={styles.avatar}>
          <User size={24} color={Colors.dark.gold} />
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {item.otherUserName}
            </Text>
            <View style={styles.timeContainer}>
              <Clock size={12} color={Colors.dark.textSecondary} />
              <Text style={styles.conversationTime}>{timeAgo}</Text>
            </View>
          </View>
          
          {item.rideDetails && (
            <Text style={styles.rideRoute} numberOfLines={1}>
              {item.rideDetails.from} → {item.rideDetails.to}
            </Text>
          )}
          
          <Text style={styles.lastMessage} numberOfLines={2}>
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>

        <View style={styles.rightActions}>
          {item.otherUserPhone && (
            <TouchableOpacity
              style={styles.phoneButton}
              onPress={(e) => {
                e.stopPropagation();
                handleCall(item.otherUserPhone);
              }}
            >
              <Phone size={20} color={Colors.dark.gold} />
            </TouchableOpacity>
          )}
          {item.unreadCount && item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
          <Text style={styles.emptyText}>Loading conversations...</Text>
        </View>
      );
    }

    if (!user?.id) {
      return (
        <View style={styles.centerContainer}>
          <MessageSquare size={64} color={Colors.dark.error} />
          <Text style={styles.emptyTitle}>Authentication Required</Text>
          <Text style={styles.emptyText}>
            Please log in to view your messages
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <MessageSquare size={64} color={Colors.dark.textSecondary} />
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptyText}>
          Book a ride to start chatting with drivers and passengers
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item._id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.gold}
            colors={[Colors.dark.gold]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {selectedConversation && (
        <ChatModal
          visible={chatModalVisible}
          onClose={handleCloseChat}
          rideId={selectedConversation.rideId}
          driverId={selectedConversation.driverId}
          driverName={
            selectedConversation.driverId === user?.id
              ? user.firstName || 'You'
              : selectedConversation.otherUserName
          }
          driverPhone={
            selectedConversation.driverId !== user?.id
              ? selectedConversation.otherUserPhone
              : undefined
          }
          passengerId={selectedConversation.passengerId}
          passengerName={
            selectedConversation.passengerId === user?.id
              ? user.firstName || 'You'
              : selectedConversation.otherUserName
          }
          passengerPhone={
            selectedConversation.passengerId !== user?.id
              ? selectedConversation.otherUserPhone
              : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

// Helper function to get time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    padding: 20,
    paddingTop: 16,
    backgroundColor: Colors.dark.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  list: {
    paddingHorizontal: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    flex: 1,
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conversationTime: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  rideRoute: {
    fontSize: 13,
    color: Colors.dark.gold,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  unreadBadge: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.background,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { X, Send, Phone, MessageSquare } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateConversation, sendMessage, getMessages, markMessagesAsRead, setAuthToken } from '@/lib/api';
import { useAuth as useClerkAuth } from '@/lib/clerkHooks';
import { getLocationSocket } from '@/lib/locationSocket';

interface Message {
  _id: string;
  senderId: string;
  senderName?: string;
  messageText: string;
  messageType?: 'text' | 'system';
  sentAt: string;
  readBy: string[];
}

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  passengerId: string;
  passengerName: string;
  passengerPhone?: string;
}

export default function ChatModal({
  visible,
  onClose,
  rideId,
  driverId,
  driverName,
  driverPhone,
  passengerId,
  passengerName,
  passengerPhone,
}: ChatModalProps) {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const isDriver = user?.id === driverId;
  const otherUserName = isDriver ? passengerName : driverName;
  const otherUserPhone = isDriver ? passengerPhone : driverPhone;

  useEffect(() => {
    if (visible && user) {
      initializeChat();
      // Removed polling - we'll use socket events for real-time updates
    }
  }, [visible, user]);

  // Set up socket listener for real-time messages
  useEffect(() => {
    if (!conversationId) return;

    const socket = getLocationSocket();
    const eventName = `chat:message:${conversationId}`;

    const handleNewMessage = (data: any) => {
      console.log('📨 Received new message via socket:', data);
      if (data.senderId !== user?.id) {
        // Only add message if it's from someone else
        loadMessages();
      }
    };

    socket.on(eventName, handleNewMessage);

    return () => {
      socket.off(eventName, handleNewMessage);
    };
  }, [conversationId, user?.id]);

  const initializeChat = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Set auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Get or create conversation with passenger name for welcome message
      const { conversation } = await getOrCreateConversation({
        rideId,
        driverId,
        passengerId,
        passengerName, // Pass passenger name for welcome message
      });

      setConversationId(conversation._id);
      await loadMessages(conversation._id);
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId?: string) => {
    const id = convId || conversationId;
    if (!id || !user) return;

    try {
      const { messages: newMessages } = await getMessages(id);
      setMessages(newMessages);
      
      // Mark messages as read
      await markMessagesAsRead({
        conversationId: id,
        userId: user.id,
      });
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || !user || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Set auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await sendMessage({
        conversationId,
        senderId: user.id,
        senderName: user.firstName || 'User',
        messageText,
        messageType: 'text',
      });

      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleCall = () => {
    if (!otherUserPhone) {
      alert('Phone number not available');
      return;
    }
    
    const phoneUrl = `tel:${otherUserPhone}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          alert('Phone call not supported on this device');
        }
      })
      .catch((error) => {
        console.error('Error opening phone dialer:', error);
        alert('Failed to open phone dialer');
      });
  };

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.senderId === user?.id;
    const isSystemMessage = message.messageType === 'system';

    if (isSystemMessage) {
      return (
        <View key={message._id} style={styles.systemMessageContainer}>
          <Text style={styles.systemMessage}>{message.messageText}</Text>
        </View>
      );
    }

    return (
      <View
        key={message._id}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          {!isOwnMessage && message.senderName && (
            <Text style={styles.senderName}>{message.senderName}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {message.messageText}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}
          >
            {new Date(message.sentAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{otherUserName}</Text>
              <Text style={styles.headerSubtitle}>
                {isDriver ? 'Passenger' : 'Driver'}
              </Text>
            </View>
          </View>
          {otherUserPhone && (
            <TouchableOpacity onPress={handleCall} style={styles.callButton}>
              <Phone size={24} color={Colors.dark.gold} />
            </TouchableOpacity>
          )}
        </View>

        {/* Messages */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.gold} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <MessageSquare size={48} color={Colors.dark.textSecondary} />
                <Text style={styles.emptyText}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            ) : (
              messages.map(renderMessage)
            )}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.dark.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.dark.background} />
            ) : (
              <Send size={20} color={Colors.dark.background} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    backgroundColor: Colors.dark.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  callButton: {
    padding: 8,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.dark.textSecondary,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessage: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  ownBubble: {
    backgroundColor: Colors.dark.gold,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: Colors.dark.card,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: Colors.dark.background,
  },
  otherMessageText: {
    color: Colors.dark.text,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  ownMessageTime: {
    color: Colors.dark.background + 'CC',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: Colors.dark.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    backgroundColor: Colors.dark.card,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    marginRight: 8,
    color: Colors.dark.text,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

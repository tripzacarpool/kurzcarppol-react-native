import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserConversations, setAuthToken } from '@/lib/api';
import { useAuth as useClerkAuth } from '@/lib/clerkHooks';
import { initializeLocationSocket, getLocationSocket, joinUserSocketRoom } from '@/lib/locationSocket';

interface Conversation {
  _id: string;
  rideId: string;
  participants: string[];
  driverId: string;
  passengerId: string;
  lastMessage: string;
  lastMessageAt: string;
  otherUserName: string;
  otherUserId: string;
  rideDetails?: {
    from: string;
    to: string;
  };
  otherUserPhone?: string;
  unreadCount?: number;
}

interface MessagesContextType {
  conversations: Conversation[];
  totalUnreadMessages: number;
  loadingMessages: boolean;
  loadConversations: () => Promise<void>;
  refreshMessages: () => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const socketInitialized = useRef(false);

  // Calculate total unread messages
  const totalUnreadMessages = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

  const loadConversations = async () => {
    if (!user?.id) {
      setLoadingMessages(false);
      return;
    }

    try {
      setLoadingMessages(true);
      console.log('📬 [MessagesContext] Loading conversations for user:', user.id);
      
      // Set auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      const { conversations: convos } = await getUserConversations(user.id);
      console.log('📬 [MessagesContext] Received conversations:', convos?.length || 0);
      
      // Calculate unread messages for logging
      const totalUnread = convos?.reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0) || 0;
      console.log('🔔 [MessagesContext] Total unread messages:', totalUnread);
      
      setConversations(convos || []);
    } catch (error) {
      console.error('❌ [MessagesContext] Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const refreshMessages = () => {
    console.log('🔄 [MessagesContext] Refreshing messages');
    loadConversations();
  };

  // Initialize socket connection and listeners
  useEffect(() => {
    if (!user?.id || socketInitialized.current) return;

    console.log('🔌 [MessagesContext] Setting up socket connection for user:', user.id);
    
    // Initialize socket connection
    initializeLocationSocket();
    joinUserSocketRoom(user.id);
    const socket = getLocationSocket();
    
    // Check if socket is available (returns null on web platform)
    if (!socket) {
      console.log('⚠️ [MessagesContext] Socket not available (likely running on web platform)');
      return;
    }
    
    socketInitialized.current = true;

    const handleNewMessage = (data: any) => {
      console.log('💬 [MessagesContext] Received new message via socket:', data);
      if (data.type === 'new_message') {
        // Immediately reload conversations to update unread counts
        refreshMessages();
      }
    };

    const handleGlobalMessageUpdate = (data: any) => {
      console.log('💬 [MessagesContext] Global message update received:', data);
      // Reload conversations for any message updates
      refreshMessages();
    };

    const handleMessageCountUpdate = (data: any) => {
      console.log('🔢 [MessagesContext] Message count update received:', data);
      if (data.userId === user.id && data.type === 'increment') {
        // Quick refresh for count updates
        refreshMessages();
      }
    };

    // Listen for user-specific message events
    socket.on(`user:message:${user.id}`, handleNewMessage);
    
    // Listen for global chat events
    socket.on('chat:newMessage', handleGlobalMessageUpdate);

    // Listen for message count updates
    socket.on('messages:countUpdate', handleMessageCountUpdate);

    console.log('🔌 [MessagesContext] Socket listeners registered');

    return () => {
      socket.off(`user:message:${user.id}`, handleNewMessage);
      socket.off('chat:newMessage', handleGlobalMessageUpdate);
      socket.off('messages:countUpdate', handleMessageCountUpdate);
      socketInitialized.current = false;
      console.log('🔌 [MessagesContext] Socket listeners cleaned up');
    };
  }, [user?.id]);

  // Load conversations when user changes or component mounts
  useEffect(() => {
    if (user?.id) {
      loadConversations();
      // Set up periodic refresh as fallback
      const interval = setInterval(loadConversations, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const contextValue: MessagesContextType = {
    conversations,
    totalUnreadMessages,
    loadingMessages,
    loadConversations,
    refreshMessages,
  };

  return (
    <MessagesContext.Provider value={contextValue}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = (): MessagesContextType => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};

export default MessagesProvider;

import { Platform } from 'react-native';
import {
  getLocationSocket,
  initializeLocationSocket,
  joinUserSocketRoom,
} from './locationSocket';

type RideEventCallback = (data: any) => void;

const eventListeners = new Map<string, Set<RideEventCallback>>();

/**
 * Universal ride event subscription system
 * Replaces all polling with real-time WebSocket events
 */

// ==================== RIDE EVENTS ====================

/**
 * Subscribe to new ride offers/requests
 * Replaces: 30s polling in index.tsx
 */
export function subscribeToNewRides(callback: RideEventCallback) {
  subscribeToEvent('ride:new', callback);
}

/**
 * Subscribe to ride updates (status changes, cancellations, etc.)
 * Replaces: 30-60s polling everywhere
 */
export function subscribeToRideUpdates(
  rideId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`ride:update:${rideId}`, callback);
}

/**
 * Subscribe to ALL ride updates for a user
 * Useful for dashboard/trips page
 */
export function subscribeToUserRideUpdates(
  userId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`user:rides:${userId}`, callback);
}

// ==================== BOOKING EVENTS ====================

/**
 * Subscribe to booking requests (driver receives passenger request)
 * Replaces: Approval polling in dashboard
 */
export function subscribeToBookingRequests(
  driverId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`driver:bookings:${driverId}`, callback);
}

/**
 * Subscribe to booking confirmations (passenger gets driver approval)
 */
export function subscribeToBookingConfirmations(
  passengerId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`passenger:bookings:${passengerId}`, callback);
}

/**
 * Subscribe to booking status changes
 */
export function subscribeToBookingUpdates(
  bookingId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`booking:update:${bookingId}`, callback);
}

// ==================== MESSAGE EVENTS ====================

/**
 * Subscribe to new messages in a conversation
 * Replaces: 10s polling in messages tab
 */
export function subscribeToConversationMessages(
  conversationId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`conversation:${conversationId}:message`, callback);
}

/**
 * Subscribe to all user conversations
 */
export function subscribeToUserConversations(
  userId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`user:conversations:${userId}`, callback);
}

/**
 * Subscribe to unread message count updates
 */
export function subscribeToUnreadMessages(
  userId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`user:unread:${userId}`, callback);
}

// ==================== DRIVER EVENTS ====================

/**
 * Subscribe to driver's live ride requests
 * Replaces: 60s polling for live rides
 */
export function subscribeToDriverLiveRides(
  driverId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`driver:live:${driverId}`, callback);
}

/**
 * Subscribe to driver location updates (for passengers tracking)
 */
export function subscribeToDriverLocation(
  rideId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`ride:${rideId}:driverLocation`, callback);
}

// ==================== RATING EVENTS ====================

/**
 * Subscribe to pending rating requests
 */
export function subscribeToPendingRatings(
  userId: string,
  callback: RideEventCallback,
) {
  subscribeToEvent(`user:ratings:${userId}`, callback);
}

// ==================== CORE SUBSCRIPTION SYSTEM ====================

/**
 * Internal: Subscribe to any event
 */
function subscribeToEvent(event: string, callback: RideEventCallback) {
  if (Platform.OS === 'web') {
    console.warn('⚠️ WebSocket events not supported on web');
    return;
  }

  const socket = getLocationSocket();
  if (!socket) {
    console.error('❌ Socket not initialized');
    return;
  }

  // Store callback
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());

    // Register socket listener (only once per event type)
    socket.on(event, (data: any) => {
      console.log(`📨 [${event}] Received:`, data);
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.forEach((cb) => {
          try {
            cb(data);
          } catch (error) {
            console.error(`❌ Error in listener for ${event}:`, error);
          }
        });
      }
    });
  }

  eventListeners.get(event)!.add(callback);
  console.log(`✅ Subscribed to ${event}`);
}

/**
 * Unsubscribe from specific event
 */
export function unsubscribeFromEvent(
  event: string,
  callback: RideEventCallback,
) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.delete(callback);

    // Clean up if no more listeners
    if (listeners.size === 0) {
      eventListeners.delete(event);
      const socket = getLocationSocket();
      if (socket) {
        socket.off(event);
        console.log(`🗑️ Unsubscribed from ${event}`);
      }
    }
  }
}

/**
 * Unsubscribe from all events
 */
export function unsubscribeFromAllEvents() {
  const socket = getLocationSocket();
  if (!socket) return;

  eventListeners.forEach((_, event) => {
    socket.off(event);
  });

  eventListeners.clear();
  console.log('🗑️ Unsubscribed from all events');
}

// ==================== CONNECTION MANAGEMENT ====================

/**
 * Check if WebSocket is connected
 */
export function isSocketConnected(): boolean {
  const socket = getLocationSocket();
  return socket?.connected || false;
}

/**
 * Reconnect WebSocket if disconnected
 */
export function reconnectSocket() {
  const socket = getLocationSocket();
  if (socket && !socket.connected) {
    socket.connect();
  }
}

/**
 * Join a room for targeted events
 * Backend should have rooms for: user:{userId}, ride:{rideId}, driver:{driverId}
 */
export function joinRoom(roomName: string) {
  const socket = getLocationSocket();
  if (socket) {
    socket.emit('join:room', roomName, (response: any) => {
      if (!response?.ok) {
        console.warn(`Failed to join room ${roomName}:`, response?.error);
      }
    });
    console.log(`🚪 Joined room: ${roomName}`);
  }
}

/**
 * Leave a room
 */
export function leaveRoom(roomName: string) {
  const socket = getLocationSocket();
  if (socket) {
    socket.emit('leave:room', roomName, (response: any) => {
      if (!response?.ok) {
        console.warn(`Failed to leave room ${roomName}:`, response?.error);
      }
    });
    console.log(`🚪 Left room: ${roomName}`);
  }
}

// ==================== SMART FALLBACK POLLING ====================

let fallbackIntervals = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Setup intelligent fallback polling
 * - Only polls if WebSocket is disconnected
 * - Uses longer intervals (5 minutes)
 * - Auto-stops when WebSocket reconnects
 */
export function setupSmartFallback(
  key: string,
  fetchFunction: () => Promise<void>,
  intervalMs: number = 300000, // 5 minutes default
) {
  const socket = getLocationSocket();
  if (!socket) return;

  // Clear existing interval
  const existing = fallbackIntervals.get(key);
  if (existing) {
    clearInterval(existing);
  }

  // Only poll when disconnected
  const checkAndPoll = () => {
    if (!socket.connected) {
      console.log(
        `⚠️ WebSocket disconnected - falling back to polling for ${key}`,
      );
      fetchFunction();
    }
  };

  // Poll on disconnect
  socket.on('disconnect', checkAndPoll);

  // Setup interval
  const interval = setInterval(checkAndPoll, intervalMs);
  fallbackIntervals.set(key, interval);

  // Cleanup
  socket.on('connect', () => {
    console.log(
      `✅ WebSocket reconnected - stopping fallback polling for ${key}`,
    );
  });
}

/**
 * Clear specific fallback
 */
export function clearSmartFallback(key: string) {
  const interval = fallbackIntervals.get(key);
  if (interval) {
    clearInterval(interval);
    fallbackIntervals.delete(key);
  }
}

/**
 * Clear all fallbacks
 */
export function clearAllFallbacks() {
  fallbackIntervals.forEach((interval) => clearInterval(interval));
  fallbackIntervals.clear();
}

// ==================== HEARTBEAT MONITORING ====================

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let lastPongTime = Date.now();

/**
 * Start heartbeat to detect stale connections
 */
export function startHeartbeat(intervalMs: number = 30000) {
  const socket = getLocationSocket();
  if (!socket) return;

  // Listen for pong responses
  socket.on('pong', () => {
    lastPongTime = Date.now();
    console.log('💓 Heartbeat pong received');
  });

  // Send ping periodically
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      const timeSinceLastPong = Date.now() - lastPongTime;

      if (timeSinceLastPong > 60000) {
        console.warn('⚠️ No pong received for 60s - connection may be stale');
        socket.disconnect();
        socket.connect();
      } else {
        socket.emit('ping');
      }
    }
  }, intervalMs);
}

/**
 * Stop heartbeat monitoring
 */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ==================== INITIALIZATION ====================

/**
 * Initialize complete ride socket system
 * Call this once on app startup
 */
export function initializeRideSocket(userId: string) {
  if (Platform.OS === 'web') return;

  // Initialize base socket
  initializeLocationSocket();

  // Join backend-managed user, passenger, and driver compatibility rooms.
  joinUserSocketRoom(userId);

  // Start heartbeat
  startHeartbeat();

  console.log(`🚀 Ride socket system initialized for user: ${userId}`);
}

/**
 * Cleanup on logout
 */
export function cleanupRideSocket(userId: string) {
  leaveRoom(`user:${userId}`);
  unsubscribeFromAllEvents();
  clearAllFallbacks();
  stopHeartbeat();

  console.log('🧹 Ride socket system cleaned up');
}

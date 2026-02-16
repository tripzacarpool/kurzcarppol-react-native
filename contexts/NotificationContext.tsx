import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getLocationSocket } from '@/lib/locationSocket';
import { useAuthContext } from './AuthContext';
import CustomAlert from '@/components/CustomAlert';
import * as NotificationService from '@/lib/notificationService';
import * as Notifications from 'expo-notifications';

export interface Notification {
  id: string;
  type: 'ride_created' | 'offer_created' | 'ride_accepted' | 'offer_booked';
  title: string;
  message: string;
  timestamp: Date;
  data?: {
    from?: string;
    to?: string;
    fare?: number;
    passengers?: number;
    rideId?: string;
  };
  read: boolean;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  clearNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
  } | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const showCustomAlert = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  // Initialize push notifications
  useEffect(() => {
    const initPushNotifications = async () => {
      try {
        // Setup Android channels
        await NotificationService.setupAndroidChannel();

        // Request permissions (this is needed for local notifications too)
        const hasPermission = await NotificationService.requestNotificationPermissions();
        if (hasPermission) {
          console.log('✅ Notification permissions granted');
          
          // Try to get push token (optional - requires Firebase)
          const token = await NotificationService.getExpoPushToken();
          if (token) {
            setExpoPushToken(token);
            console.log('📱 Remote push token obtained:', token);
            
            // Register token with backend if user is logged in
            if (user?.id) {
              console.log('📤 Registering push token with backend for user:', user.id);
              const registered = await NotificationService.registerPushToken(user.id, token);
              if (registered) {
                console.log('✅ Push token successfully registered with backend');
              } else {
                console.log('⚠️ Push token registration with backend failed');
              }
            }
          } else {
            console.log('⚠️ No remote push token obtained - Firebase/FCM not configured');
            console.log('ℹ️ Push notifications will not work - only local notifications');
            
            // For testing - send a local notification to verify that notifications work
            if (user?.id) {
              console.log('🧪 Sending test local notification...');
              setTimeout(async () => {
                await NotificationService.sendLocalNotification(
                  '🧪 Notification Test',
                  'Local notifications are working. Push notifications need Firebase setup.',
                  { type: 'test' }
                );
              }, 2000);
            }
          }
        }

        // Setup listeners for when notifications are received
        const listeners = NotificationService.setupNotificationListeners(
          (notification) => {
            // Handle notification received while app is open
            const data = notification.request.content.data as any;
            addNotification({
              type: data.type || 'ride_created',
              title: notification.request.content.title || 'Notification',
              message: notification.request.content.body || '',
              data: data,
            });
          },
          (response) => {
            // Handle notification tap - navigate based on type
            console.log('👆 User tapped notification:', response.notification.request.content);
            const data = response.notification.request.content.data as any;
            
            // Handle ride expiring notifications with deep link
            if (data.type === 'ride_expiring' && data.offerId) {
              console.log('🔗 Navigate to extend time screen for ride:', data.offerId);
              // The navigation will be handled in the root _layout
              // Store the pending navigation
              import('@react-native-async-storage/async-storage').then(async ({ default: AsyncStorage }) => {
                await AsyncStorage.setItem('pendingNavigation', JSON.stringify({
                  screen: 'ExtendTime',
                  params: {
                    offerId: data.offerId,
                    rideId: data.rideId,
                    from: data.from,
                    to: data.to,
                    departureTime: data.departureTime,
                  }
                }));
              });
            }
            
            // Handle departure reminder notifications
            if (data.type === 'departure_reminder' && data.rideId) {
              console.log('🔗 Navigate to extend time screen for departure reminder:', data.rideId);
              import('@react-native-async-storage/async-storage').then(async ({ default: AsyncStorage }) => {
                await AsyncStorage.setItem('pendingNavigation', JSON.stringify({
                  screen: 'ExtendTime',
                  params: {
                    offerId: data.rideId,
                    rideId: data.rideId,
                    action: data.action,
                    hasBookings: data.hasBookings,
                  }
                }));
              });
            }
          }
        );

        notificationListener.current = listeners.receivedListener;
        responseListener.current = listeners.responseListener;

        return () => {
          listeners.remove();
        };
      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    };

    initPushNotifications();
  }, [user?.id]);

  // Initialize socket listeners for notifications
  useEffect(() => {
    if (!user?.id) return;

    const socket = getLocationSocket();

    const handleRideRequest = (data: any) => {
      console.log('🔔 New ride request notification:', data);
      addNotification({
        type: 'ride_created',
        title: 'New Ride Request',
        message: `${data.from} → ${data.to} (${data.passengers} passenger${data.passengers > 1 ? 's' : ''})`,
        data: {
          from: data.from,
          to: data.to,
          passengers: data.passengers,
          rideId: data.rideId,
        },
      });

      if (user?.role === 'ride_partner') {
        showCustomAlert(
          'New Ride Request',
          `${data.from} → ${data.to} (${data.passengers} passenger${data.passengers > 1 ? 's' : ''})`,
          'info'
        );
      }
    };

    const handleDriverOffer = (data: any) => {
      console.log('🔔 New driver offer notification:', data);
      addNotification({
        type: 'offer_created',
        title: 'New Ride Available',
        message: `${data.from} → ${data.to}${data.fare ? ` (₹${data.fare})` : ''}`,
        data: {
          from: data.from,
          to: data.to,
          fare: data.fare,
          passengers: data.passengers,
          rideId: data.offerId,
        },
      });

      if (user?.role !== 'ride_partner') {
        showCustomAlert(
          'New Ride Available',
          `${data.from} → ${data.to}${data.fare ? ` (₹${data.fare})` : ''}`,
          'success'
        );
      }
    };

    const handleRideAccepted = (data: any) => {
      if (data.passengerClerkId && data.passengerClerkId !== user?.id) {
        return;
      }
      console.log('🔔 Ride accepted notification:', data);
      addNotification({
        type: 'ride_accepted',
        title: 'Ride Accepted',
        message: `Your ride from ${data.from} to ${data.to} has been accepted by a driver`,
        data: {
          from: data.from,
          to: data.to,
          rideId: data.rideId,
        },
      });

      showCustomAlert(
        'Ride Accepted',
        `Your ride from ${data.from} to ${data.to} has been accepted!`,
        'success'
      );
    };

    const handleRideBooked = (data: any) => {
      if (data.driverClerkId !== user?.id) return;
      console.log('🔔 Booking confirmed for driver:', data);
      const seats = Array.isArray(data.bookingDetails?.seatNumbers)
        ? `Seats ${data.bookingDetails.seatNumbers.join(', ')}`
        : 'Booking confirmed';
      addNotification({
        type: 'offer_booked',
        title: 'Passenger Confirmed Booking',
        message: `${data.bookingDetails?.passengerName || 'Passenger'} confirmed ${seats} for ${data.from} → ${data.to}`,
        data: {
          from: data.from,
          to: data.to,
          rideId: data.rideId,
        },
      });

      showCustomAlert(
        'Passenger Confirmed',
        `${data.bookingDetails?.passengerName || 'Passenger'} is ready for pickup at ${data.from}`,
        'info'
      );
    };

    const handleDriverPickup = (data: any) => {
      if (data.passengerClerkId !== user?.id) return;
      console.log('🔔 Driver marked pickup:', data);
      addNotification({
        type: 'ride_accepted',
        title: 'Driver Has Arrived',
        message: 'Your driver marked you as picked up. Confirm if you are onboard.',
        data: {
          rideId: data.rideId,
        },
      });

      showCustomAlert('Driver Picked You Up', 'Confirm onboarding when you are inside the vehicle.', 'info');
    };

    const handlePassengerPickup = (data: any) => {
      if (data.driverClerkId !== user?.id) return;
      console.log('🔔 Passenger confirmed pickup:', data);
      addNotification({
        type: 'ride_accepted',
        title: 'Passenger Onboard',
        message: 'Passenger confirmed they are in the car. Start navigation to drop point.',
        data: {
          rideId: data.rideId,
        },
      });
    };

    const handleRideCompleted = (data: any) => {
      if (data.driverClerkId !== user?.id && data.passengerClerkId !== user?.id) {
        return;
      }
      console.log('🔔 Ride completed event:', data);
      addNotification({
        type: 'ride_accepted',
        title: 'Ride Completed',
        message: 'Ride marked as complete. Thank you for travelling with RaahEasy!',
        data: {
          rideId: data.rideId,
        },
      });

      showCustomAlert('Ride Completed', 'Ride marked as finished. Fare will settle automatically.', 'success');
    };

    socket.on('new_ride_request', handleRideRequest);
    socket.on('new_driver_offer', handleDriverOffer);
    socket.on('ride_accepted', handleRideAccepted);
    socket.on('ride:accepted', handleRideAccepted);
    socket.on('offer_booked', handleRideBooked);
    socket.on('ride:booked', handleRideBooked);
    socket.on('ride:pickup-driver', handleDriverPickup);
    socket.on('ride:pickup-passenger', handlePassengerPickup);
    socket.on('ride:completed', handleRideCompleted);

    return () => {
      socket.off('new_ride_request', handleRideRequest);
      socket.off('new_driver_offer', handleDriverOffer);
      socket.off('ride_accepted', handleRideAccepted);
      socket.off('ride:accepted', handleRideAccepted);
      socket.off('offer_booked', handleRideBooked);
      socket.off('ride:booked', handleRideBooked);
      socket.off('ride:pickup-driver', handleDriverPickup);
      socket.off('ride:pickup-passenger', handlePassengerPickup);
      socket.off('ride:completed', handleRideCompleted);
    };
  }, [user?.id, user?.role]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
      ...notification,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        clearNotification,
        markAsRead,
        clearAll,
      }}>
      {children}
      {alertConfig && (
        <CustomAlert
          visible={alertVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={[{ text: 'OK', style: 'default' }]}
          onClose={() => setAlertVisible(false)}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

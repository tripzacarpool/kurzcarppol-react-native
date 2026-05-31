import React, { createContext, useContext, useEffect, useState } from 'react';
import CustomAlert from '@/components/CustomAlert';
import { getLocationSocket, joinUserSocketRoom } from '@/lib/locationSocket';
import * as NotificationService from '@/lib/notificationService';
import { useAuthContext } from './AuthContext';

export interface Notification {
  id: string;
  type:
    | 'ride_created'
    | 'offer_created'
    | 'ride_accepted'
    | 'offer_booked'
    | 'chat'
    | 'ride_hold_request'
    | 'ride_hold_response'
    | 'ride_joined'
    | 'ride_started'
    | 'ride_completed'
    | 'ride_cancelled'
    | 'sos_alert'
    | 'sos_resolved'
    | 'emergency_services_dispatched'
    | string;
  title: string;
  message: string;
  timestamp: Date;
  data?: {
    from?: string;
    to?: string;
    fare?: number;
    passengers?: number;
    rideId?: string;
    rideType?: string;
    conversationId?: string;
    offerId?: string;
    action?: string;
    status?: string;
  };
  read: boolean;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>,
  ) => void;
  enablePushNotifications: () => Promise<boolean>;
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

  const addNotification = (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>,
  ) => {
    const newNotification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
      ...notification,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
  };

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' = 'info',
  ) => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const enablePushNotifications = async () => {
    if (!user?.id) return false;

    const token = await NotificationService.ensurePushNotificationsForUser(
      user.id,
      { askPermission: true },
    );
    return Boolean(token);
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initPushNotifications = async () => {
      try {
        await NotificationService.setupAndroidChannel();

        if (user?.id) {
          await NotificationService.ensurePushNotificationsForUser(user.id, {
            askPermission: true,
          });
        }

        const listeners = NotificationService.setupNotificationListeners(
          (notification) => {
            const data = notification.request.content.data as any;
            addNotification({
              type: data.type || 'ride_created',
              title: notification.request.content.title || 'Notification',
              message: notification.request.content.body || '',
              data,
            });
          },
          (response) => {
            const data = response.notification.request.content.data as any;
            if (
              (data.type === 'ride_expiring' && data.offerId) ||
              (data.type === 'departure_reminder' && data.rideId)
            ) {
              import('@react-native-async-storage/async-storage').then(
                async ({ default: AsyncStorage }) => {
                  await AsyncStorage.setItem(
                    'pendingNavigation',
                    JSON.stringify({
                      screen: 'ExtendTime',
                      params: {
                        offerId: data.offerId || data.rideId,
                        rideId: data.rideId,
                        from: data.from,
                        to: data.to,
                        departureTime: data.departureTime,
                        action: data.action,
                        hasBookings: data.hasBookings,
                      },
                    }),
                  );
                },
              );
            }
          },
        );

        cleanup = listeners.remove;
      } catch {
        console.log('Notification setup skipped');
      }
    };

    initPushNotifications();

    return () => {
      cleanup?.();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const socket = getLocationSocket();
    if (!socket) return;
    joinUserSocketRoom(user.id);

    const handleRideRequest = (data: any) => {
      addNotification({
        type: 'ride_created',
        title: 'New Ride Request',
        message: `${data.from} -> ${data.to} (${data.passengers} passenger${data.passengers > 1 ? 's' : ''})`,
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
          `${data.from} -> ${data.to} (${data.passengers} passenger${data.passengers > 1 ? 's' : ''})`,
          'info',
        );
      }
    };

    const handleDriverOffer = (data: any) => {
      addNotification({
        type: 'offer_created',
        title: 'New Ride Available',
        message: `${data.from} -> ${data.to}${data.fare ? ` (Rs ${data.fare})` : ''}`,
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
          `${data.from} -> ${data.to}${data.fare ? ` (Rs ${data.fare})` : ''}`,
          'success',
        );
      }
    };

    const handleRideAccepted = (data: any) => {
      if (data.passengerClerkId && data.passengerClerkId !== user?.id) return;

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
        'success',
      );
    };

    const handleRideBooked = (data: any) => {
      if (data.driverClerkId !== user?.id) return;

      const seats = Array.isArray(data.bookingDetails?.seatNumbers)
        ? `Seats ${data.bookingDetails.seatNumbers.join(', ')}`
        : 'Booking confirmed';

      addNotification({
        type: 'offer_booked',
        title: 'Passenger Confirmed Booking',
        message: `${data.bookingDetails?.passengerName || 'Passenger'} confirmed ${seats} for ${data.from} -> ${data.to}`,
        data: {
          from: data.from,
          to: data.to,
          rideId: data.rideId,
        },
      });

      showCustomAlert(
        'Passenger Confirmed',
        `${data.bookingDetails?.passengerName || 'Passenger'} is ready for pickup at ${data.from}`,
        'info',
      );
    };

    const handleFareSplitUpdated = (data: any) => {
      const participants = data.fareSplit?.participants || [];
      const isParticipant = participants.some(
        (participant: any) => participant.clerkId === user?.id,
      ) || (data.passengerClerkIds || []).includes(user?.id);
      if (data.driverClerkId !== user?.id && !isParticipant) {
        return;
      }

      const myShare = participants.find(
        (participant: any) => participant.clerkId === user?.id,
      )?.shareAmount;

      addNotification({
        type: 'ride_joined',
        title: 'Fare split updated',
        message: myShare
          ? `Your new share is Rs ${myShare}. Driver payout stays locked.`
          : `New per-seat estimate is Rs ${data.fareSplit?.perSeatEstimate || 0}.`,
        data: {
          rideId: data.rideId,
          status: data.status,
        },
      });
    };

    const handleRideStartRequested = (data: any) => {
      if (data.driverClerkId !== user?.id) return;

      addNotification({
        type: 'ride_accepted',
        title: 'Confirm ride start',
        message: `${data.passengerName || 'Passenger'} is ready. Confirm seating to start the ride.`,
        data: { rideId: data.rideId, action: 'confirm_start' },
      });

      showCustomAlert(
        'Confirm ride start',
        `${data.passengerName || 'Passenger'} is ready. Confirm seating to start the ride.`,
        'info',
      );
    };

    const handleRideStarted = (data: any) => {
      if (data.driverClerkId !== user?.id && data.passengerClerkId !== user?.id) {
        return;
      }

      addNotification({
        type: 'ride_started',
        title: 'Ride started',
        message: 'The ride is now in progress. SOS and live trip updates are active.',
        data: { rideId: data.rideId, status: data.status },
      });
    };

    const handleRideCancelled = (data: any) => {
      if (
        data.driverClerkId &&
        data.passengerClerkId &&
        data.driverClerkId !== user?.id &&
        data.passengerClerkId !== user?.id
      ) {
        return;
      }

      addNotification({
        type: 'ride_cancelled',
        title: 'Ride cancelled',
        message: data.reason || 'This ride was cancelled. Check the app for details.',
        data: { rideId: data.rideId || data.offerId, status: data.status },
      });
    };

    const handleSOSAlert = (data: any) => {
      const isDriver = data.driverId === user?.id || data.driverClerkId === user?.id;
      const isPassenger =
        data.passengerId === user?.id ||
        data.passengerClerkId === user?.id ||
        data.activatedBy === user?.id;
      if (!isDriver && !isPassenger && user?.role !== 'admin') return;

      addNotification({
        type: 'sos_alert',
        title: 'SOS alert active',
        message: `${data.activatedByName || 'A rider'} activated SOS for ${data.pickupLocation?.name || 'this ride'}.`,
        data: {
          rideId: data.rideId,
          rideType: data.rideType,
          action: 'open_sos',
        },
      });

      showCustomAlert(
        'SOS alert active',
        'Emergency alert is active. Stay in the app and coordinate immediately.',
        'error',
      );
    };

    const handleSOSResolved = (data: any) => {
      addNotification({
        type: 'sos_resolved',
        title: 'SOS resolved',
        message: 'The emergency alert has been marked resolved.',
        data: { rideId: data.rideId, rideType: data.rideType },
      });
    };

    const handleDriverPickup = (data: any) => {
      if (data.passengerClerkId !== user?.id) return;

      addNotification({
        type: 'ride_accepted',
        title: 'Driver Has Arrived',
        message: 'Your driver marked you as picked up. Confirm if you are onboard.',
        data: { rideId: data.rideId },
      });

      showCustomAlert(
        'Driver Picked You Up',
        'Confirm onboarding when you are inside the vehicle.',
        'info',
      );
    };

    const handlePassengerPickup = (data: any) => {
      if (data.driverClerkId !== user?.id) return;

      addNotification({
        type: 'ride_accepted',
        title: 'Passenger Onboard',
        message: 'Passenger confirmed they are in the car. Start navigation to drop point.',
        data: { rideId: data.rideId },
      });
    };

    const handleRideCompleted = (data: any) => {
      if (data.driverClerkId !== user?.id && data.passengerClerkId !== user?.id) {
        return;
      }

      addNotification({
        type: 'ride_accepted',
        title: 'Ride Completed',
        message: 'Ride marked as complete. Thank you for travelling with Tripza!',
        data: { rideId: data.rideId },
      });

      showCustomAlert(
        'Ride Completed',
        'Ride marked as finished. Fare will settle automatically.',
        'success',
      );
    };

    const handleUserMessage = (data: any) => {
      if (data.recipientId && data.recipientId !== user?.id) return;

      addNotification({
        type: 'chat',
        title: `Message from ${data.senderName || 'Passenger'}`,
        message: data.messageText || 'New message received',
        data: {
          conversationId: data.conversationId,
          rideId: data.rideId,
        },
      });
    };

    const handleHoldRequest = (data: any) => {
      addNotification({
        type: 'ride_hold_request',
        title: 'Hold request',
        message: `${data.passengerName || 'Passenger'} wants you to wait ${data.minutes} min`,
        data: {
          rideId: data.rideId,
          offerId: data.offerId || data.rideId,
        },
      });

      if (user?.role === 'ride_partner') {
        showCustomAlert(
          'Hold request',
          `${data.passengerName || 'Passenger'} wants you to wait ${data.minutes} min.`,
          'info',
        );
      }
    };

    const handleHoldResponse = (data: any) => {
      addNotification({
        type: 'ride_hold_response',
        title: data.action === 'approve' ? 'Hold accepted' : 'Hold declined',
        message:
          data.action === 'approve'
            ? 'Driver accepted your hold request. Departure time was updated.'
            : 'Driver declined your hold request.',
        data: {
          rideId: data.rideId,
          offerId: data.offerId || data.rideId,
        },
      });
    };

    socket.on('new_ride_request', handleRideRequest);
    socket.on('new_driver_offer', handleDriverOffer);
    socket.on('ride_accepted', handleRideAccepted);
    socket.on('ride:accepted', handleRideAccepted);
    socket.on('offer_booked', handleRideBooked);
    socket.on('ride:booked', handleRideBooked);
    socket.on('ride:fare-split-updated', handleFareSplitUpdated);
    socket.on('ride:pickup-driver', handleDriverPickup);
    socket.on('ride:pickup-passenger', handlePassengerPickup);
    socket.on('ride:start_requested', handleRideStartRequested);
    socket.on('ride:started', handleRideStarted);
    socket.on('ride:completed', handleRideCompleted);
    socket.on('ride:cancelled', handleRideCancelled);
    socket.on('rideOfferCancelled', handleRideCancelled);
    socket.on('sos_alert', handleSOSAlert);
    socket.on('sos_resolved', handleSOSResolved);
    socket.on(`user:message:${user.id}`, handleUserMessage);
    socket.on(`driver:hold-request:${user.id}`, handleHoldRequest);
    socket.on(`passenger:hold-response:${user.id}`, handleHoldResponse);

    return () => {
      socket.off('new_ride_request', handleRideRequest);
      socket.off('new_driver_offer', handleDriverOffer);
      socket.off('ride_accepted', handleRideAccepted);
      socket.off('ride:accepted', handleRideAccepted);
    socket.off('offer_booked', handleRideBooked);
    socket.off('ride:booked', handleRideBooked);
      socket.off('ride:fare-split-updated', handleFareSplitUpdated);
    socket.off('ride:pickup-driver', handleDriverPickup);
    socket.off('ride:pickup-passenger', handlePassengerPickup);
      socket.off('ride:start_requested', handleRideStartRequested);
      socket.off('ride:started', handleRideStarted);
    socket.off('ride:completed', handleRideCompleted);
      socket.off('ride:cancelled', handleRideCancelled);
      socket.off('rideOfferCancelled', handleRideCancelled);
      socket.off('sos_alert', handleSOSAlert);
      socket.off('sos_resolved', handleSOSResolved);
    socket.off(`user:message:${user.id}`, handleUserMessage);
      socket.off(`driver:hold-request:${user.id}`, handleHoldRequest);
      socket.off(`passenger:hold-response:${user.id}`, handleHoldResponse);
    };
  }, [user?.id, user?.role]);

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
        enablePushNotifications,
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

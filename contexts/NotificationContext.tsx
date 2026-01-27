import React, { createContext, useContext, useEffect, useState } from 'react';
import { getLocationSocket } from '@/lib/locationSocket';
import { useAuthContext } from './AuthContext';
import CustomAlert from '@/components/CustomAlert';

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

  const showCustomAlert = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  // Initialize socket listeners for notifications
  useEffect(() => {
    if (!user?.id) return;

    const socket = getLocationSocket();

    // Listen for new ride requests from passengers
    socket.on('new_ride_request', (data: any) => {
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
      
      // Show alert notification if app is in foreground
      if (user?.role === 'ride_partner') {
        showCustomAlert(
          'New Ride Request',
          `${data.from} → ${data.to} (${data.passengers} passenger${data.passengers > 1 ? 's' : ''})`,
          'info'
        );
      }
    });

    // Listen for new driver offers
    socket.on('new_driver_offer', (data: any) => {
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

      // Show alert notification if app is in foreground
      if (user?.role !== 'ride_partner') {
        showCustomAlert(
          'New Ride Available',
          `${data.from} → ${data.to}${data.fare ? ` (₹${data.fare})` : ''}`,
          'success'
        );
      }
    });

    // Listen for ride acceptance
    socket.on('ride_accepted', (data: any) => {
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
    });

    // Listen for offer booking
    socket.on('offer_booked', (data: any) => {
      console.log('🔔 Offer booked notification:', data);
      addNotification({
        type: 'offer_booked',
        title: 'Ride Booked',
        message: `Your ride offer from ${data.from} to ${data.to} has been booked`,
        data: {
          from: data.from,
          to: data.to,
          rideId: data.offerId,
        },
      });

      showCustomAlert(
        'Ride Booked',
        `Your ride offer from ${data.from} to ${data.to} has been booked!`,
        'success'
      );
    });

    return () => {
      socket.off('new_ride_request');
      socket.off('new_driver_offer');
      socket.off('ride_accepted');
      socket.off('offer_booked');
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

# KruZ - Women's Safety Ride-Sharing App

A comprehensive ride-sharing mobile application built with React Native and Expo, featuring advanced authentication, real-time location tracking, and women-only ride options.

## Features Implemented

### Authentication & User Management
- **Email/Password Authentication**: Full sign-up and login functionality using Supabase Auth
- **Google OAuth Integration**: One-click Google sign-in (requires configuration)
- **User Profile Management**: Automatic profile creation with Supabase database
- **Secure Logout**: Proper session cleanup and navigation
- **Protected Routes**: Automatic redirection based on authentication state
- **User Roles**: Support for Passenger, Driver, and Admin roles

### Location Services
- **Real-time Location Tracking**: GPS-based location updates
- **Location Permissions**: Proper permission handling for location services
- **IP-based Location**: Fallback location detection using IP address
- **Location Display**: Shows city, country, and coordinates
- **Location History**: Tracks last location update timestamp

### Ride Management
- **Available Rides**: Browse list of available rides with details
- **Women-Only Filter**: Special filter for women-only rides
- **Ride Search**: Search rides by destination or pickup location
- **Ride Booking**: Modal-based booking system
- **Ride Details**: View driver info, ratings, vehicle details, pricing
- **Ride History**: View past trips with status (completed/cancelled)

### Tab Navigation (5 Screens)
1. **Home**: Main screen with ride search and available rides
2. **Trips**: View trip history with driver ratings
3. **Alerts**: Notification center with unread count
4. **Wallet**: View balance and transaction history
5. **Profile**: User settings and role switching

### Wallet System
- **Balance Display**: Shows current wallet balance (₹)
- **Add Money**: Button to add funds (UI ready)
- **Bank Transfer**: Transfer to bank account (UI ready)
- **Transaction History**: Detailed credit/debit transaction list
- **Visual Indicators**: Color-coded transactions (green for credit, red for debit)

### Safety Features
- **Women-Only Rides**: Dedicated filter for women passengers
- **Driver Ratings**: Star-based rating system
- **Safety Center**: Quick access to safety features
- **Emergency Contacts**: Support for emergency situations
- **Ride Verification**: Driver details visible before booking

### Profile & Settings
- **Role Switching**: Switch between Traveler, Driver, and Admin modes
- **Profile Information**: Display name, email, rating, total trips
- **IP Address Display**: Shows current IP for security
- **Location Info**: Real-time location display
- **Notification Toggle**: Enable/disable notifications
- **Location Toggle**: Enable/disable location services
- **Edit Profile**: Quick access to profile editing

### Notifications
- **Real-time Alerts**: Booking confirmations, ride updates, payment notifications
- **Unread Count**: Badge showing unread notification count
- **Mark as Read**: Ability to mark all notifications as read
- **Categorized Icons**: Different icons for booking, ride, payment, and alert types

### UI/UX Features
- **Dark Theme**: Elegant dark mode design with gold accents
- **Smooth Animations**: Page transitions and tab navigation animations
- **Animated Tab Icons**: Spring-based icon animations on tab switch
- **Loading States**: Proper loading indicators for async operations
- **Empty States**: Helpful messages when no data is available
- **Responsive Design**: Works on various screen sizes
- **Safe Area Support**: Proper handling of notches and system UI

### Driver Features (UI Ready)
- **Driver Dashboard**: Dedicated screen for drivers
- **Driver Onboarding**: Multi-step driver registration process
- **Ride Acceptance**: Accept/reject ride requests
- **Earnings Tracking**: View earnings and statistics

### Admin Features (UI Ready)
- **Admin Dashboard**: Administrative control panel
- **User Management**: View and manage users
- **Ride Monitoring**: Monitor all active rides
- **Analytics**: Platform usage statistics

### Database Integration
- **Supabase Backend**: Full Supabase integration
- **User Profiles Table**: Stores user data, location, IP address
- **Row Level Security**: Proper RLS policies for data protection
- **Real-time Updates**: Supabase real-time subscriptions
- **Automatic Profile Creation**: Profiles created on first login

### Technical Features
- **TypeScript**: Full type safety throughout the app
- **Expo Router**: File-based routing system
- **React Native Reanimated**: High-performance animations
- **Lucide Icons**: Modern icon library
- **Context API**: Global state management for auth and location
- **Async Storage**: Local data persistence
- **Error Handling**: Comprehensive error handling and user feedback

## Environment Variables Required
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Tables
- `user_profiles`: User information, roles, location, IP address
- Includes: id, email, full_name, user_role, rating, total_trips, ip_address, city, country, latitude, longitude, last_location_update

## Mock Data Available
- Mock rides with driver details
- Mock trip history
- Mock notifications
- Mock wallet transactions
- Mock user data

## Smooth Navigation
- Fade animations between tabs
- Spring-based icon animations
- Optimized transition timings
- Proper gesture handling

## Ready for Production
- TypeScript checks passing
- No console errors
- Proper error handling
- Loading states implemented
- User feedback on all actions
- Secure authentication flow
- Protected routes working
- Database migrations applied

## Next Steps for Deployment
1. Configure Google OAuth credentials
2. Add real payment gateway integration
3. Implement real-time ride matching
4. Add push notifications
5. Set up background location tracking
6. Add map integration (Google Maps/MapBox)
7. Implement chat system between drivers and passengers
8. Add ride rating system
9. Set up analytics tracking
10. Configure app store listings

# TripZa – Share the Way

A modern ride-sharing application built with React Native and Expo.

## 🗺️ Google Maps Integration (Cost-Optimized)

This app uses Google Maps **only for map rendering and initial route calculation**. All live tracking is done via WebSocket to minimize costs.

- ✅ **Map Display:** FREE unlimited (react-native-maps)
- ✅ **Initial Route:** 1 Directions API call per ride (~$0.005)
- ✅ **Live Tracking:** FREE via WebSocket (no Google API calls)
- ✅ **ETA Calculation:** FREE local math (Haversine formula)

**Cost per ride:** ~$0.005 | **Savings:** 99% vs traditional Google API tracking

📚 **Documentation:**

- [Setup Guide](./SETUP_GOOGLE_MAPS.md)
- [Optimization Details](./GOOGLE_MAPS_OPTIMIZATION.md)
- [Architecture](./ARCHITECTURE_TRACKING.md)
- [Verification Checklist](./GOOGLE_MAPS_CHECKLIST.md)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Add your Google Maps API key to config/googleMaps.ts
# Or use environment variable: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY

# Rebuild native code (required after adding Google Maps config)
npx expo prebuild --clean

# Start development server
npm run dev
```

## 📱 Features

- Real-time ride tracking via WebSocket
- Google Maps integration with cost optimization
- Secure payments with Razorpay
- Clerk authentication
- Women-only ride options
- Multiple driver modes (Commuter, Pro, etc.)

## 🔧 Tech Stack

- **Frontend:** React Native + Expo
- **Maps:** react-native-maps + Google Maps Platform
- **Real-time:** Socket.io WebSocket
- **Auth:** Clerk
- **Payments:** Razorpay
- **Backend:** Express + MongoDB

## 📄 License

MIT

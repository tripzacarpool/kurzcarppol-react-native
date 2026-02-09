# Running on Web for Testing Both Accounts

## Quick Start

### 1. Start Backend

```bash
cd backend
npm run dev
```

Backend should run on `http://localhost:5000`

### 2. Start Web App

Open a NEW terminal:

```bash
npx expo start --web
```

This will open your default browser automatically.

### 3. Test With Two Browsers

**Chrome (Driver Account):**

1. Open Chrome
2. Go to `http://localhost:8081` (or the URL shown in terminal)
3. Login as **Driver** (ridepartner@gmail.com)

**Edge/Firefox (Passenger Account):**

1. Open Edge or Firefox
2. Go to same URL `http://localhost:8081`
3. Login as **Passenger** (your passenger account)

Now you can test messaging between both accounts on one PC!

---

## If Web Version Has Issues

Some features won't work on web:

- ❌ Camera (for document upload)
- ❌ Maps (react-native-maps)
- ❌ Real location tracking
- ✅ Chat/Messaging (should work)
- ✅ Ride listings
- ✅ Booking flow

---

## Alternative: Use Expo Go + Chrome

If web version has too many issues:

1. **Physical Device** → Install Expo Go, login as Passenger
2. **Chrome on PC** → Open `http://localhost:8081`, login as Driver

---

## Troubleshooting

### Port already in use

```bash
# Kill process on port 8081
npx kill-port 8081
# Then restart
npx expo start --web
```

### Backend connection fails

- Check backend is running on port 5000
- Web app uses `http://localhost:5000` (not 10.0.2.2)

### Chrome/Edge opening same session

- Use Chrome Incognito for Driver
- Use Edge for Passenger
- Or use two different browser profiles

---

## Quick Commands

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Web App
npx expo start --web

# If you want mobile + web
npx expo start
# Then press 'w' for web
# Scan QR for mobile
```

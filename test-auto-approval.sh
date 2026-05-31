#!/bin/bash
# Test script to verify auto-approval is working

echo "🧪 Testing Auto-Approval Flow"
echo "================================"
echo ""

# Check if backend is running
echo "1️⃣ Checking backend status..."
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Backend is running on port 5000"
else
    echo "❌ Backend is NOT running!"
    echo "Please start: cd backend && npm run dev"
    exit 1
fi

echo ""
echo "2️⃣ Test Steps:"
echo "   a. Create a new ride with 'Auto-Approve' selected"
echo "   b. Watch the backend logs for:"
echo "      - 🔍 [CREATE RIDE] Approval settings received"
echo "      - ✅ Ride offer created: approvalMode: 'auto'"
echo "   c. Book the ride as a passenger"
echo "   d. Look for these logs:"
echo "      - 🔍 [BOOKING] Ride approval settings"
echo "      - 🔍 [determineApprovalMode] Input"
echo "      - 🎯 [BOOKING] Determined approval mode: 'auto'"
echo "      - ✅ Booking auto-approved"
echo ""
echo "3️⃣ Expected Results:"
echo "   ✅ Passenger sees: 'Booking Confirmed!' (instantly)"
echo "   ✅ Driver does NOT see approval request"
echo "   ✅ Backend logs show: 'Booking auto-approved'"
echo ""
echo "4️⃣ If still showing 'Waiting for approval':"
echo "   Check backend logs for which condition is failing:"
echo "   - approvalMode value"
echo "   - requiresManualApproval value"
echo "   - passengerRating / passengerTrips"
echo ""
echo "================================"
echo "Press Ctrl+C to exit log monitoring"
echo ""

# Follow backend logs if using PM2 or similar
if command -v pm2 &> /dev/null; then
    echo "📋 Following PM2 logs..."
    pm2 logs backend --lines 50
elif [ -f "backend/logs/app.log" ]; then
    echo "📋 Following log file..."
    tail -f backend/logs/app.log
else
    echo "📋 Assuming logs are in terminal. Switch to your backend terminal to see logs."
fi

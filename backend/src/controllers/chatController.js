import mongoose from 'mongoose';
import { Conversation, Message, UserProfile } from '../config/models.js';
import { Expo } from 'expo-server-sdk';

// Socket.io instance will be injected
let io = null;

export function setChatSocketIO(socketInstance) {
  io = socketInstance;
}

/**
 * Get or create conversation between driver and passenger
 * POST /api/chat/conversation
 */
export const getOrCreateConversation = async (req, res, next) => {
  try {
    const { rideId, driverId, passengerId, passengerName, rideDetails } =
      req.body;

    console.log('🔍 [BACKEND] getOrCreateConversation called:', {
      rideId,
      driverId,
      passengerId,
      passengerName,
    });

    if (!rideId || !driverId || !passengerId) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'rideId, driverId, and passengerId are required',
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      rideId,
      participants: { $all: [driverId, passengerId] },
    });

    let isNewConversation = false;
    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        rideId,
        participants: [driverId, passengerId],
        driverId,
        passengerId,
        lastMessage: null,
        lastMessageAt: new Date(),
      });
      isNewConversation = true;
      console.log('✅ [BACKEND] Created new conversation:', conversation._id);
      console.log('👥 [BACKEND] Participants:', conversation.participants);

      // Create welcome system message with ride and user details
      try {
        const RideOffer = mongoose.model('RideOffer');
        const rideOffer = await RideOffer.findById(rideId);

        let welcomeMessage = `New conversation started`;

        if (rideOffer && passengerName) {
          welcomeMessage = `${passengerName} wants to connect about the ride from ${rideOffer.from} to ${rideOffer.to}`;
        } else if (passengerName) {
          welcomeMessage = `${passengerName} started a conversation`;
        } else if (rideOffer) {
          welcomeMessage = `Conversation started about ride from ${rideOffer.from} to ${rideOffer.to}`;
        }

        // Create system message
        const systemMessage = await Message.create({
          conversationId: conversation._id,
          senderId: 'system',
          senderName: 'System',
          messageText: welcomeMessage,
          messageType: 'system',
          readBy: [driverId, passengerId], // Mark as read by default
        });

        // Update conversation with system message
        conversation.lastMessage = welcomeMessage;
        conversation.lastMessageAt = systemMessage.createdAt;
        await conversation.save();

        console.log('📨 [BACKEND] Created welcome message:', welcomeMessage);
      } catch (error) {
        console.error('⚠️ Could not create welcome message:', error.message);
      }
    } else {
      console.log(
        '✅ [BACKEND] Found existing conversation:',
        conversation._id,
      );
      console.log('👥 [BACKEND] Participants:', conversation.participants);
    }

    res.status(200).json({
      success: true,
      conversation,
      isNewConversation,
    });
  } catch (error) {
    console.error('❌ Get/create conversation error:', error);
    next(error);
  }
};

/**
 * Send message
 * POST /api/chat/message
 */
export const sendMessage = async (req, res, next) => {
  try {
    const {
      conversationId,
      senderId,
      senderName,
      messageText,
      messageType = 'text',
    } = req.body;

    console.log('💬 [BACKEND] sendMessage called:', {
      conversationId,
      senderId,
      messageText: messageText?.substring(0, 50),
    });

    if (!conversationId || !senderId || !messageText) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'conversationId, senderId, and messageText are required',
      });
    }

    // Get conversation to find recipient
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
      });
    }

    console.log(
      '👥 [BACKEND] Conversation participants:',
      conversation.participants,
    );

    // Find recipient (the other person in the conversation)
    const recipientId = conversation.participants.find(
      (participantId) => participantId !== senderId,
    );

    console.log('📨 [BACKEND] Recipient ID:', recipientId);

    // Create message
    const message = await Message.create({
      conversationId,
      senderId,
      senderName,
      messageText,
      messageType,
      readBy: [senderId], // Sender has read their own message
      sentAt: new Date(),
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: messageText,
      lastMessageAt: new Date(),
    });

    console.log('✅ Message sent:', message._id);

    // Emit socket event for real-time updates
    if (io && recipientId) {
      // Emit conversation-specific event
      io.emit(`chat:message:${conversationId}`, {
        message,
        conversationId,
        senderId,
        recipientId,
        type: 'message_sent',
      });

      // Emit user-specific event for dashboard updates
      io.emit(`user:message:${recipientId}`, {
        message,
        conversationId,
        senderId,
        recipientId,
        type: 'new_message',
        senderName,
        messageText: messageText.substring(0, 50),
      });

      // Global broadcast for new messages (for real-time updates across all screens)
      io.emit('chat:newMessage', {
        message,
        conversationId,
        senderId,
        recipientId,
        type: 'new_message',
        timestamp: new Date(),
      });

      // Broadcast to all connected clients for immediate message count updates
      io.emit('messages:countUpdate', {
        userId: recipientId,
        type: 'increment',
        timestamp: new Date(),
      });

      console.log(
        '📡 Socket events emitted for new message (conversation, user-specific, global, and count update)',
      );
    }

    // Send push notification to recipient
    if (recipientId) {
      try {
        const recipient = await UserProfile.findOne({ clerkId: recipientId });
        if (recipient?.pushToken) {
          console.log('📱 Found recipient push token, sending notification...');

          // Calculate total unread messages for badge
          const totalUnread = await Message.countDocuments({
            conversationId: {
              $in: await Conversation.find({
                participants: recipientId,
              }).distinct('_id'),
            },
            senderId: { $ne: recipientId },
            readBy: { $ne: recipientId },
          });

          const { Expo } = await import('expo-server-sdk');
          const expo = new Expo();

          // Validate push token format (same as test notification)
          if (!Expo.isExpoPushToken(recipient.pushToken)) {
            console.error('❌ Invalid Expo push token format');
            return;
          }

          const messages = [
            {
              to: recipient.pushToken,
              sound: 'default',
              title: `💬 New message from ${senderName || 'Someone'}`,
              body: messageText.substring(0, 100), // Limit to 100 chars
              badge: totalUnread + 1, // +1 for the current message
              data: {
                type: 'chat',
                conversationId,
                senderId,
                rideId: conversation.rideId,
                timestamp: new Date().toISOString(),
              },
              priority: 'high',
            },
          ];

          console.log('📤 Sending push notification:', {
            to: recipient.pushToken.substring(0, 20) + '...',
            title: messages[0].title,
            body: messages[0].body,
            badge: messages[0].badge,
          });

          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            try {
              const result = await expo.sendPushNotificationsAsync(chunk);
              console.log('📡 Push notification result:', result);

              // Check for errors in the response
              result.forEach((receipt, index) => {
                if (receipt.status === 'error') {
                  console.error('📱 Push notification error:', receipt.message);
                  if (
                    receipt.details &&
                    receipt.details.error === 'DeviceNotRegistered'
                  ) {
                    console.log(
                      '🧹 Device not registered, should remove token',
                    );
                  }
                } else if (receipt.status === 'ok') {
                  console.log('✅ Push notification delivered successfully');
                }
              });
            } catch (sendError) {
              console.error(
                '❌ Error sending push notification chunk:',
                sendError,
              );
              // Try sending a local fallback notification
              console.log('🔄 Attempting local notification fallback...');
            }
          }
          console.log(
            '✅ Push notification process completed (badge:',
            totalUnread + 1,
            ')',
          );
        } else {
          console.log('⚠️ No push token found for recipient:', recipientId);
          console.log('📊 Debug info:');
          console.log('  - Recipient profile found:', !!recipient);
          if (recipient) {
            console.log('  - Recipient email:', recipient.email);
            console.log('  - Push token exists:', !!recipient.expoPushToken);
            if (recipient.expoPushToken) {
              console.log(
                '  - Token starts with ExponentPushToken:',
                recipient.expoPushToken.startsWith('ExponentPushToken'),
              );
            }
          }
          console.log('📝 This user will not receive push notifications');
        }
      } catch (notifError) {
        console.error('❌ Error sending push notification:', notifError);
        // Don't fail the message send if notification fails
      }
    }

    res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    next(error);
  }
};

/**
 * Get messages for a conversation
 * GET /api/chat/messages/:conversationId
 */
export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50 } = req.query;

    const messages = await Message.find({ conversationId })
      .sort({ sentAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      messages: messages.reverse(), // Oldest first
      count: messages.length,
    });
  } catch (error) {
    console.error('❌ Get messages error:', error);
    next(error);
  }
};

/**
 * Mark messages as read
 * POST /api/chat/read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { conversationId, userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'conversationId and userId are required',
      });
    }

    // Mark all messages in conversation as read by this user
    await Message.updateMany(
      {
        conversationId,
        readBy: { $ne: userId }, // Only update if user hasn't read
      },
      {
        $addToSet: { readBy: userId },
      },
    );

    console.log('✅ Messages marked as read');

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('❌ Mark as read error:', error);
    next(error);
  }
};

/**
 * Get conversations for a user
 * GET /api/chat/conversations/:userId
 */
export const getUserConversations = async (req, res, next) => {
  try {
    const { userId } = req.params;
    console.log('🔍 [BACKEND] Getting conversations for userId:', userId);

    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ lastMessageAt: -1 })
      .limit(20);

    console.log('📬 [BACKEND] Found conversations:', conversations.length);

    // Enrich conversations with user details and ride info
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        // Calculate unread count
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          senderId: { $ne: userId },
          readBy: { $ne: userId },
        });

        // Determine if current user is driver or passenger
        const isDriver = conv.driverId === userId;
        const otherUserId = isDriver ? conv.passengerId : conv.driverId;

        // Default values
        let otherUserName = isDriver ? 'Passenger' : 'Driver';
        let otherUserPhone = null;
        let rideDetails = null;

        // First, try to get the other user's name from UserProfile
        try {
          const otherUserProfile = await UserProfile.findOne({
            clerkId: otherUserId,
          });
          if (otherUserProfile) {
            // Use firstName and lastName if available, otherwise fall back to email
            if (otherUserProfile.firstName || otherUserProfile.lastName) {
              otherUserName =
                `${otherUserProfile.firstName || ''} ${otherUserProfile.lastName || ''}`.trim();
            } else if (otherUserProfile.email) {
              // Extract name from email if no firstName/lastName
              otherUserName = otherUserProfile.email.split('@')[0];
            }
            otherUserPhone = otherUserProfile.phone;
          }
        } catch (error) {
          console.log(
            '⚠️ Could not fetch user profile for:',
            otherUserId,
            error.message,
          );
        }

        // Try to fetch ride offer details for additional info
        try {
          const RideOffer = mongoose.model('RideOffer');
          const rideOffer = await RideOffer.findById(conv.rideId);

          if (rideOffer) {
            // Get ride route
            rideDetails = {
              from: rideOffer.from,
              to: rideOffer.to,
            };

            if (isDriver) {
              // Driver viewing passenger details
              const booking = rideOffer.bookings?.find(
                (b) => b.passengerClerkId === otherUserId,
              );

              if (booking) {
                // Use booking name if available and not already set from UserProfile
                if (booking.passengerName && otherUserName === 'Passenger') {
                  otherUserName = booking.passengerName;
                }
                // Use booking phone if not already set from UserProfile
                if (booking.passengerPhone && !otherUserPhone) {
                  otherUserPhone = booking.passengerPhone;
                }
              }
            } else {
              // Passenger viewing driver details
              if (rideOffer.driver && otherUserName === 'Driver') {
                otherUserName = rideOffer.driver.name || 'Driver';
              }
            }
          }
        } catch (error) {
          console.log(
            '⚠️ Could not fetch ride details for conversation:',
            conv._id,
            error.message,
          );
        }

        return {
          ...conv.toObject(),
          unreadCount,
          otherUserName,
          otherUserId,
          otherUserPhone,
          rideDetails,
        };
      }),
    );

    if (conversationsWithDetails.length > 0) {
      console.log('📋 [BACKEND] First enriched conversation:', {
        participants: conversationsWithDetails[0].participants,
        otherUserName: conversationsWithDetails[0].otherUserName,
        rideDetails: conversationsWithDetails[0].rideDetails,
        unread: conversationsWithDetails[0].unreadCount,
      });
    }

    res.status(200).json({
      success: true,
      conversations: conversationsWithDetails,
      count: conversationsWithDetails.length,
    });
  } catch (error) {
    console.error('❌ Get conversations error:', error);
    next(error);
  }
};

/**
 * Clean up broken conversations with invalid participant IDs
 * DELETE /api/chat/conversations/cleanup
 */
export const cleanupBrokenConversations = async (req, res, next) => {
  try {
    // Find conversations with invalid participant IDs (not starting with "user_")
    const brokenConversations = await Conversation.find({
      $or: [
        { participants: { $regex: /^(?!user_).*@.*/ } }, // Contains email-like strings
        { driverId: { $regex: /^(?!user_).*@.*/ } },
        { passengerId: { $regex: /^(?!user_).*@.*/ } },
      ],
    });

    console.log(
      '🧹 [BACKEND] Found broken conversations:',
      brokenConversations.length,
    );

    if (brokenConversations.length > 0) {
      const conversationIds = brokenConversations.map((c) => c._id);

      // Delete associated messages
      const deletedMessages = await Message.deleteMany({
        conversationId: { $in: conversationIds },
      });

      // Delete conversations
      const deletedConversations = await Conversation.deleteMany({
        _id: { $in: conversationIds },
      });

      console.log(
        '✅ [BACKEND] Deleted',
        deletedMessages.deletedCount,
        'messages',
      );
      console.log(
        '✅ [BACKEND] Deleted',
        deletedConversations.deletedCount,
        'conversations',
      );

      res.status(200).json({
        success: true,
        deletedConversations: deletedConversations.deletedCount,
        deletedMessages: deletedMessages.deletedCount,
        message: 'Broken conversations cleaned up successfully',
      });
    } else {
      res.status(200).json({
        success: true,
        deletedConversations: 0,
        deletedMessages: 0,
        message: 'No broken conversations found',
      });
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    next(error);
  }
};

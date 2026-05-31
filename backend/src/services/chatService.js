import mongoose from 'mongoose';
import { Conversation, Message } from '../models/chat.model.js';
import { UserProfile } from '../models/userProfile.model.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { sendPushToToken } from './pushNotificationService.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';

export function sanitizeUserName(name) {
  if (!name || typeof name !== 'string') return null;

  return name
    .replace(/[^a-zA-Z0-9\s\-'.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

class ChatServiceError extends Error {
  constructor(message, { status = 400, details } = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function getOrCreateConversationForRide({
  rideId,
  driverId,
  passengerId,
  passengerName,
}) {
  if (!rideId || !driverId || !passengerId) {
    throw new ChatServiceError('Missing required fields', {
      details: 'rideId, driverId, and passengerId are required',
    });
  }

  let conversation = await Conversation.findOne({
    rideId,
    participants: { $all: [driverId, passengerId] },
  });

  let isNewConversation = false;
  if (!conversation) {
    conversation = await Conversation.create({
      rideId,
      participants: [driverId, passengerId],
      driverId,
      passengerId,
      lastMessage: null,
      lastMessageAt: new Date(),
    });
    isNewConversation = true;

    try {
      const RideOffer = mongoose.model('RideOffer');
      const rideOffer = await RideOffer.findById(rideId);
      let welcomeMessage = 'New conversation started';
      const sanitizedPassengerName = sanitizeUserName(passengerName);

      if (rideOffer && sanitizedPassengerName) {
        welcomeMessage = `${sanitizedPassengerName} wants to connect about the ride from ${rideOffer.from} to ${rideOffer.to}`;
      } else if (sanitizedPassengerName) {
        welcomeMessage = `${sanitizedPassengerName} started a conversation`;
      } else if (rideOffer) {
        welcomeMessage = `Conversation started about ride from ${rideOffer.from} to ${rideOffer.to}`;
      }

      const systemMessage = await Message.create({
        conversationId: conversation._id,
        senderId: 'system',
        senderName: 'System',
        messageText: welcomeMessage,
        messageType: 'system',
        readBy: [driverId, passengerId],
      });

      conversation.lastMessage = welcomeMessage;
      conversation.lastMessageAt = systemMessage.createdAt;
      await conversation.save();
    } catch (error) {
      console.error('Could not create welcome message:', error.message);
    }
  }

  return { conversation, isNewConversation };
}

export async function createChatMessage({
  conversationId,
  senderId,
  senderName,
  messageText,
  messageType = 'text',
}) {
  if (!conversationId || !senderId || !messageText) {
    throw new ChatServiceError('Missing required fields', {
      details: 'conversationId, senderId, and messageText are required',
    });
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ChatServiceError('Conversation not found', { status: 404 });
  }

  const recipientId = conversation.participants.find(
    (participantId) => participantId !== senderId,
  );
  const sanitizedSenderName = sanitizeUserName(senderName) || 'User';

  const message = await Message.create({
    conversationId,
    senderId,
    senderName: sanitizedSenderName,
    messageText,
    messageType,
    readBy: [senderId],
    sentAt: new Date(),
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: messageText,
    lastMessageAt: new Date(),
  });

  await publishEvent(EventTypes.ChatMessageSent, {
    messageId: message._id.toString(),
    conversationId,
    senderId,
    recipientId,
    rideId: conversation.rideId?.toString(),
    messageType,
  });

  return { message, conversation, recipientId };
}

export async function sendChatMessageNotification({
  recipientId,
  senderId,
  senderName,
  messageText,
  conversation,
  conversationId,
}) {
  if (!recipientId) return null;

  const recipient = await UserProfile.findOne({ clerkId: recipientId }).select(
    'pushToken',
  );
  if (!recipient?.pushToken) return null;

  const conversationIds = await Conversation.find({
    participants: recipientId,
  }).distinct('_id');
  const totalUnread = await Message.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: recipientId },
    readBy: { $ne: recipientId },
  });

  return sendPushToToken({
    pushToken: recipient.pushToken,
    title: `New message from ${sanitizeUserName(senderName) || 'Someone'}`,
    body: String(messageText || '').substring(0, 100),
    data: {
      type: 'chat',
      conversationId,
      senderId,
      rideId: conversation.rideId,
      timestamp: new Date().toISOString(),
      badge: totalUnread + 1,
    },
  });
}

export async function createChatMessageFlow({
  conversationId,
  senderId,
  senderName,
  messageText,
  messageType,
}) {
  const result = await createChatMessage({
    conversationId,
    senderId,
    senderName,
    messageText,
    messageType,
  });
  const { message, conversation, recipientId } = result;

  const io = getRealtimeServer();
  if (io && recipientId) {
    io.emit(`chat:message:${conversationId}`, {
      message,
      conversationId,
      senderId,
      recipientId,
      type: 'message_sent',
    });

    const userMessagePayload = {
      message,
      conversationId,
      senderId,
      recipientId,
      type: 'new_message',
      senderName,
      messageText: messageText.substring(0, 50),
      rideId: conversation.rideId,
    };

    io.to(`user:${recipientId}`).emit(
      `user:message:${recipientId}`,
      userMessagePayload,
    );
    io.emit(`user:message:${recipientId}`, userMessagePayload);
    io.emit('chat:newMessage', {
      message,
      conversationId,
      senderId,
      recipientId,
      type: 'new_message',
      timestamp: new Date(),
    });
    io.emit('messages:countUpdate', {
      userId: recipientId,
      type: 'increment',
      timestamp: new Date(),
    });
  }

  if (recipientId) {
    try {
      await sendChatMessageNotification({
        recipientId,
        senderId,
        senderName,
        messageText,
        conversation,
        conversationId,
      });
    } catch (notificationError) {
      console.error('Chat notification failed:', notificationError.message);
    }
  }

  return result;
}

export async function getConversationMessages(conversationId, limit = 50) {
  const messages = await Message.find({ conversationId })
    .sort({ sentAt: -1 })
    .limit(parseInt(limit, 10));

  return messages.reverse();
}

export async function markConversationRead(conversationId, userId) {
  if (!conversationId || !userId) {
    throw new ChatServiceError('Missing required fields', {
      details: 'conversationId and userId are required',
    });
  }

  await Message.updateMany(
    {
      conversationId,
      readBy: { $ne: userId },
    },
    {
      $addToSet: { readBy: userId },
    },
  );
}

export async function getConversationsForUser(userId) {
  const conversations = await Conversation.find({
    participants: userId,
  })
    .sort({ lastMessageAt: -1 })
    .limit(20);

  return Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        senderId: { $ne: userId },
        readBy: { $ne: userId },
      });

      const isDriver = conv.driverId === userId;
      const otherUserId = isDriver ? conv.passengerId : conv.driverId;
      let otherUserName = isDriver ? 'Passenger' : 'Driver';
      let otherUserPhone = null;
      let rideDetails = null;

      try {
        const otherUserProfile = await UserProfile.findOne({
          clerkId: otherUserId,
        });
        if (otherUserProfile) {
          if (otherUserProfile.firstName || otherUserProfile.lastName) {
            const firstName = sanitizeUserName(otherUserProfile.firstName) || '';
            const lastName = sanitizeUserName(otherUserProfile.lastName) || '';
            const fullName = `${firstName} ${lastName}`.trim();
            if (fullName) otherUserName = fullName;
          } else if (otherUserProfile.email) {
            const emailName = sanitizeUserName(
              otherUserProfile.email.split('@')[0],
            );
            if (emailName) otherUserName = emailName;
          }
          otherUserPhone = otherUserProfile.phone;
        }
      } catch (error) {
        console.error('Could not fetch user profile for conversation:', error.message);
      }

      try {
        const RideOffer = mongoose.model('RideOffer');
        const rideOffer = await RideOffer.findById(conv.rideId);

        if (rideOffer) {
          rideDetails = {
            from: rideOffer.from,
            to: rideOffer.to,
          };

          if (isDriver) {
            const booking = rideOffer.bookings?.find(
              (b) => b.passengerClerkId === otherUserId,
            );
            if (booking) {
              if (booking.passengerName && otherUserName === 'Passenger') {
                otherUserName =
                  sanitizeUserName(booking.passengerName) || otherUserName;
              }
              if (booking.passengerPhone && !otherUserPhone) {
                otherUserPhone = booking.passengerPhone;
              }
            }
          } else if (rideOffer.driver && otherUserName === 'Driver') {
            otherUserName = sanitizeUserName(rideOffer.driver.name) || 'Driver';
          }
        }
      } catch (error) {
        console.error('Could not fetch ride details for conversation:', error.message);
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
}

export async function cleanupInvalidConversations() {
  const brokenConversations = await Conversation.find({
    $or: [
      { participants: { $regex: /^(?!user_).*@.*/ } },
      { driverId: { $regex: /^(?!user_).*@.*/ } },
      { passengerId: { $regex: /^(?!user_).*@.*/ } },
    ],
  });

  if (brokenConversations.length === 0) {
    return { deletedConversations: 0, deletedMessages: 0 };
  }

  const conversationIds = brokenConversations.map((conversation) => conversation._id);
  const deletedMessages = await Message.deleteMany({
    conversationId: { $in: conversationIds },
  });
  const deletedConversations = await Conversation.deleteMany({
    _id: { $in: conversationIds },
  });

  return {
    deletedConversations: deletedConversations.deletedCount,
    deletedMessages: deletedMessages.deletedCount,
  };
}

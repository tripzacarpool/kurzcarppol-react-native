import { Conversation, Message } from '../config/models.js';

/**
 * Get or create conversation between driver and passenger
 * POST /api/chat/conversation
 */
export const getOrCreateConversation = async (req, res, next) => {
  try {
    const { rideId, driverId, passengerId } = req.body;

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
      console.log('✅ Created new conversation:', conversation._id);
    }

    res.status(200).json({
      success: true,
      conversation,
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

    if (!conversationId || !senderId || !messageText) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'conversationId, senderId, and messageText are required',
      });
    }

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

    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ lastMessageAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('❌ Get conversations error:', error);
    next(error);
  }
};

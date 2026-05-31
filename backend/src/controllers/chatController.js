import {
  cleanupInvalidConversations,
  createChatMessageFlow,
  getConversationMessages,
  getConversationsForUser,
  getOrCreateConversationForRide,
  markConversationRead,
} from '../services/chatService.js';
import { sendErrorResponse } from '../shared/http/responses.js';

export const getOrCreateConversation = async (req, res, next) => {
  try {
    const { rideId, driverId, passengerId, passengerName } = req.body;
    const result = await getOrCreateConversationForRide({
      rideId,
      driverId,
      passengerId,
      passengerName,
    });

    return res.status(200).json({
      success: true,
      conversation: result.conversation,
      isNewConversation: result.isNewConversation,
    });
  } catch (error) {
    if (error.status) {
      return sendErrorResponse(req, res, error, {
        fallbackCode: 'CHAT_CONVERSATION_ERROR',
      });
    }
    return next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, senderId, senderName, messageText, messageType } =
      req.body;
    const { message } = await createChatMessageFlow({
      conversationId,
      senderId,
      senderName,
      messageText,
      messageType,
    });

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    if (error.status) {
      return sendErrorResponse(req, res, error, {
        fallbackCode: 'CHAT_MESSAGE_ERROR',
      });
    }
    return next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50 } = req.query;
    const messages = await getConversationMessages(conversationId, limit);

    return res.status(200).json({
      success: true,
      messages,
      count: messages.length,
    });
  } catch (error) {
    return next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { conversationId, userId } = req.body;
    await markConversationRead(conversationId, userId);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    if (error.status) {
      return sendErrorResponse(req, res, error, {
        fallbackCode: 'CHAT_MARK_READ_ERROR',
      });
    }
    return next(error);
  }
};

export const getUserConversations = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const conversations = await getConversationsForUser(userId);

    return res.status(200).json({
      success: true,
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    return next(error);
  }
};

export const cleanupBrokenConversations = async (req, res, next) => {
  try {
    const result = await cleanupInvalidConversations();

    return res.status(200).json({
      success: true,
      ...result,
      message:
        result.deletedConversations > 0
          ? 'Broken conversations cleaned up successfully'
          : 'No broken conversations found',
    });
  } catch (error) {
    return next(error);
  }
};

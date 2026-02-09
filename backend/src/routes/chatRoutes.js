import express from 'express';
import {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  markAsRead,
  getUserConversations,
  cleanupBrokenConversations,
} from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat/conversation - Get or create conversation
router.post('/conversation', getOrCreateConversation);

// POST /api/chat/message - Send message
router.post('/message', sendMessage);

// GET /api/chat/messages/:conversationId - Get messages
router.get('/messages/:conversationId', getMessages);

// POST /api/chat/read - Mark messages as read
router.post('/read', markAsRead);

// GET /api/chat/conversations/:userId - Get user's conversations
router.get('/conversations/:userId', getUserConversations);

// DELETE /api/chat/conversations/cleanup - Clean up broken conversations
router.delete('/conversations/cleanup', cleanupBrokenConversations);

export default router;

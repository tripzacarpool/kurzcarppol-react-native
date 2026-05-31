import express from 'express';
import {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  markAsRead,
  getUserConversations,
  cleanupBrokenConversations,
} from '../controllers/chatController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireSelfOrRole } from '../middleware/requireSelfOrRole.js';

const router = express.Router();
router.use(requireClerkAuth);

// POST /api/chat/conversation - Get or create conversation
router.post('/conversation', getOrCreateConversation);

// POST /api/chat/message - Send message
router.post('/message', sendMessage);

// GET /api/chat/messages/:conversationId - Get messages
router.get('/messages/:conversationId', getMessages);

// POST /api/chat/read - Mark messages as read
router.post('/read', markAsRead);

// GET /api/chat/conversations/:userId - Get user's conversations
router.get(
  '/conversations/:userId',
  requireSelfOrRole({ userIdSources: ['params.userId'] }),
  getUserConversations,
);

// DELETE /api/chat/conversations/cleanup - Clean up broken conversations
router.delete(
  '/conversations/cleanup',
  requireRole('admin'),
  cleanupBrokenConversations,
);

export default router;

import express from 'express';
import { healthCheck } from '../controllers/healthController.js';

const router = express.Router();

// GET /health - Health check
router.get('/', healthCheck);

export default router;

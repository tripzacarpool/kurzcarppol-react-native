import express from 'express';
import { healthCheck, readinessCheck } from '../controllers/healthController.js';

export function createHealthRoutes(context = {}) {
  const router = express.Router();

  router.get('/', healthCheck);
  router.get('/live', healthCheck);
  router.get('/ready', readinessCheck(context));

  return router;
}

export default createHealthRoutes();

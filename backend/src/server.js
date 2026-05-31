import './loadEnv.js';
import { createServer } from 'http';
import { createApp } from './app.js';
import { env, isProduction, validateRequiredEnv } from './config/env.js';
import connectToDatabase, { disconnectDatabase } from './config/database.js';
import { startBackgroundTasks, stopBackgroundTasks } from './jobs/backgroundTasks.js';
import {
  closeRealtimeServer,
  createRealtimeServer,
  getRealtimeServer,
} from './realtime/socket.js';
import { disconnectEventBus } from './shared/events/eventBus.js';

let dbReady = false;

const app = createApp({
  getDatabaseReady: () => dbReady,
});
const httpServer = createServer(app);
const io = createRealtimeServer(httpServer);

let shuttingDown = false;

async function bootstrap() {
  try {
    validateRequiredEnv();
    await connectToDatabase();
    await new Promise((resolve) => setTimeout(resolve, 500));
    dbReady = true;
    if (env.enableBackgroundTasks) {
      startBackgroundTasks();
    }
  } catch (err) {
    if (isProduction && err.code === 'ENV_VALIDATION_FAILED') {
      console.error(
        JSON.stringify({
          type: 'startup_error',
          message: err.message,
          code: err.code,
        }),
      );
      process.exit(1);
    }

    console.error(
      JSON.stringify({
        type: 'startup_warning',
        message: err.message,
        code: err.code,
      }),
    );
    dbReady = false;
  }

  httpServer.listen(env.port, '0.0.0.0', () => {
    console.log(
      JSON.stringify({
        type: 'server_started',
        service: 'tripza-api',
        environment: env.nodeEnv,
        port: env.port,
        database: dbReady ? 'connected' : 'disconnected',
        realtime: Boolean(getRealtimeServer()),
        backgroundTasks: env.enableBackgroundTasks,
      }),
    );
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(
    JSON.stringify({
      type: 'server_shutdown',
      signal,
    }),
  );

  const shutdownTimeout = setTimeout(() => {
    console.error(
      JSON.stringify({
        type: 'server_shutdown_timeout',
        timeoutMs: env.serverShutdownTimeoutMs,
      }),
    );
    process.exit(1);
  }, env.serverShutdownTimeoutMs);

  try {
    stopBackgroundTasks();
    closeRealtimeServer();
    await disconnectEventBus();
    await disconnectDatabase();
    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error(
      JSON.stringify({
        type: 'server_shutdown_error',
        message: error.message,
        code: error.code,
      }),
    );
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  console.error(
    JSON.stringify({
      type: 'unhandled_rejection',
      message: error?.message || String(error),
      code: error?.code,
    }),
  );
});
process.on('uncaughtException', (error) => {
  console.error(
    JSON.stringify({
      type: 'uncaught_exception',
      message: error.message,
      code: error.code,
    }),
  );
  shutdown('uncaughtException');
});

bootstrap();

export { io };
export default app;

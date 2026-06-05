import './loadEnv.js';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { env, isProduction, validateRequiredEnv } from './config/env.js';
import connectToDatabase, { disconnectDatabase } from './config/database.js';
import { startBackgroundTasks, stopBackgroundTasks } from './jobs/backgroundTasks.js';
import { disconnectEventBus } from './shared/events/eventBus.js';

let shuttingDown = false;

async function bootstrap() {
  try {
    validateRequiredEnv();
    await connectToDatabase();
    startBackgroundTasks();
    console.log(
      JSON.stringify({
        type: 'worker_started',
        service: 'tripza-background-worker',
        environment: env.nodeEnv,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        type: 'worker_startup_error',
        message: error.message,
        code: error.code,
      }),
    );
    if (isProduction || error.code === 'ENV_VALIDATION_FAILED') {
      process.exit(1);
    }
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(
    JSON.stringify({
      type: 'worker_shutdown',
      signal,
    }),
  );

  const shutdownTimeout = setTimeout(() => {
    console.error(
      JSON.stringify({
        type: 'worker_shutdown_timeout',
        timeoutMs: env.serverShutdownTimeoutMs,
      }),
    );
    process.exit(1);
  }, env.serverShutdownTimeoutMs);

  try {
    stopBackgroundTasks();
    await disconnectEventBus();
    await disconnectDatabase();
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error(
      JSON.stringify({
        type: 'worker_shutdown_error',
        message: error.message,
        code: error.code,
      }),
    );
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun || env.isPm2Run) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (error) => {
    console.error(
      JSON.stringify({
        type: 'worker_unhandled_rejection',
        message: error?.message || String(error),
        code: error?.code,
      }),
    );
  });
  process.on('uncaughtException', (error) => {
    console.error(
      JSON.stringify({
        type: 'worker_uncaught_exception',
        message: error.message,
        code: error.code,
      }),
    );
    shutdown('uncaughtException');
  });

  bootstrap();
}

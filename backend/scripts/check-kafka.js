import { Kafka } from 'kafkajs';
import { env } from '../src/config/env.js';

const timeoutMs = env.kafkaHealthTimeoutMs;

if (env.kafkaBrokers.length === 0) {
  console.error(JSON.stringify({ status: 'not_configured' }));
  process.exit(1);
}

const kafka = new Kafka({
  clientId: `${env.kafkaClientId}-health`,
  brokers: env.kafkaBrokers,
  requestTimeout: timeoutMs,
  connectionTimeout: timeoutMs,
});

const admin = kafka.admin();

const timeout = new Promise((_, reject) => {
  setTimeout(() => {
    const error = new Error(`Kafka health check timed out after ${timeoutMs}ms`);
    error.code = 'KAFKA_HEALTH_TIMEOUT';
    reject(error);
  }, timeoutMs + 1000);
});

try {
  const topics = await Promise.race([
    (async () => {
      await admin.connect();
      return admin.listTopics();
    })(),
    timeout,
  ]);

  console.log(
    JSON.stringify({
      status: 'healthy',
      brokers: env.kafkaBrokers,
      topicCount: topics.length,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: 'unhealthy',
      brokers: env.kafkaBrokers,
      code: error.code,
      message: error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  await admin.disconnect().catch(() => {});
}

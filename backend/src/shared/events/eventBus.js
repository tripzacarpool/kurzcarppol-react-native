import { randomUUID } from 'crypto';
import { Kafka } from 'kafkajs';
import { env } from '../../config/env.js';
import { getCurrentRequestId } from '../http/requestContext.js';

let producer;
let connectionPromise;
let optionalRetryAfter = 0;

function withTimeout(promise, timeoutMs, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}

async function getProducer() {
  if (env.kafkaBrokers.length === 0) {
    return null;
  }

  if (!env.eventBusStrict && optionalRetryAfter > Date.now()) {
    return null;
  }

  if (producer) {
    return producer;
  }

  if (!connectionPromise) {
    const kafka = new Kafka({
      clientId: env.kafkaClientId,
      brokers: env.kafkaBrokers,
    });

    producer = kafka.producer();
    connectionPromise = producer.connect();
    connectionPromise.catch(() => {
      producer = null;
      connectionPromise = null;
    });
  }

  try {
    await withTimeout(
      connectionPromise,
      env.eventBusConnectTimeoutMs,
      'Kafka producer connection',
    );
    optionalRetryAfter = 0;
    return producer;
  } catch (error) {
    const failedProducer = producer;
    producer = null;
    connectionPromise = null;

    if (!env.eventBusStrict) {
      optionalRetryAfter = Date.now() + 30000;
    }

    if (failedProducer) {
      failedProducer.disconnect().catch(() => {});
    }

    throw error;
  }
}

export async function publishEvent(eventType, data, options = {}) {
  const event = {
    eventId: options.eventId || randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    source: options.source || 'tripza-api',
    correlationId: options.correlationId || getCurrentRequestId(),
    actor: options.actor,
    data,
  };

  try {
    const kafkaProducer = await getProducer();

    if (!kafkaProducer) {
      console.log(
        JSON.stringify({
          type: 'event_publish_skipped',
          reason: 'kafka_not_configured',
          eventType,
          eventId: event.eventId,
        }),
      );
      return event;
    }

    await kafkaProducer.send({
      topic: options.topic || eventType,
      messages: [
        {
          key: options.key || event.eventId,
          value: JSON.stringify(event),
        },
      ],
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        type: 'event_publish_failed',
        eventType,
        eventId: event.eventId,
        message: error.message,
        code: error.code,
      }),
    );

    if (env.eventBusStrict || options.strict) {
      throw error;
    }

    event.publishError = {
      message: error.message,
      code: error.code,
    };
  }

  return event;
}

export async function disconnectEventBus() {
  if (producer) {
    await producer.disconnect();
    producer = null;
    connectionPromise = null;
  }
}

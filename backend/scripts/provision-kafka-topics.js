import { Kafka } from 'kafkajs';
import { env } from '../src/config/env.js';
import { EventTypes } from '../src/shared/events/eventTypes.js';

const topics = [...new Set([...Object.values(EventTypes), 'smoke.event.created.v1'])].sort();

if (env.kafkaBrokers.length === 0) {
  console.error('KAFKA_BROKERS is required to provision Kafka topics');
  process.exit(1);
}

const kafka = new Kafka({
  clientId: `${env.kafkaClientId}-topic-provisioner`,
  brokers: env.kafkaBrokers,
});

const admin = kafka.admin();

try {
  await admin.connect();

  const existingTopics = new Set(await admin.listTopics());
  const missingTopics = topics.filter((topic) => !existingTopics.has(topic));

  if (missingTopics.length > 0) {
    await admin.createTopics({
      waitForLeaders: true,
      topics: missingTopics.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        status: 'ready',
        brokers: env.kafkaBrokers,
        existingTopics: topics.length - missingTopics.length,
        createdTopics: missingTopics.length,
        topics,
      },
      null,
      2,
    ),
  );
} finally {
  await admin.disconnect().catch(() => {});
}

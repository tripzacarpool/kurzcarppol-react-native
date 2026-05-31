import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventTypes } from '../src/shared/events/eventTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractsPath = path.resolve(__dirname, '../docs/event-contracts.md');
const contracts = fs.readFileSync(contractsPath, 'utf8');

const missing = Object.values(EventTypes).filter(
  (eventType) => !contracts.includes(eventType),
);

if (missing.length > 0) {
  throw new Error(
    `Event contract docs missing event type(s): ${missing.join(', ')}`,
  );
}

console.log(
  `Backend event contract docs cover ${Object.values(EventTypes).length} event types`,
);

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
  console.error('   Path tried:', envPath);
} else {
  console.log('✅ .env file loaded successfully');
  console.log('   Path:', envPath);
  console.log(
    '   MONGODB_URI:',
    process.env.MONGODB_URI ? '✓ Found' : '✗ Missing',
  );
  console.log('   PORT:', process.env.PORT || 'using default');
}

// create_test_admin.js
// Run with: node scripts/create_test_admin.js
import mongoose from 'mongoose';
import User from '../server/models/User.js';
import { createPasswordHash } from '../server/utils/identity.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
if (ADMIN_PASSWORD.length < 12) {
  console.error('Set TEST_ADMIN_PASSWORD to a temporary password with at least 12 characters.');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || undefined });
    console.log('Connected to MongoDB');
    const username = 'ADM-001';
    const existing = await User.findOne({ username });
    if (existing) {
      console.log('Admin user already exists');
      return;
    }
    const password = ADMIN_PASSWORD;
    const admin = new User({
      username,
      role: 'admin',
      displayName: 'Test Admin',
      passwordHash: createPasswordHash(password),
      profile: { initialPassword: password },
    });
    await admin.save();
    console.log('Test admin user created');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

main();

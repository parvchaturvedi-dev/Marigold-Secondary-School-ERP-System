import { connectMongo, getDbStatus } from '../server/db.js';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
  await connectMongo();
  console.log('DB status after connect:', getDbStatus());
  process.exit(0);
})();

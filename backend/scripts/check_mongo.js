import '../server/utils/loadEnv.js';
import { connectMongo, getDbStatus } from '../server/db.js';

(async () => {
  await connectMongo();
  console.log('DB status after connect:', getDbStatus());
  process.exit(0);
})();

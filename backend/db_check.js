import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in env");
  process.exit(1);
}

try {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB Atlas successfully.\n");
  
  // Define a simple Schema for User to inspect fields
  const userSchema = new mongoose.Schema({
    username: String,
    role: String,
    isActive: Boolean,
    displayName: String,
    profile: mongoose.Schema.Types.Mixed
  });
  
  const User = mongoose.model('User', userSchema, 'users');
  
  const users = await User.find({}).lean();
  console.log(`Total users in DB: ${users.length}`);
  let usersWithDeviceRestrictions = 0;
  for (const u of users) {
    const profile = u.profile || {};
    const hardwareId = profile.assignedHardwareId || profile.hardwareDeviceId || profile.deviceId || '';
    const pending = profile.pendingDeviceApproval;
    if (hardwareId || pending) usersWithDeviceRestrictions += 1;
  }
  console.log(`Users with device restrictions or pending approvals: ${usersWithDeviceRestrictions}`);

  await mongoose.disconnect();
} catch (err) {
  console.error("Database inspection failed:", err?.name || "Unknown error");
}

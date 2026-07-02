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
  
  for (const u of users) {
    const profile = u.profile || {};
    const hardwareId = profile.assignedHardwareId || profile.hardwareDeviceId || profile.deviceId || '';
    const pending = profile.pendingDeviceApproval;
    
    if (hardwareId || pending) {
      console.log(`User: ${u.username} (${u.role})`);
      console.log(` - Active: ${u.isActive}`);
      console.log(` - Assigned Hardware ID: "${hardwareId}"`);
      if (pending) {
        console.log(` - Pending Approval Device ID: "${pending.deviceId}" (Requested at: ${pending.requestedAt})`);
      }
      console.log("-----------------------------------------");
    }
  }
  
  await mongoose.disconnect();
} catch (err) {
  console.error("Error:", err);
}

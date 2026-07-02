import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in env");
  process.exit(1);
}

try {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB Atlas successfully.\n");
  
  const userSchema = new mongoose.Schema({
    username: String,
    role: String,
    isActive: Boolean,
    displayName: String,
    profile: mongoose.Schema.Types.Mixed
  });
  
  const User = mongoose.model('User', userSchema, 'users');
  
  const admin = await User.findOne({ username: 'ADM-001' });
  if (admin) {
    console.log("Found ADM-001 profile:");
    console.log("Current Profile State:", JSON.stringify(admin.profile, null, 2));
    
    // Clear device restrictions
    const profile = admin.profile || {};
    delete profile.assignedHardwareId;
    delete profile.hardwareDeviceId;
    delete profile.deviceId;
    delete profile.pendingDeviceApproval;
    
    admin.profile = profile;
    admin.markModified('profile');
    
    await admin.save();
    console.log("\nSuccess! ADM-001 device locks and pending requests have been cleared.");
    console.log("Updated Profile State:", JSON.stringify(admin.profile, null, 2));
  } else {
    console.log("ADM-001 user not found.");
  }
  
  await mongoose.disconnect();
} catch (err) {
  console.error("Error:", err);
}

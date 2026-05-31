import express from 'express';
import { randomInt } from 'crypto';
import multer from 'multer';
import User from '../models/User.js';
import { isMongoConnected } from '../db.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { createAuthToken } from '../utils/authToken.js';
import {
  buildMailErrorPayload,
  closeMailTransporter,
  createMailTransporter,
  getMailConfig,
  getSenderAddress,
  logSmtpError,
} from '../utils/mailer.js';
import {
  createPasswordHash,
  listIdentityUsers,
  syncIdentityUsersFromState,
  verifyPassword,
} from '../utils/identity.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});
const passwordRevealOtps = new Map();
const OTP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const OTP_TTL_MS = 5 * 60 * 1000;

const generatePasswordAccessOtp = () =>
  Array.from({ length: 8 }, () => OTP_ALPHABET[randomInt(0, OTP_ALPHABET.length)]).join('');

const validatePasswordAccessOtp = ({ username, otp, requestedBy }) => {
  const otpRecord = passwordRevealOtps.get(username);
  const normalizedOtp = String(otp || '').trim().toUpperCase();

  if (
    !otpRecord ||
    otpRecord.expiresAt < Date.now() ||
    otpRecord.otp !== normalizedOtp ||
    otpRecord.requestedBy !== requestedBy
  ) {
    return false;
  }

  passwordRevealOtps.delete(username);
  return true;
};

const sendMail = async ({ to, subject, text }) => {
  const mailConfig = getMailConfig();
  if (!mailConfig.isReady) {
    throw new Error('Email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in backend/.env.');
  }

  const transporter = await createMailTransporter(mailConfig);
  try {
    await transporter.sendMail({
      from: getSenderAddress(mailConfig),
      to,
      subject,
      text,
    });
  } finally {
    closeMailTransporter(transporter);
  }
};

const sendCredentialMail = (transporter, mailConfig, user, email) =>
  transporter.sendMail({
    from: getSenderAddress(mailConfig),
    to: email,
    subject: `MGPS ERP login credentials - ${user.username}`,
    text: buildCredentialMessage(user),
  });

const handleMailError = (response, error) => {
  const failure = buildMailErrorPayload(error);
  response.status(failure.status).json(failure.body);
};

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const detectRoleFromUsername = (username = '') => {
  const upperUsername = username.trim().toUpperCase();

  if (upperUsername.startsWith('ADM-')) return 'admin';
  if (upperUsername.startsWith('CLK-')) return 'clerk';
  if (upperUsername.startsWith('TCH-')) return 'teacher';
  if (upperUsername.startsWith('STD-') || upperUsername.startsWith('FAM-')) return 'student';

  return '';
};

const normalizeStudent = (student = {}, index = 0) => ({
  id: student.id || student.admissionNumber || `student-${index + 1}`,
  displayName: student.displayName || student.name || `Student ${index + 1}`,
  className: student.className || '',
  section: student.section || '',
  rollNo: student.rollNo || index + 1,
  admissionNumber: student.admissionNumber || '',
  fatherName: student.fatherName || '',
  motherName: student.motherName || '',
  guardianPhone: student.guardianPhone || '',
  guardianEmail: student.guardianEmail || '',
  dob: student.dob || '',
  gender: student.gender || '',
  bloodGroup: student.bloodGroup || '',
  category: student.category || '',
  religion: student.religion || '',
  house: student.house || '',
  busRoute: student.busRoute || '',
  address: student.address || '',
  tempAddress: student.tempAddress || '',
  permAddress: student.permAddress || student.address || '',
  studentAadhar: student.studentAadhar || '',
  penNumber: student.penNumber || '',
  dateOfAdmission: student.dateOfAdmission || '',
  lastSchoolName: student.lastSchoolName || '',
  photoDataUrl: student.photoDataUrl || '',
});

const getEmailForUser = (user = {}) =>
  user?.profile?.email || user?.profile?.studentProfiles?.[0]?.guardianEmail || '';

const normalizeAdminUsername = (value = '') => {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '-');
  if (!raw) return '';
  return raw.startsWith('ADM-') ? raw : `ADM-${raw}`;
};

const buildAdminPayload = (body = {}) => {
  const username = normalizeAdminUsername(body.username);
  const displayName = String(body.displayName || body.name || '').trim();
  const email = String(body.email || '').trim();
  const mobile = String(body.mobile || body.phone || '').trim();
  const designation = String(body.designation || 'Administrator').trim();
  const initialPassword = String(body.password || body.initialPassword || `${username}@MGPS`);

  return {
    username,
    displayName,
    email,
    mobile,
    designation,
    initialPassword,
    isActive: body.isActive !== false,
  };
};

const buildCredentialMessage = (user = {}) => {
  const linkedStudents = user.profile?.studentProfiles || [];
  const password = user.profile?.initialPassword || '';
  return [
    `Dear ${user.displayName || user.username},`,
    '',
    'Your MGPS ERP login credentials are:',
    `Username: ${user.username}`,
    `Password: ${password || 'Please contact the school office to reset your password.'}`,
    '',
    linkedStudents.length ? 'Linked student profiles:' : '',
    ...linkedStudents.map(
      (student) => `- ${student.displayName} (${student.admissionNumber || student.id}) - ${student.className || 'Class not set'}`
    ),
    '',
    'If you are asked to change this password after login, please set a new private password immediately.',
    '',
    'Regards,',
    'MGPS ERP Portal',
  ].filter((line) => line !== '').join('\n');
};

const toSessionPayload = (user) => {
  const profile = user.profile || {};
  const displayName = profile.displayName || user.displayName || user.username;
  const session = {
    username: user.username,
    role: user.role,
    displayName,
    accountDisplayName: profile.accountDisplayName || displayName,
    allottedClasses: Array.isArray(profile.allottedClasses) ? profile.allottedClasses : [],
    teacherProfile: profile.teacherProfile || null,
    clerkProfile: profile.clerkProfile || null,
    adminProfile: profile.adminProfile || null,
    assignedClassTeacherFor: profile.teacherProfile?.assignedClassTeacherFor || profile.assignedClassTeacherFor || '',
    photoDataUrl: profile.photoDataUrl || '',
    createdAt: new Date().toISOString(),
    token: createAuthToken(user),
    mustChangePassword: Boolean(user.profile?.forcePasswordChange),
  };

  if (user.role === 'student') {
    const studentProfiles = Array.isArray(profile.studentProfiles)
      ? profile.studentProfiles.map(normalizeStudent)
      : [];

    session.studentProfiles = studentProfiles;
    session.activeStudent = studentProfiles[0] || null;
    session.selectedStudentId = session.activeStudent?.id || '';
    session.isSiblingAccount = studentProfiles.length > 1;
    session.displayName = session.activeStudent?.displayName || displayName;
    session.photoDataUrl = profile.photoDataUrl || session.activeStudent?.photoDataUrl || '';
  }

  return session;
};

const saveSessionAuth = (request, payload, response) => {
  request.session.auth = payload;
  request.session.save((saveError) => {
    if (saveError) {
      console.error('[auth:session-save]', {
        username: payload?.username,
        message: saveError.message,
      });
      response.status(500).json({ message: 'Could not persist authenticated session.' });
      return;
    }

    response.json(payload);
  });
};

const persistSessionAuth = (request, payload, response) => {
  request.session.regenerate((regenerateError) => {
    if (regenerateError) {
      console.error('[auth:session-regenerate]', {
        username: payload?.username,
        message: regenerateError.message,
      });
      response.status(500).json({ message: 'Could not create authenticated session.' });
      return;
    }

    saveSessionAuth(request, payload, response);
  });
};

router.post('/login', ensureMongo, async (request, response) => {
  const username = String(request.body.username || '').trim().toUpperCase();
  const password = String(request.body.password || '');
  const deviceId = String(request.body.deviceId || request.get('x-device-id') || '').trim();
  const requestedRole = detectRoleFromUsername(username);

  if (!username || !password) {
    response.status(400).json({ message: 'Username and password are required.' });
    return;
  }

  if (!requestedRole) {
    response.status(400).json({ message: 'Use a valid role ID prefix: ADM-, CLK-, TCH-, STD-, or FAM-.' });
    return;
  }

  await syncIdentityUsersFromState();
  let user = await User.findOne({ username });

  const autoProvisionAdmin = process.env.AUTH_AUTO_PROVISION === 'true';
  if (!user && username === 'ADM-001' && autoProvisionAdmin) {
    const initialAdminPassword = String(process.env.AUTH_AUTO_PROVISION_PASSWORD || '');
    if (initialAdminPassword.length < 12) {
      response.status(503).json({
        message:
          'Initial admin provisioning requires AUTH_AUTO_PROVISION_PASSWORD with at least 12 characters.',
      });
      return;
    }

    user = await User.create({
      username: 'ADM-001',
      role: 'admin',
      displayName: 'Administrator',
      passwordHash: createPasswordHash(initialAdminPassword),
      profile: {
        displayName: 'Administrator',
        accountDisplayName: 'Admin (ADM-001)',
        allottedClasses: [],
      },
    });
  }

  if (!user || !user.isActive || user.role !== requestedRole || !verifyPassword(password, user.passwordHash)) {
    response.status(401).json({ message: 'Invalid username or password.' });
    return;
  }

  const assignedHardwareId = String(
    user.profile?.assignedHardwareId || user.profile?.hardwareDeviceId || user.profile?.deviceId || ''
  ).trim();
  if (deviceId && assignedHardwareId !== deviceId) {
    user.profile = {
      ...(user.profile || {}),
      assignedHardwareId: deviceId,
      assignedHardwareIdAt: new Date(),
      pendingDeviceApproval: undefined,
    };
    await user.save();
  }

  const payload = toSessionPayload(user);
  payload.mustChangePassword =
    Boolean(user.profile?.forcePasswordChange) ||
    Boolean(user.profile?.initialPassword && password === user.profile.initialPassword);
  persistSessionAuth(request, payload, response);
});

router.get('/users', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (_request, response) => {
  response.json(await listIdentityUsers());
});

router.post('/users/admins', ensureMongo, requireAuth, requireRole('admin'), async (request, response) => {
  const payload = buildAdminPayload(request.body);

  if (!payload.username || !payload.displayName || payload.initialPassword.length < 6) {
    response.status(400).json({ message: 'Admin ID, display name, and password with at least 6 characters are required.' });
    return;
  }

  const existing = await User.findOne({ username: payload.username }).lean();
  if (existing) {
    response.status(409).json({ message: 'This admin username already exists.' });
    return;
  }

  await User.create({
    username: payload.username,
    role: 'admin',
    displayName: payload.displayName,
    passwordHash: createPasswordHash(payload.initialPassword),
    isActive: payload.isActive,
    profile: {
      displayName: payload.displayName,
      accountDisplayName: `${payload.displayName} (${payload.username})`,
      email: payload.email,
      mobile: payload.mobile,
      designation: payload.designation,
      initialPassword: payload.initialPassword,
      managedByAdminPanel: true,
    },
  });

  response.status(201).json({ message: 'Admin user created.', users: await listIdentityUsers() });
});

router.patch('/users/:username', ensureMongo, requireAuth, requireRole('admin'), async (request, response) => {
  const username = String(request.params.username || '').trim().toUpperCase();
  const user = await User.findOne({ username });

  if (!user) {
    response.status(404).json({ message: 'User not found.' });
    return;
  }

  const nextPassword = String(request.body.password || request.body.initialPassword || '');
  const nextProfile = {
    ...(user.profile || {}),
    displayName: String(request.body.displayName || request.body.name || user.displayName || '').trim(),
    email: String(request.body.email ?? user.profile?.email ?? '').trim(),
    mobile: String(request.body.mobile ?? user.profile?.mobile ?? '').trim(),
    designation: String(request.body.designation ?? user.profile?.designation ?? '').trim(),
    managedByAdminPanel: user.role === 'admin' ? true : user.profile?.managedByAdminPanel,
  };

  user.displayName = nextProfile.displayName || user.displayName;
  user.isActive = request.body.isActive === undefined ? user.isActive : Boolean(request.body.isActive);
  user.profile = nextProfile;

  if (nextPassword) {
    const otp = String(request.body.passwordOtp || '').trim();
    if (!validatePasswordAccessOtp({ username, otp, requestedBy: request.auth.username })) {
      response.status(403).json({ message: 'Password update requires a valid OTP sent to the user.' });
      return;
    }

    if (nextPassword.length < 6) {
      response.status(400).json({ message: 'Password must contain at least 6 characters.' });
      return;
    }
    user.passwordHash = createPasswordHash(nextPassword);
    user.profile = {
      ...user.profile,
      initialPassword: nextPassword,
      forcePasswordChange: true,
      passwordResetBy: request.auth.username,
      passwordResetAt: new Date(),
    };
  }

  await user.save();
  response.json({ message: 'User updated.', users: await listIdentityUsers() });
});

router.delete('/users/:username', ensureMongo, requireAuth, requireRole('admin'), async (request, response) => {
  const username = String(request.params.username || '').trim().toUpperCase();

  if (username === request.auth.username) {
    response.status(400).json({ message: 'You cannot remove the admin account currently in use.' });
    return;
  }

  const user = await User.findOne({ username });
  if (!user) {
    response.status(404).json({ message: 'User not found.' });
    return;
  }

  if (user.profile?.managedByIdentitySync) {
    response.status(400).json({ message: 'Synced identities must be removed from their source management page.' });
    return;
  }

  await User.deleteOne({ username });
  response.json({ message: 'User removed.', users: await listIdentityUsers() });
});

router.post('/users/send-credentials-all', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (_request, response) => {
  await syncIdentityUsersFromState();
  const mailConfig = getMailConfig();
  if (!mailConfig.isReady) {
    handleMailError(response, new Error('Email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in backend/.env.'));
    return;
  }

  const users = await User.find().sort({ role: 1, username: 1 }).lean();
  let transporter;
  const sent = [];
  const skipped = [];
  const failed = [];

  try {
    transporter = await createMailTransporter(mailConfig);

    for (const user of users) {
      const email = getEmailForUser(user);

      if (!user.isActive) {
        skipped.push({ username: user.username, reason: 'Account is inactive.' });
        continue;
      }

      if (!email) {
        skipped.push({ username: user.username, reason: 'Linked email address is missing.' });
        continue;
      }

      try {
        const info = await sendCredentialMail(transporter, mailConfig, user, email);
        sent.push({ username: user.username, email, messageId: info.messageId || '' });
      } catch (error) {
        logSmtpError(error, { phase: 'send', username: user.username, to: email });
        failed.push({ username: user.username, email, error: error?.message || 'Email dispatch failed.' });
      }
    }
  } catch (error) {
    handleMailError(response, error);
    return;
  } finally {
    if (transporter) closeMailTransporter(transporter);
  }

  response.json({
    message:
      failed.length > 0
        ? `Credentials sent to ${sent.length} users. ${failed.length} failed and ${skipped.length} skipped.`
        : `Credentials sent to ${sent.length} users. ${skipped.length} skipped.`,
    counts: {
      total: users.length,
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    sent,
    skipped,
    failed,
  });
});

router.post('/users/:username/request-password-otp', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (request, response) => {
  await syncIdentityUsersFromState();
  const username = String(request.params.username || '').trim().toUpperCase();
  const user = await User.findOne({ username }).lean();
  const email = getEmailForUser(user);

  if (!user || !email) {
    response.status(404).json({ message: 'A linked email address was not found for this user.' });
    return;
  }

  const otp = generatePasswordAccessOtp();
  passwordRevealOtps.set(username, {
    otp,
    requestedBy: request.auth.username,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  try {
    await sendMail({
      to: email,
      subject: 'MGPS ERP password access OTP',
      text: `Your OTP for admin password access on MGPS ERP account ${username} is ${otp}. Share it only if you approve this password view or update request. It expires in 5 minutes.`,
    });
  } catch (error) {
    handleMailError(response, error);
    return;
  }

  response.json({ message: `OTP sent to ${email}.`, email });
});

router.post('/users/:username/reveal-password', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (request, response) => {
  await syncIdentityUsersFromState();
  const username = String(request.params.username || '').trim().toUpperCase();

  if (!validatePasswordAccessOtp({
    username,
    otp: request.body.otp,
    requestedBy: request.auth.username,
  })) {
    response.status(403).json({ message: 'Invalid or expired OTP.' });
    return;
  }

  const user = await User.findOne({ username }).lean();
  response.json({ password: user?.profile?.initialPassword || '' });
});

router.post('/users/:username/send-credentials', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (request, response) => {
  await syncIdentityUsersFromState();
  const username = String(request.params.username || '').trim().toUpperCase();
  const user = await User.findOne({ username }).lean();
  const email = getEmailForUser(user);

  if (!user || !email) {
    response.status(404).json({ message: 'A linked email address was not found for this user.' });
    return;
  }

  try {
    const mailConfig = getMailConfig();
    const transporter = await createMailTransporter(mailConfig);
    try {
      await sendCredentialMail(transporter, mailConfig, user, email);
    } finally {
      closeMailTransporter(transporter);
    }
  } catch (error) {
    handleMailError(response, error);
    return;
  }

  response.json({ message: `Credentials sent to ${email}.` });
});

router.post('/change-password', ensureMongo, requireAuth, async (request, response) => {
  const currentPassword = String(request.body.currentPassword || '');
  const newPassword = String(request.body.newPassword || '');
  const confirmPassword = String(request.body.confirmPassword || '');

  if (!currentPassword) {
    response.status(400).json({ message: 'Current password is required.' });
    return;
  }

  if (newPassword.length < 6) {
    response.status(400).json({ message: 'New password must contain at least 6 characters.' });
    return;
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    response.status(400).json({ message: 'New password and confirm password do not match.' });
    return;
  }

  const user = await User.findOne({ username: request.auth.username });
  if (!user) {
    response.status(404).json({ message: 'Session user not found.' });
    return;
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    response.status(403).json({ message: 'Current password is incorrect.' });
    return;
  }

  user.passwordHash = createPasswordHash(newPassword);
  user.profile = {
    ...(user.profile || {}),
    initialPassword: '',
    forcePasswordChange: false,
  };
  await user.save();

  if (request.session?.auth) {
    request.session.auth.mustChangePassword = false;
    request.session.save((saveError) => {
      if (saveError) {
        console.error('[auth:change-password-session-save]', {
          username: request.auth?.username,
          message: saveError.message,
        });
        response.status(500).json({ message: 'Password changed, but the session could not be refreshed.' });
        return;
      }

      response.json({ message: 'Password changed successfully.' });
    });
    return;
  }

  response.json({ message: 'Password changed successfully.' });
});

router.patch('/profile-photo', ensureMongo, requireAuth, upload.single('photo'), async (request, response) => {
  if (!request.file || !request.file.mimetype.startsWith('image/')) {
    response.status(400).json({ message: 'Please upload a valid image file.' });
    return;
  }

  const user = await User.findOne({ username: request.auth.username });
  if (!user) {
    response.status(404).json({ message: 'Session user not found.' });
    return;
  }

  const photoDataUrl = `data:${request.file.mimetype};base64,${request.file.buffer.toString('base64')}`;
  user.profile = {
    ...(user.profile || {}),
    photoDataUrl,
  };
  await user.save();

  const payload = toSessionPayload(user);
  saveSessionAuth(request, payload, response);
});

router.get('/session', optionalAuth, async (request, response) => {
  try {
    if (!request.auth?.username) {
      response.json({ authenticated: false });
      return;
    }

    if (!isMongoConnected()) {
      if (request.session?.auth?.username) {
        response.json(request.session.auth);
        return;
      }
      response.status(503).json({ message: 'Data service is not connected. Please restart the API server or contact support.' });
      return;
    }

    const user = await User.findOne({ username: request.auth.username });
    if (!user) {
      response.status(404).json({ message: 'Session user not found.' });
      return;
    }

    const payload = toSessionPayload(user);
    payload.mustChangePassword =
      Boolean(user.profile?.forcePasswordChange) ||
      Boolean(user.profile?.initialPassword);
    saveSessionAuth(request, payload, response);
  } catch (error) {
    console.error('[auth:session]', {
      username: request.auth?.username,
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
    response.status(500).json({ message: 'Could not load authenticated session.' });
  }
});

router.post('/logout', async (request, response) => {
  if (!request.session) {
    response.json({ message: 'Logged out.' });
    return;
  }

  request.session.destroy(() => {
    response.json({ message: 'Logged out.' });
  });
});

export default router;

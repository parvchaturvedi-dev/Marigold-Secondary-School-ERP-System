import express from 'express';
import { randomInt } from 'crypto';
import multer from 'multer';
import User from '../models/User.js';
import { isMongoConnected } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAuthToken } from '../utils/authToken.js';
import {
  buildMailErrorPayload,
  closeMailTransporter,
  createMailTransporter,
  getMailConfig,
  getSenderAddress,
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

const sendMail = async ({ to, subject, text }) => {
  const mailConfig = getMailConfig();
  if (!mailConfig.isReady) throw new Error('Email is not configured. Set Gmail credentials in .env.');

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
  house: student.house || '',
  busRoute: student.busRoute || '',
  address: student.address || '',
  photoDataUrl: student.photoDataUrl || '',
});

const getEmailForUser = (user = {}) =>
  user.profile?.email || user.profile?.studentProfiles?.[0]?.guardianEmail || '';

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
    photoDataUrl: profile.photoDataUrl || '',
    createdAt: new Date().toISOString(),
    token: createAuthToken(user),
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

const persistSessionAuth = (request, payload, response) => {
  request.session.regenerate((regenerateError) => {
    if (regenerateError) {
      response.status(500).json({ message: 'Could not create authenticated session.' });
      return;
    }

    request.session.auth = payload;
    request.session.save((saveError) => {
      if (saveError) {
        response.status(500).json({ message: 'Could not persist authenticated session.' });
        return;
      }

      response.json(payload);
    });
  });
};

router.post('/login', ensureMongo, async (request, response) => {
  const username = String(request.body.username || '').trim().toUpperCase();
  const password = String(request.body.password || '');
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

  const payload = toSessionPayload(user);
  payload.mustChangePassword = Boolean(user.profile?.initialPassword && password === user.profile.initialPassword);
  persistSessionAuth(request, payload, response);
});

router.get('/users', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (_request, response) => {
  response.json(await listIdentityUsers());
});

router.post('/users/:username/request-password-otp', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (request, response) => {
  await syncIdentityUsersFromState();
  const username = String(request.params.username || '').trim().toUpperCase();
  const user = await User.findOne({ username }).lean();
  const email = getEmailForUser(user);

  if (!user || !email) {
    response.status(404).json({ message: 'A linked Gmail address was not found for this user.' });
    return;
  }

  const otp = String(randomInt(100000, 999999));
  passwordRevealOtps.set(username, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  try {
    await sendMail({
      to: email,
      subject: 'MGPS ERP password reveal OTP',
      text: `Your OTP to reveal the MGPS ERP password for ${username} is ${otp}. It expires in 5 minutes.`,
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
  const otp = String(request.body.otp || '').trim();
  const otpRecord = passwordRevealOtps.get(username);

  if (!otpRecord || otpRecord.expiresAt < Date.now() || otpRecord.otp !== otp) {
    response.status(403).json({ message: 'Invalid or expired OTP.' });
    return;
  }

  const user = await User.findOne({ username }).lean();
  passwordRevealOtps.delete(username);
  response.json({ password: user?.profile?.initialPassword || '' });
});

router.post('/users/:username/send-credentials', ensureMongo, requireAuth, requireRole('admin', 'clerk'), async (request, response) => {
  await syncIdentityUsersFromState();
  const username = String(request.params.username || '').trim().toUpperCase();
  const user = await User.findOne({ username }).lean();
  const email = getEmailForUser(user);

  if (!user || !email) {
    response.status(404).json({ message: 'A linked Gmail address was not found for this user.' });
    return;
  }

  try {
    await sendMail({
      to: email,
      subject: `MGPS ERP login credentials - ${username}`,
      text: buildCredentialMessage(user),
    });
  } catch (error) {
    handleMailError(response, error);
    return;
  }

  response.json({ message: `Credentials sent to ${email}.` });
});

router.post('/change-password', ensureMongo, requireAuth, async (request, response) => {
  const newPassword = String(request.body.newPassword || '');
  if (newPassword.length < 6) {
    response.status(400).json({ message: 'New password must contain at least 6 characters.' });
    return;
  }

  const user = await User.findOne({ username: request.auth.username });
  if (!user) {
    response.status(404).json({ message: 'Session user not found.' });
    return;
  }

  user.passwordHash = createPasswordHash(newPassword);
  user.profile = {
    ...(user.profile || {}),
    initialPassword: '',
  };
  await user.save();

  if (request.session?.auth) {
    request.session.auth.mustChangePassword = false;
    request.session.save(() => response.json({ message: 'Password changed successfully.' }));
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
  request.session.auth = payload;
  request.session.save(() => response.json(payload));
});

router.get('/session', requireAuth, async (request, response) => {
  if (request.session?.auth?.username) {
    response.json(request.session.auth);
    return;
  }

  if (!isMongoConnected()) {
    response.status(503).json({ message: 'Data service is not connected. Please restart the API server or contact support.' });
    return;
  }

  const user = await User.findOne({ username: request.auth.username });
  if (!user) {
    response.status(404).json({ message: 'Session user not found.' });
    return;
  }

  const payload = toSessionPayload(user);
  request.session.auth = payload;
  request.session.save(() => response.json(payload));
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

import express from 'express';
import User from '../models/User.js';
import { isMongoConnected } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAuthToken } from '../utils/authToken.js';
import {
  createPasswordHash,
  listIdentityUsers,
  syncIdentityUsersFromState,
  verifyPassword,
} from '../utils/identity.js';

const router = express.Router();

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'MongoDB is not connected. Set MONGODB_URI and restart the API server.',
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
    session.photoDataUrl = session.activeStudent?.photoDataUrl || '';
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
  persistSessionAuth(request, payload, response);
});

router.get('/users', ensureMongo, requireAuth, requireRole('admin'), async (_request, response) => {
  response.json(await listIdentityUsers());
});

router.get('/session', requireAuth, async (request, response) => {
  if (request.session?.auth?.username) {
    response.json(request.session.auth);
    return;
  }

  if (!isMongoConnected()) {
    response.status(503).json({ message: 'MongoDB is not connected. Set MONGODB_URI and restart the API server.' });
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

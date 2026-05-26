import { verifyAuthToken } from '../utils/authToken.js';
import { isMongoConnected } from '../db.js';
import User from '../models/User.js';

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

const toAuthContext = (user, baseAuth = {}) => {
  const profile = user.profile || {};
  const auth = {
    ...baseAuth,
    username: user.username,
    role: user.role,
    displayName: profile.displayName || user.displayName || user.username,
    accountDisplayName: profile.accountDisplayName || user.displayName || user.username,
    allottedClasses: Array.isArray(profile.allottedClasses) ? profile.allottedClasses : [],
    teacherProfile: profile.teacherProfile || null,
    clerkProfile: profile.clerkProfile || null,
    adminProfile: profile.adminProfile || null,
    assignedClassTeacherFor:
      profile.teacherProfile?.assignedClassTeacherFor || profile.assignedClassTeacherFor || '',
    photoDataUrl: profile.photoDataUrl || '',
  };

  if (user.role === 'student') {
    const studentProfiles = Array.isArray(profile.studentProfiles)
      ? profile.studentProfiles.map(normalizeStudent)
      : [];
    const activeStudent =
      studentProfiles.find((student) => student.id === baseAuth.selectedStudentId) ||
      studentProfiles[0] ||
      null;

    auth.studentProfiles = studentProfiles;
    auth.activeStudent = activeStudent;
    auth.selectedStudentId = activeStudent?.id || '';
    auth.isSiblingAccount = studentProfiles.length > 1;
    auth.displayName = activeStudent?.displayName || auth.displayName;
    auth.photoDataUrl = profile.photoDataUrl || activeStudent?.photoDataUrl || '';
  }

  return auth;
};

const hydrateAuthFromDatabase = async (auth) => {
  if (!auth?.username || !isMongoConnected()) return auth;

  const user = await User.findOne({ username: auth.username });
  if (!user || !user.isActive || user.role !== auth.role) return null;

  return toAuthContext(user, auth);
};

export const requireAuth = async (request, response, next) => {
  const header = request.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (token) {
    const auth = verifyAuthToken(token);
    if (!auth) {
      response.status(401).json({ message: 'Authentication is required.' });
      return;
    }
    try {
      request.auth = await hydrateAuthFromDatabase(auth);
      if (!request.auth) {
        response.status(401).json({ message: 'Authentication is required.' });
        return;
      }
      next();
      return;
    } catch {
      response.status(401).json({ message: 'Authentication is required.' });
      return;
    }
  }

  const sessionAuth = request.session?.auth;
  if (sessionAuth?.username && sessionAuth?.role) {
    request.auth = await hydrateAuthFromDatabase(sessionAuth);
    if (!request.auth) {
      response.status(401).json({ message: 'Authentication is required.' });
      return;
    }
    next();
    return;
  }

  response.status(401).json({ message: 'Authentication is required.' });
};

export const optionalAuth = async (request, response, next) => {
  const header = request.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (token) {
    const auth = verifyAuthToken(token);
    if (!auth) {
      response.status(401).json({ message: 'Authentication is required.' });
      return;
    }
    request.auth = await hydrateAuthFromDatabase(auth);
    next();
    return;
  }

  const sessionAuth = request.session?.auth;
  if (sessionAuth?.username && sessionAuth?.role) {
    request.auth = await hydrateAuthFromDatabase(sessionAuth);
  }

  next();
};

export const requireRole = (...roles) => (request, response, next) => {
  if (!roles.includes(request.auth?.role)) {
    response.status(403).json({ message: 'You do not have permission to perform this action.' });
    return;
  }

  next();
};

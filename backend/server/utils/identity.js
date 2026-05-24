import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import ModuleState from '../models/ModuleState.js';
import User from '../models/User.js';

const STUDENT_NAMESPACE = 'admin-student-management-students';
const TEACHER_NAMESPACE = 'admin-teacher-management-list';
const CLERK_NAMESPACE = 'admin-clerk-management-list';
const CLASS_PREFERENCES_NAMESPACE = 'admin-class-preferences';

export const IDENTITY_SOURCE_NAMESPACES = new Set([
  STUDENT_NAMESPACE,
  TEACHER_NAMESPACE,
  CLERK_NAMESPACE,
  CLASS_PREFERENCES_NAMESPACE,
]);

export const createPasswordHash = (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, storedHash = '') => {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const stored = Buffer.from(hash, 'hex');
  const candidate = scryptSync(password, salt, 64);

  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
};

const normalizeCode = (value = '') =>
  String(value || '').trim().toUpperCase().replace(/\s+/g, '-');

const getClassName = (classRecord = {}) =>
  classRecord.name || classRecord.className || classRecord.class || String(classRecord || '');

const classRank = (className = '') => {
  const normalized = String(className).trim().toLowerCase();
  if (normalized === 'nursery') return -3;
  if (normalized === 'lkg') return -2;
  if (normalized === 'ukg') return -1;
  return Number(String(className).match(/\d+/)?.[0] || 999);
};

const sortClassNames = (classNames = [], preferredClassNames = []) => {
  const preferenceRank = new Map(
    (Array.isArray(preferredClassNames) ? preferredClassNames : [])
      .map(getClassName)
      .filter(Boolean)
      .map((name, index) => [String(name).trim().toLowerCase(), index])
  );
  const hasPreferences = preferenceRank.size > 0;

  return [...new Set((Array.isArray(classNames) ? classNames : []).filter(Boolean))].sort((a, b) => {
    const preferredA = preferenceRank.get(String(a).trim().toLowerCase());
    const preferredB = preferenceRank.get(String(b).trim().toLowerCase());

    if (hasPreferences && preferredA !== undefined && preferredB !== undefined) return preferredA - preferredB;
    if (hasPreferences && preferredA !== undefined) return -1;
    if (hasPreferences && preferredB !== undefined) return 1;

    return classRank(a) - classRank(b) || String(a).localeCompare(String(b));
  });
};

const usernameFor = (role, rawId) => {
  const id = normalizeCode(rawId);
  if (!id) return '';
  if (role === 'student') return id.startsWith('STD-') || id.startsWith('FAM-') ? id : `STD-${id}`;
  if (role === 'teacher') return id.startsWith('TCH-') ? id : `TCH-${id}`;
  if (role === 'clerk') return id.startsWith('CLK-') ? id : `CLK-${id}`;
  if (role === 'admin') return id.startsWith('ADM-') ? id : `ADM-${id}`;
  return id;
};

const initialPasswordFor = (username) => `${username}@MGPS`;

const getStateValue = async (namespace, fallback) => {
  const record = await ModuleState.findOne({ namespace }).lean();
  return record?.value ?? fallback;
};

const normalizeStudentProfile = (student = {}, index = 0) => {
  const raw = student.rawProfile || {};
  const admissionNumber = normalizeCode(student.admissionNumber || student.id || raw.admissionNumber);

  return {
    id: admissionNumber || `student-${index + 1}`,
    displayName: student.name || raw.studentName || student.displayName || `Student ${index + 1}`,
    className: student.class || raw.targetClass || student.className || '',
    section: student.section || raw.section || '',
    rollNo: student.rollNo || index + 1,
    admissionNumber,
    fatherName: student.fatherName || raw.fatherName || '',
    motherName: student.motherName || raw.motherName || '',
    guardianPhone: student.mobile || raw.mobileNo || raw.guardianMobile || '',
    guardianEmail: student.email || raw.email || '',
    dob: student.dob || raw.dob || '',
    gender: student.gender || raw.gender || '',
    bloodGroup: student.bloodGroup || raw.bloodGroup || '',
    house: student.house || raw.house || '',
    busRoute: student.busRoute || raw.busRoute || '',
    address: student.address || raw.permAddress || raw.tempAddress || '',
    photoDataUrl: student.photoDataUrl || raw.photoDataUrl || '',
    status: student.status || 'Active',
  };
};

const upsertGeneratedUser = async ({ username, role, displayName, profile, isActive = true }) => {
  if (!username) return;

  const existing = await User.findOne({ username });
  const initialPassword = existing?.profile?.initialPassword || initialPasswordFor(username);

  await User.findOneAndUpdate(
    { username },
    {
      role,
      displayName,
      profile: {
        ...(existing?.profile || {}),
        ...profile,
        initialPassword,
        managedByIdentitySync: true,
      },
      passwordHash: existing?.passwordHash || createPasswordHash(initialPassword),
      isActive,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const deactivateGeneratedUsersNotIn = async (role, activeUsernames) => {
  await User.updateMany(
    {
      role,
      'profile.managedByIdentitySync': true,
      username: { $nin: [...activeUsernames] },
    },
    { isActive: false }
  );
};

export const syncIdentityUsersFromState = async () => {
  const [students, teachers, clerks, classPreferences] = await Promise.all([
    getStateValue(STUDENT_NAMESPACE, []),
    getStateValue(TEACHER_NAMESPACE, []),
    getStateValue(CLERK_NAMESPACE, []),
    getStateValue(CLASS_PREFERENCES_NAMESPACE, []),
  ]);
  const preferredClassNames = (Array.isArray(classPreferences) ? classPreferences : [])
    .map(getClassName)
    .filter(Boolean);

  const activeStudents = (Array.isArray(students) ? students : []).filter(
    (student) => normalizeCode(student.admissionNumber || student.id || student.rawProfile?.admissionNumber)
  );
  const activeStudentUsernames = new Set();
  const groups = new Map();

  activeStudents.forEach((student) => {
    const groupId = student.siblingGroupId || student.familyId || '';
    if (!groupId) return;
    groups.set(groupId, [...(groups.get(groupId) || []), student]);
  });

  for (const student of activeStudents) {
    const admissionNumber = normalizeCode(student.admissionNumber || student.id || student.rawProfile?.admissionNumber);
    const groupId = student.siblingGroupId || student.familyId || '';
    const group = groupId ? groups.get(groupId) || [] : [];
    const hasSiblingLogin = group.length > 1;
    const soloUsername = usernameFor('student', admissionNumber);

    if (!hasSiblingLogin) {
      activeStudentUsernames.add(soloUsername);
      await upsertGeneratedUser({
        username: soloUsername,
        role: 'student',
        displayName: student.name || student.rawProfile?.studentName || admissionNumber,
        profile: {
          accountDisplayName: `${student.name || admissionNumber} (${soloUsername})`,
          studentProfiles: [normalizeStudentProfile(student)],
          sourceAdmissionNumbers: [admissionNumber],
        },
        isActive: student.status !== 'Passout (Archived)',
      });
      continue;
    }

    await User.updateOne({ username: soloUsername }, { isActive: false });
  }

  for (const [groupId, members] of groups.entries()) {
    if (members.length <= 1) continue;

    const sortedMembers = [...members].sort((a, b) =>
      normalizeCode(a.admissionNumber || a.id).localeCompare(normalizeCode(b.admissionNumber || b.id), undefined, {
        numeric: true,
      })
    );
    const primaryAdmNo = normalizeCode(sortedMembers[0].admissionNumber || sortedMembers[0].id);
    const familyUsername = usernameFor('student', `FAM-${primaryAdmNo}`);
    const activeProfiles = sortedMembers
      .map(normalizeStudentProfile)
      .filter((student) => student.status !== 'Passout (Archived)');

    activeStudentUsernames.add(familyUsername);
    await upsertGeneratedUser({
      username: familyUsername,
      role: 'student',
      displayName: activeProfiles[0]?.displayName || sortedMembers[0].name || groupId,
      profile: {
        accountDisplayName: `Family Account ${groupId}`,
        siblingGroupId: groupId,
        studentProfiles: activeProfiles,
        sourceAdmissionNumbers: sortedMembers.map((student) =>
          normalizeCode(student.admissionNumber || student.id)
        ),
      },
      isActive: activeProfiles.length > 0,
    });
  }

  const activeTeacherUsernames = new Set();
  for (const teacher of Array.isArray(teachers) ? teachers : []) {
    const username = usernameFor('teacher', teacher.id || teacher.empId);
    if (!username) continue;
    activeTeacherUsernames.add(username);
    await upsertGeneratedUser({
      username,
      role: 'teacher',
      displayName: teacher.name || username,
      profile: {
        email: teacher.email || '',
        mobile: teacher.mobile || '',
        photoDataUrl: teacher.photoDataUrl || '',
        allottedClasses: Array.isArray(teacher.classAssignments)
          ? sortClassNames(
              teacher.classAssignments.map((entry) => entry.className).filter(Boolean),
              preferredClassNames
            )
          : [],
        teacherProfile: teacher,
      },
      isActive: teacher.status !== 'Inactive',
    });
  }

  const activeClerkUsernames = new Set();
  for (const clerk of Array.isArray(clerks) ? clerks : []) {
    const username = usernameFor('clerk', clerk.id || clerk.empId);
    if (!username) continue;
    activeClerkUsernames.add(username);
    await upsertGeneratedUser({
      username,
      role: 'clerk',
      displayName: clerk.name || username,
      profile: {
        email: clerk.email || '',
        mobile: clerk.mobile || '',
        photoDataUrl: clerk.photoDataUrl || '',
        clerkProfile: clerk,
      },
      isActive: clerk.status !== 'Inactive',
    });
  }

  await Promise.all([
    deactivateGeneratedUsersNotIn('student', activeStudentUsernames),
    deactivateGeneratedUsersNotIn('teacher', activeTeacherUsernames),
    deactivateGeneratedUsersNotIn('clerk', activeClerkUsernames),
  ]);
};

export const listIdentityUsers = async () => {
  await syncIdentityUsersFromState();
  const users = await User.find().sort({ role: 1, username: 1 }).lean();

  return users.map((user) => {
    const safeProfile = { ...(user.profile || {}) };
    delete safeProfile.initialPassword;

    return {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    isActive: user.isActive,
    initialPassword: user.profile?.initialPassword || '',
      email: user.profile?.email || user.profile?.studentProfiles?.[0]?.guardianEmail || '',
      linkedStudents: user.profile?.studentProfiles || [],
      isSiblingAccount: (user.profile?.studentProfiles || []).length > 1,
      profile: safeProfile,
    };
  });
};

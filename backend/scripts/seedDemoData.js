// Demo-data seeder for the MGPS ERP.
//
// Populates the *master-data* ModuleState namespaces (the same ones the Admin
// web panel writes to) with a realistic school roster, then lets the existing
// identity-sync pipeline provision the actual login accounts. Nothing is
// hard-coded into the app — every record lands in MongoDB exactly as if it had
// been entered through the admin UI.
//
//   Roster:  2 admins · 1 clerk · 14 teachers · 285 students
//   Classes: Nursery, LKG, UKG, Class 1 … Class 10  (in that preference order)
//
// Usage (from backend/):  node scripts/seedDemoData.js
//
// Idempotent: re-running overwrites the same namespaces and upserts the same
// users, so it is safe to run more than once.

import '../server/utils/loadEnv.js';
import mongoose from 'mongoose';

import { connectMongo } from '../server/db.js';
import ModuleState from '../server/models/ModuleState.js';
import User from '../server/models/User.js';
import { createPasswordHash, syncIdentityUsersFromState } from '../server/utils/identity.js';

// ---------------------------------------------------------------------------
// Deterministic PRNG so a re-run reproduces the exact same roster.
// ---------------------------------------------------------------------------
let _seed = 0x9e3779b9;
const rnd = () => {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const randInt = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pad = (n, width = 3) => String(n).padStart(width, '0');

// ---------------------------------------------------------------------------
// Name / attribute pools
// ---------------------------------------------------------------------------
const MALE_FIRST = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Kabir', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Rudra', 'Aryan', 'Dhruv', 'Kartik', 'Yuvraj', 'Om', 'Parth', 'Ansh',
  'Rohan', 'Sarthak', 'Harsh', 'Naman', 'Laksh', 'Devansh', 'Shivansh', 'Ved', 'Ranbir', 'Advait',
];
const FEMALE_FIRST = [
  'Aadhya', 'Ananya', 'Diya', 'Ira', 'Myra', 'Sara', 'Aarohi', 'Anika', 'Navya', 'Kiara',
  'Riya', 'Siya', 'Pari', 'Saanvi', 'Ishita', 'Tara', 'Mahika', 'Avni', 'Prisha', 'Kavya',
  'Meera', 'Nitya', 'Anvi', 'Trisha', 'Zoya', 'Aisha', 'Bhavya', 'Charvi', 'Gauri', 'Jiya',
];
const SURNAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Yadav', 'Mishra', 'Pandey', 'Dubey', 'Tiwari', 'Agarwal',
  'Jain', 'Chauhan', 'Rajput', 'Nigam', 'Saxena', 'Srivastava', 'Tripathi', 'Shukla', 'Rastogi', 'Kushwaha',
];
const MALE_ADULT = ['Rajesh', 'Sunil', 'Manoj', 'Anil', 'Vijay', 'Sanjay', 'Deepak', 'Alok', 'Naveen', 'Pramod', 'Ashok', 'Ramesh'];
const FEMALE_ADULT = ['Nisha', 'Sunita', 'Rekha', 'Poonam', 'Anjali', 'Kavita', 'Meena', 'Seema', 'Ritu', 'Shalini', 'Archana', 'Geeta'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Jain'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const HOUSES = ['Red', 'Blue', 'Green', 'Yellow'];
const CITIES = ['Jhansi', 'Civil Lines', 'Sipri Bazar', 'Gwalior Road', 'Nagra', 'Bijauli', 'Sadar Bazar'];
const BUS_ROUTES = ['Route 1 - Civil Lines', 'Route 2 - Sipri', 'Route 3 - Nagra', 'Route 4 - Sadar', 'Self / Walk-in'];
const QUALIFICATIONS = ['B.Ed, M.A.', 'B.Ed, M.Sc.', 'B.Ed, B.A.', 'M.A., NET', 'M.Sc., B.Ed', 'B.El.Ed', 'M.Com, B.Ed'];

// ---------------------------------------------------------------------------
// Classes (canonical names the app's classRank() understands) + preference order
// ---------------------------------------------------------------------------
const CLASS_NAMES = [
  'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

// Approximate age (years) of a student in each class → drives DOB.
const CLASS_AGE = {
  Nursery: 4, LKG: 5, UKG: 6,
  'Class 1': 7, 'Class 2': 8, 'Class 3': 9, 'Class 4': 10, 'Class 5': 11,
  'Class 6': 12, 'Class 7': 13, 'Class 8': 14, 'Class 9': 15, 'Class 10': 16,
};

// Yearly fee band (₹) by class.
const CLASS_FEE = {
  Nursery: 24000, LKG: 26000, UKG: 28000,
  'Class 1': 30000, 'Class 2': 31000, 'Class 3': 32000, 'Class 4': 34000, 'Class 5': 36000,
  'Class 6': 40000, 'Class 7': 42000, 'Class 8': 44000, 'Class 9': 52000, 'Class 10': 56000,
};

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
const GLOBAL_SUBJECTS = [
  { name: 'English', code: 'ENG' },
  { name: 'Hindi', code: 'HIN' },
  { name: 'Mathematics', code: 'MAT' },
  { name: 'EVS', code: 'EVS' },
  { name: 'Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SST' },
  { name: 'Computer Science', code: 'CS' },
  { name: 'General Knowledge', code: 'GK' },
  { name: 'Drawing', code: 'DRW' },
  { name: 'Physical Education', code: 'PE' },
  { name: 'Sanskrit', code: 'SAN' },
];

const subjectsForClass = (className) => {
  if (['Nursery', 'LKG', 'UKG'].includes(className)) {
    return ['English', 'Hindi', 'Mathematics', 'EVS', 'Drawing', 'General Knowledge'];
  }
  const n = Number(String(className).match(/\d+/)?.[0] || 0);
  if (n <= 5) {
    return ['English', 'Hindi', 'Mathematics', 'EVS', 'Computer Science', 'General Knowledge', 'Drawing', 'Physical Education'];
  }
  return ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Computer Science', 'Sanskrit', 'Physical Education'];
};

// ---------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------
const aadhaar = () => `${randInt(2000, 9999)} ${randInt(1000, 9999)} ${randInt(1000, 9999)}`;
const mobile = () => `9${randInt(1, 9)}${String(randInt(0, 99999999)).padStart(8, '0')}`;
const dobFor = (age) => {
  const year = 2026 - age;
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
};
const slug = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

// ===========================================================================
// STUDENTS  (namespace: admin-student-management-students)
// ===========================================================================
function buildStudents() {
  const students = [];
  let admSeq = 0;

  // 22 per class for the first 12 classes, 21 for the last → 285 total.
  CLASS_NAMES.forEach((className, classIdx) => {
    const count = classIdx < 12 ? 22 : 21;
    const age = CLASS_AGE[className];
    const yearlyFee = CLASS_FEE[className];

    for (let i = 0; i < count; i += 1) {
      admSeq += 1;
      const admissionNumber = `MGPS-2026-${pad(admSeq)}`;
      const gender = rnd() < 0.5 ? 'Male' : 'Female';
      const first = gender === 'Male' ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
      const surname = pick(SURNAMES);
      const studentName = `${first} ${surname}`;
      const fatherName = `${pick(MALE_ADULT)} ${surname}`;
      const motherName = `${pick(FEMALE_ADULT)} ${surname}`;
      const section = i < Math.ceil(count / 2) ? 'A' : 'B';
      const rollNo = (i % Math.ceil(count / 2)) + 1;
      const city = pick(CITIES);
      const address = `${randInt(1, 250)}, ${city}, Jhansi, Uttar Pradesh - 2840${randInt(1, 9)}`;
      const guardianMobile = mobile();
      const email = `${slug(first)}.${slug(surname)}${admSeq}@example.com`;

      // Fee split: most students partly paid.
      const paidFees = Math.round((yearlyFee * randInt(40, 100)) / 100 / 500) * 500;
      const pendingFees = Math.max(0, yearlyFee - paidFees);

      const rawProfile = {
        studentName,
        mobileNo: guardianMobile,
        altMobileNo: mobile(),
        email,
        gender,
        dob: dobFor(age),
        category: pick(CATEGORIES),
        religion: pick(RELIGIONS),
        bloodGroup: pick(BLOOD_GROUPS),
        tempAddress: address,
        permAddress: address,
        admissionNumber,
        studentAadhar: aadhaar(),
        fatherAadhar: aadhaar(),
        motherAadhar: aadhaar(),
        penNumber: `PEN${randInt(100000, 999999)}`,
        dateOfAdmission: '2026-04-01',
        targetClass: className,
        section,
        rollNo,
        house: pick(HOUSES),
        busRoute: pick(BUS_ROUTES),
        lastSchoolName: age > 6 ? pick(['Sunrise Public School', 'Little Angels', 'St. Marys', 'DAV Public School', 'N/A (New Admission)']) : 'N/A (Fresh Admission)',
        fatherName,
        motherName,
        fatherOccupation: pick(['Business', 'Service', 'Farmer', 'Government Employee', 'Self-Employed', 'Doctor', 'Engineer']),
        livingWith: 'Parents',
        guardianName: fatherName,
        guardianMobile,
        guardianAadhar: aadhaar(),
        uploadedFiles: {},
        documents: [],
        importedFrom: 'demo-seed',
        importedAt: new Date().toISOString(),
      };

      students.push({
        admissionNumber,
        id: admissionNumber,
        displayName: studentName,
        name: studentName,
        className,
        class: className,
        section,
        rollNo,
        gender,
        dob: rawProfile.dob,
        bloodGroup: rawProfile.bloodGroup,
        category: rawProfile.category,
        religion: rawProfile.religion,
        house: rawProfile.house,
        busRoute: rawProfile.busRoute,
        lastSchoolName: rawProfile.lastSchoolName,
        mobile: guardianMobile,
        email,
        fatherName,
        motherName,
        guardianName: fatherName,
        guardianPhone: guardianMobile,
        guardianEmail: email,
        address,
        tempAddress: address,
        permAddress: address,
        studentAadhar: rawProfile.studentAadhar,
        penNumber: rawProfile.penNumber,
        dateOfAdmission: rawProfile.dateOfAdmission,
        paidFees,
        pendingFees,
        yearlyFee,
        status: 'Active',
        documents: [],
        rawProfile,
      });
    }
  });

  return students;
}

// ===========================================================================
// TEACHERS  (namespace: admin-teacher-management-list)
// ===========================================================================
function buildTeachers() {
  const teachers = [];
  // 14 teachers: first 13 are the class teachers (one per class), #14 floats.
  for (let i = 0; i < 14; i += 1) {
    const empId = `TCH-2026-${100 + i + 1}`; // TCH-2026-101 .. TCH-2026-114
    const gender = rnd() < 0.5 ? 'Male' : 'Female';
    const first = gender === 'Male' ? pick(MALE_ADULT) : pick(FEMALE_ADULT);
    const surname = pick(SURNAMES);
    const name = `${first} ${surname}`;
    const maritalStatus = rnd() < 0.7 ? 'Married' : 'Single';
    const isMarriedWoman = gender === 'Female' && maritalStatus === 'Married';

    const ownClass = i < 13 ? CLASS_NAMES[i] : null;
    const isClassTeacher = ownClass ? 'Yes' : 'No';

    // Primary subject: a valid subject for the teacher's own class (or a random
    // secondary-level class for the floating teacher).
    const anchorClass = ownClass || pick(CLASS_NAMES.slice(8));
    const anchorSubjects = subjectsForClass(anchorClass);
    const primarySubject = anchorSubjects[i % anchorSubjects.length];

    // Class assignments: own/anchor class + up to two more classes that also
    // teach the same subject.
    const classAssignments = [{ className: anchorClass, subject: primarySubject }];
    const others = CLASS_NAMES
      .filter((c) => c !== anchorClass && subjectsForClass(c).includes(primarySubject));
    const extra = randInt(1, 2);
    for (let k = 0; k < extra && others.length; k += 1) {
      const c = others.splice(Math.floor(rnd() * others.length), 1)[0];
      classAssignments.push({ className: c, subject: primarySubject });
    }

    teachers.push({
      id: empId,
      name,
      email: `${slug(first)}.${slug(surname)}@mgps.edu.in`,
      mobile: mobile(),
      gender,
      dob: dobFor(randInt(28, 55)),
      maritalStatus,
      category: pick(CATEGORIES),
      bloodGroup: pick(BLOOD_GROUPS),
      address: `${randInt(1, 200)}, ${pick(CITIES)}, Jhansi, Uttar Pradesh - 2840${randInt(1, 9)}`,
      aadharNumber: String(randInt(200000000000, 999999999999)),
      fatherName: isMarriedWoman ? '' : `${pick(MALE_ADULT)} ${surname}`,
      husbandName: isMarriedWoman ? `${pick(MALE_ADULT)} ${surname}` : '',
      dateOfJoining: `20${randInt(15, 25)}-0${randInt(4, 7)}-${pad(randInt(1, 28), 2)}`,
      designation: primarySubject === 'Physical Education' ? 'PET Instructor' : 'Assistant Teacher',
      qualification: pick(QUALIFICATIONS),
      subjectSpecialization: primarySubject,
      experience: [
        {
          organization: pick(['Sunrise Public School', 'DAV Public School', 'Kendriya Vidyalaya', 'St. Marys']),
          position: 'Teacher',
          years: String(randInt(2, 12)),
        },
      ],
      classAssignments,
      isClassTeacher,
      assignedClassTeacherFor: ownClass || '',
      status: 'Active',
      documentsAttached: ['resume.pdf', 'aadhaar.pdf', 'degree.pdf'],
    });
  }
  return teachers;
}

// ===========================================================================
// CLERK  (namespace: admin-clerk-management-list)
// ===========================================================================
function buildClerks() {
  const gender = rnd() < 0.5 ? 'Male' : 'Female';
  const first = gender === 'Male' ? pick(MALE_ADULT) : pick(FEMALE_ADULT);
  const surname = pick(SURNAMES);
  return [
    {
      id: 'CLK-2026-101',
      name: `${first} ${surname}`,
      email: `${slug(first)}.${slug(surname)}@mgps.edu.in`,
      mobile: mobile(),
      gender,
      dob: dobFor(randInt(26, 50)),
      aadharNumber: String(randInt(200000000000, 999999999999)),
      category: pick(CATEGORIES),
      address: `${randInt(1, 200)}, ${pick(CITIES)}, Jhansi, Uttar Pradesh - 2840${randInt(1, 9)}`,
      designation: 'Office Clerk',
      dateOfJoining: `20${randInt(18, 25)}-0${randInt(4, 7)}-${pad(randInt(1, 28), 2)}`,
      status: 'Active',
      documentsAttached: ['aadhaar.pdf', 'resume.pdf'],
    },
  ];
}

// ===========================================================================
// CLASSES + PREFERENCES + SUBJECT MAPPING (derived from the roster above)
// ===========================================================================
function buildClassArtifacts(students, teachers) {
  const classPreferences = CLASS_NAMES.map((name, idx) => ({ id: `CLS-PREF-${idx + 1}`, name }));

  const countByClass = students.reduce((acc, s) => {
    acc[s.className] = (acc[s.className] || 0) + 1;
    return acc;
  }, {});

  const classTeacherByClass = teachers.reduce((acc, t) => {
    if (t.isClassTeacher === 'Yes' && t.assignedClassTeacherFor) {
      acc[t.assignedClassTeacherFor] = t;
    }
    return acc;
  }, {});

  const managedClasses = CLASS_NAMES.map((name, idx) => {
    const ct = classTeacherByClass[name];
    return {
      id: `CLS-${idx + 1}`,
      name,
      studentCount: countByClass[name] || 0,
      classTeacherId: ct?.id || '',
      classTeacherName: ct?.name || '',
      teacher: ct?.name || '',
    };
  });

  const classSubjectMapping = CLASS_NAMES.map((name) => ({
    className: name,
    subjects: subjectsForClass(name),
  }));

  return { classPreferences, managedClasses, classSubjectMapping };
}

// ---------------------------------------------------------------------------
// Persist one ModuleState namespace.
// ---------------------------------------------------------------------------
async function putState(namespace, value) {
  await ModuleState.findOneAndUpdate(
    { namespace },
    { value },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// ---------------------------------------------------------------------------
// Admins — created directly as User docs (mirrors POST /auth/users/admins).
// ---------------------------------------------------------------------------
const ADMINS = [
  { username: 'ADM-PRINCIPAL', displayName: 'Dr. Rakesh Chaturvedi', designation: 'Principal', email: 'principal@mgps.edu.in', mobile: '9812345670' },
  { username: 'ADM-DIRECTOR', displayName: 'Mrs. Sunita Vijayvargeeya', designation: 'Director', email: 'director@mgps.edu.in', mobile: '9812345671' },
];

async function upsertAdmins() {
  for (const a of ADMINS) {
    const initialPassword = `${a.username}@MGPS`;
    const existing = await User.findOne({ username: a.username });
    await User.findOneAndUpdate(
      { username: a.username },
      {
        role: 'admin',
        displayName: a.displayName,
        isActive: true,
        passwordHash: existing?.passwordHash || createPasswordHash(initialPassword),
        profile: {
          ...(existing?.profile || {}),
          displayName: a.displayName,
          accountDisplayName: `${a.displayName} (${a.username})`,
          email: a.email,
          mobile: a.mobile,
          designation: a.designation,
          initialPassword: existing?.profile?.initialPassword || initialPassword,
          managedByAdminPanel: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

// ===========================================================================
// Main
// ===========================================================================
async function main() {
  const connection = await connectMongo();
  if (!connection || mongoose.connection.readyState !== 1) {
    console.error('❌ Could not connect to MongoDB. Check MONGODB_URI in backend/.env');
    process.exit(1);
  }

  console.log('🔗 MongoDB connected. Generating demo roster…');

  const students = buildStudents();
  const teachers = buildTeachers();
  const clerks = buildClerks();
  const { classPreferences, managedClasses, classSubjectMapping } = buildClassArtifacts(students, teachers);

  // 1) Master data → ModuleState (exactly what the admin web panel would write).
  await putState('admin-class-preferences', classPreferences);
  await putState('admin-class-management-classes', managedClasses);
  await putState('admin-subjects-global', GLOBAL_SUBJECTS.map((s, i) => ({ id: `SUB-${100 + i}`, ...s })));
  await putState('admin-subjects-class-mapping', classSubjectMapping);
  await putState('admin-teacher-management-list', teachers);
  await putState('admin-clerk-management-list', clerks);
  await putState('admin-student-management-students', students);
  console.log('📦 Master-data namespaces written.');

  // 2) Admins (direct User docs).
  await upsertAdmins();
  console.log(`👤 ${ADMINS.length} admin accounts upserted.`);

  // 3) Provision student/teacher/clerk logins from the master data.
  await syncIdentityUsersFromState();
  console.log('🔐 Identity sync complete (student/teacher/clerk logins provisioned).');

  // Verify counts.
  const [adminCount, teacherCount, clerkCount, studentCount] = await Promise.all([
    User.countDocuments({ role: 'admin', isActive: true }),
    User.countDocuments({ role: 'teacher', isActive: true }),
    User.countDocuments({ role: 'clerk', isActive: true }),
    User.countDocuments({ role: 'student', isActive: true }),
  ]);

  console.log('\n================= SEED SUMMARY =================');
  console.log(`Admins   (active logins): ${adminCount}`);
  console.log(`Teachers (active logins): ${teacherCount}   [master records: ${teachers.length}]`);
  console.log(`Clerks   (active logins): ${clerkCount}   [master records: ${clerks.length}]`);
  console.log(`Students (active logins): ${studentCount}   [master records: ${students.length}]`);
  console.log(`Classes: ${managedClasses.length}  →  ${CLASS_NAMES.join(', ')}`);
  console.log('\nSample credentials (password = <username>@MGPS):');
  console.log(`  Admin   : ${ADMINS[0].username}                / ${ADMINS[0].username}@MGPS`);
  console.log(`  Admin   : ${ADMINS[1].username}                 / ${ADMINS[1].username}@MGPS`);
  console.log(`  Clerk   : CLK-2026-101                / CLK-2026-101@MGPS`);
  console.log(`  Teacher : ${teachers[0].id}                / ${teachers[0].id}@MGPS`);
  console.log(`  Student : STD-${students[0].admissionNumber}    / STD-${students[0].admissionNumber}@MGPS`);
  console.log('================================================\n');

  await mongoose.disconnect();
  console.log('✅ Done. Disconnected.');
  process.exit(0);
}

main().catch(async (error) => {
  console.error('❌ Seed failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

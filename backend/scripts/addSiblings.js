// Adds 10 *sibling* students to the existing roster, grouped into families.
//
// The app links siblings by a shared `siblingGroupId` — any group with more than
// one member is provisioned as a single family login (username FAM-<primaryAdm>)
// whose `studentProfiles` array holds every sibling. Here we add 4 families
// (3 + 2 + 3 + 2 = 10 students), each sharing surname / parents / address but in
// different classes with their own admission numbers.
//
// Usage (from backend/):  node scripts/addSiblings.js
// Idempotent: re-running detects the same families and skips duplicates.

import '../server/utils/loadEnv.js';
import mongoose from 'mongoose';

import { connectMongo } from '../server/db.js';
import ModuleState from '../server/models/ModuleState.js';
import User from '../server/models/User.js';
import { syncIdentityUsersFromState } from '../server/utils/identity.js';

const STUDENT_NS = 'admin-student-management-students';

// Deterministic PRNG (different seed from the main seeder so names vary).
let _seed = 0x51ed270b;
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
const slug = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

const MALE_FIRST = ['Aarav', 'Vivaan', 'Arjun', 'Kabir', 'Ayaan', 'Ishaan', 'Aryan', 'Dhruv', 'Kartik', 'Rohan', 'Harsh', 'Ved'];
const FEMALE_FIRST = ['Aadhya', 'Ananya', 'Diya', 'Myra', 'Anika', 'Navya', 'Kiara', 'Riya', 'Ishita', 'Avni', 'Kavya', 'Meera'];
const MALE_ADULT = ['Rajesh', 'Sunil', 'Manoj', 'Anil', 'Vijay', 'Sanjay', 'Deepak', 'Naveen', 'Ashok', 'Ramesh'];
const FEMALE_ADULT = ['Nisha', 'Sunita', 'Rekha', 'Anjali', 'Kavita', 'Seema', 'Ritu', 'Archana', 'Geeta'];
const SURNAMES = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Mishra', 'Pandey', 'Tiwari', 'Agarwal', 'Chauhan', 'Saxena'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Jain'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const HOUSES = ['Red', 'Blue', 'Green', 'Yellow'];
const CITIES = ['Jhansi', 'Civil Lines', 'Sipri Bazar', 'Gwalior Road', 'Nagra', 'Sadar Bazar'];
const BUS_ROUTES = ['Route 1 - Civil Lines', 'Route 2 - Sipri', 'Route 3 - Nagra', 'Route 4 - Sadar', 'Self / Walk-in'];

const CLASS_NAMES = [
  'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const CLASS_AGE = {
  Nursery: 4, LKG: 5, UKG: 6,
  'Class 1': 7, 'Class 2': 8, 'Class 3': 9, 'Class 4': 10, 'Class 5': 11,
  'Class 6': 12, 'Class 7': 13, 'Class 8': 14, 'Class 9': 15, 'Class 10': 16,
};
const CLASS_FEE = {
  Nursery: 24000, LKG: 26000, UKG: 28000,
  'Class 1': 30000, 'Class 2': 31000, 'Class 3': 32000, 'Class 4': 34000, 'Class 5': 36000,
  'Class 6': 40000, 'Class 7': 42000, 'Class 8': 44000, 'Class 9': 52000, 'Class 10': 56000,
};

const aadhaar = () => `${randInt(2000, 9999)} ${randInt(1000, 9999)} ${randInt(1000, 9999)}`;
const mobile = () => `9${randInt(1, 9)}${String(randInt(0, 99999999)).padStart(8, '0')}`;
const dobFor = (age) => `${2026 - age}-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}`;

// Build one student record (shape identical to the main seeder), merging the
// family-shared attributes so the identity pipeline groups them together.
function makeSibling({ admSeq, className, shared, groupId }) {
  const admissionNumber = `MGPS-2026-${pad(admSeq)}`;
  const age = CLASS_AGE[className];
  const yearlyFee = CLASS_FEE[className];
  const gender = rnd() < 0.5 ? 'Male' : 'Female';
  const first = gender === 'Male' ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
  const studentName = `${first} ${shared.surname}`;
  const email = shared.email; // parents share a contact email
  const paidFees = Math.round((yearlyFee * randInt(40, 100)) / 100 / 500) * 500;
  const pendingFees = Math.max(0, yearlyFee - paidFees);

  const rawProfile = {
    studentName,
    mobileNo: shared.guardianMobile,
    altMobileNo: shared.altMobile,
    email,
    gender,
    dob: dobFor(age),
    category: shared.category,
    religion: shared.religion,
    bloodGroup: pick(BLOOD_GROUPS),
    tempAddress: shared.address,
    permAddress: shared.address,
    admissionNumber,
    studentAadhar: aadhaar(),
    fatherAadhar: shared.fatherAadhar,
    motherAadhar: shared.motherAadhar,
    penNumber: `PEN${randInt(100000, 999999)}`,
    dateOfAdmission: '2026-04-01',
    targetClass: className,
    section: 'A',
    rollNo: randInt(1, 20),
    house: shared.house,
    busRoute: shared.busRoute,
    lastSchoolName: age > 6 ? 'N/A (Sibling Admission)' : 'N/A (Fresh Admission)',
    fatherName: shared.fatherName,
    motherName: shared.motherName,
    fatherOccupation: shared.fatherOccupation,
    livingWith: 'Parents',
    guardianName: shared.fatherName,
    guardianMobile: shared.guardianMobile,
    guardianAadhar: shared.fatherAadhar,
    uploadedFiles: {},
    documents: [],
    importedFrom: 'demo-seed-siblings',
    importedAt: new Date().toISOString(),
  };

  return {
    admissionNumber,
    id: admissionNumber,
    displayName: studentName,
    name: studentName,
    className,
    class: className,
    section: 'A',
    rollNo: rawProfile.rollNo,
    gender,
    dob: rawProfile.dob,
    bloodGroup: rawProfile.bloodGroup,
    category: shared.category,
    religion: shared.religion,
    house: shared.house,
    busRoute: shared.busRoute,
    lastSchoolName: rawProfile.lastSchoolName,
    mobile: shared.guardianMobile,
    email,
    fatherName: shared.fatherName,
    motherName: shared.motherName,
    guardianName: shared.fatherName,
    guardianPhone: shared.guardianMobile,
    guardianEmail: email,
    address: shared.address,
    tempAddress: shared.address,
    permAddress: shared.address,
    studentAadhar: rawProfile.studentAadhar,
    penNumber: rawProfile.penNumber,
    dateOfAdmission: rawProfile.dateOfAdmission,
    paidFees,
    pendingFees,
    yearlyFee,
    status: 'Active',
    documents: [],
    // Sibling linkage — the field the identity pipeline groups on.
    siblingGroupId: groupId,
    familyId: groupId,
    rawProfile,
  };
}

// Build a shared family-attribute bundle.
function makeFamily(index) {
  const surname = pick(SURNAMES);
  const fatherName = `${pick(MALE_ADULT)} ${surname}`;
  const motherName = `${pick(FEMALE_ADULT)} ${surname}`;
  const city = pick(CITIES);
  return {
    surname,
    fatherName,
    motherName,
    fatherAadhar: aadhaar(),
    motherAadhar: aadhaar(),
    fatherOccupation: pick(['Business', 'Service', 'Government Employee', 'Doctor', 'Engineer', 'Self-Employed']),
    guardianMobile: mobile(),
    altMobile: mobile(),
    email: `${slug(surname)}.family${index}@example.com`,
    category: pick(CATEGORIES),
    religion: pick(RELIGIONS),
    house: pick(HOUSES),
    busRoute: pick(BUS_ROUTES),
    address: `${randInt(1, 250)}, ${city}, Jhansi, Uttar Pradesh - 2840${randInt(1, 9)}`,
  };
}

async function main() {
  const connection = await connectMongo();
  if (!connection || mongoose.connection.readyState !== 1) {
    console.error('❌ Could not connect to MongoDB. Check MONGODB_URI in backend/.env');
    process.exit(1);
  }
  console.log('🔗 MongoDB connected.');

  const rec = await ModuleState.findOne({ namespace: STUDENT_NS });
  const students = Array.isArray(rec?.value) ? [...rec.value] : [];

  if (students.some((s) => s.siblingGroupId || s.familyId)) {
    console.log('ℹ️  Sibling students already present — nothing to add. Exiting.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Next admission sequence.
  const maxSeq = students.reduce((max, s) => {
    const n = Number(String(s.admissionNumber || '').match(/(\d+)$/)?.[1] || 0);
    return n > max ? n : max;
  }, 0);
  let seq = maxSeq;

  // 4 families → 3 + 2 + 3 + 2 = 10 siblings.
  const familySizes = [3, 2, 3, 2];
  // Distinct classes per family so siblings land in different grades.
  const classPools = [
    ['Class 1', 'Class 4', 'Class 8'],
    ['Nursery', 'Class 3'],
    ['LKG', 'Class 2', 'Class 6'],
    ['Class 5', 'Class 9'],
  ];

  const added = [];
  const summary = [];
  familySizes.forEach((size, fIdx) => {
    const shared = makeFamily(fIdx + 1);
    const groupId = `FAMILY-2026-${fIdx + 1}`;
    const members = [];
    for (let i = 0; i < size; i += 1) {
      seq += 1;
      const className = classPools[fIdx][i] || pick(CLASS_NAMES);
      const student = makeSibling({ admSeq: seq, className, shared, groupId });
      added.push(student);
      members.push(student);
    }
    const primaryAdm = members
      .map((m) => m.admissionNumber)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
    summary.push({
      family: `${shared.fatherName} / ${shared.motherName}`,
      login: `FAM-${primaryAdm}`,
      members: members.map((m) => `${m.name} (${m.admissionNumber}, ${m.className})`),
    });
  });

  const nextStudents = [...students, ...added];
  await ModuleState.findOneAndUpdate(
    { namespace: STUDENT_NS },
    { value: nextStudents },
    { upsert: true, setDefaultsOnInsert: true }
  );
  console.log(`📦 Appended ${added.length} sibling students → total now ${nextStudents.length}.`);

  await syncIdentityUsersFromState();
  console.log('🔐 Identity sync complete.');

  const [studentLogins, familyLogins] = await Promise.all([
    User.countDocuments({ role: 'student', isActive: true }),
    User.find({ role: 'student', 'profile.siblingGroupId': { $exists: true }, isActive: true })
      .select('username displayName profile.studentProfiles')
      .lean(),
  ]);

  console.log('\n============== SIBLINGS ADDED ==============');
  summary.forEach((f) => {
    console.log(`\n👨‍👩‍👧 Family: ${f.family}`);
    console.log(`   Login: ${f.login}  (password: ${f.login}@MGPS)`);
    f.members.forEach((m) => console.log(`     • ${m}`));
  });
  console.log(`\nTotal student logins (active): ${studentLogins}`);
  console.log(`Family (sibling) login accounts: ${familyLogins.length}`);
  familyLogins.forEach((f) => {
    console.log(`   - ${f.username}: ${(f.profile?.studentProfiles || []).length} children`);
  });
  console.log('============================================\n');

  await mongoose.disconnect();
  console.log('✅ Done. Disconnected.');
  process.exit(0);
}

main().catch(async (error) => {
  console.error('❌ Failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

export const TEACHER_TEMPLATE_COLUMNS = [
  'teacherId',
  'name',
  'email',
  'mobile',
  'gender',
  'dob',
  'maritalStatus',
  'category',
  'aadharNumber',
  'fatherName',
  'husbandName',
  'address',
  'dateOfJoining',
  'isClassTeacher',
  'assignedClassTeacherFor',
  'classAssignments',
  'experience',
  'status',
];

export const TEACHER_SAMPLE_ROWS = [
  {
    teacherId: 'TCH-DEMO-001',
    name: 'Demo Teacher',
    email: 'demo.teacher@example.com',
    mobile: '9000000001',
    gender: 'Female',
    dob: '1990-05-12',
    maritalStatus: 'Single',
    category: 'General',
    aadharNumber: '',
    fatherName: 'Demo Parent',
    husbandName: '',
    address: 'Demo Address',
    dateOfJoining: '2024-04-01',
    isClassTeacher: 'Yes',
    assignedClassTeacherFor: 'Class 6',
    classAssignments: 'Class 6:Mathematics;Class 7:Science',
    experience: 'Demo School|Teacher|3',
    status: 'Active',
  },
];

const cell = (value) => String(value ?? '').trim();
const dateCell = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  }
  return cell(value);
};
const splitPairs = (value, fields, separator = '|') =>
  cell(value)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const values = part.split(separator).map((entry) => entry.trim());
      return Object.fromEntries(fields.map((field, index) => [field, values[index] || '']));
    });

export const buildTeacherImportRecord = (row = {}) => {
  const id = cell(row.teacherId || row.id || row.empId || row['Teacher ID'] || row['Employee ID']).toUpperCase();
  const name = cell(row.name || row.teacherName || row['Teacher Name'] || row['Full Name']);
  if (!id || !name) return { error: 'Teacher ID and name are required.' };

  const email = cell(row.email || row.Email);
  const mobile = cell(row.mobile || row.phone || row['Mobile Number']);
  const gender = cell(row.gender || row.Gender);
  const dob = dateCell(row.dob || row['Date of Birth']);
  const address = cell(row.address || row.Address);
  if (!email || !mobile || !gender || !dob || !address) {
    return { error: 'Email, mobile, gender, date of birth, and address are required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Email address is invalid.' };
  }
  if (!['Male', 'Female', 'Other'].includes(gender)) {
    return { error: 'Gender must be Male, Female, or Other.' };
  }
  const parsedDob = new Date(`${dob}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
    Number.isNaN(parsedDob.getTime()) ||
    parsedDob.toISOString().slice(0, 10) !== dob
  ) {
    return { error: 'Date of birth must use YYYY-MM-DD format.' };
  }

  const aadharNumber = cell(row.aadharNumber || row.aadhaar || row['Aadhaar Number']).replace(/\s/g, '');
  if (aadharNumber && !/^\d{12}$/.test(aadharNumber)) {
    return { error: 'Aadhaar must contain exactly 12 digits when provided.' };
  }

  const maritalStatus = cell(row.maritalStatus || row['Marital Status']) || 'Single';
  if (!['Single', 'Married', 'Divorced'].includes(maritalStatus)) {
    return { error: 'Marital status must be Single, Married, or Divorced.' };
  }
  const category = cell(row.category || row.Category) || 'General';
  if (!['General', 'OBC', 'SC', 'ST'].includes(category)) {
    return { error: 'Category must be General, OBC, SC, or ST.' };
  }
  const fatherName = cell(row.fatherName || row['Father Name']);
  const husbandName = cell(row.husbandName || row['Husband Name']);
  if (gender === 'Female' && maritalStatus === 'Married' ? !husbandName : !fatherName) {
    return { error: 'Provide the father name, or husband name for a married female teacher.' };
  }

  const rawAssignments = cell(row.classAssignments || row['Class Assignments']);
  const classAssignments = splitPairs(rawAssignments, ['className', 'subject'], ':');
  if (classAssignments.some((assignment) => !assignment.className || !assignment.subject)) {
    return { error: 'Class assignments must use "Class Name:Subject" pairs separated by semicolons.' };
  }
  const rawExperience = cell(row.experience || row.Experience);
  const experience = splitPairs(rawExperience, [
    'organization',
    'position',
    'years',
  ]);
  if (
    experience.some(
      (entry) =>
        !entry.organization ||
        !entry.position ||
        (entry.years && !/^\d+(\.\d+)?$/.test(entry.years))
    )
  ) {
    return { error: 'Experience entries must use "Organization|Position|Years" pairs.' };
  }
  const isClassTeacher = /^yes|true|1$/i.test(
    cell(row.isClassTeacher || row['Is Class Teacher'])
  ) ? 'Yes' : 'No';
  const assignedClassTeacherFor =
    isClassTeacher === 'Yes'
      ? cell(row.assignedClassTeacherFor || row['Assigned Class']) || ''
      : '';
  if (isClassTeacher === 'Yes' && !assignedClassTeacherFor) {
    return { error: 'Assigned class is required for a class teacher.' };
  }
  const status = cell(row.status || row.Status) || 'Active';
  if (!['Active', 'Inactive'].includes(status)) {
    return { error: 'Status must be Active or Inactive.' };
  }

  return {
    record: {
      id,
      empId: id,
      name,
      displayName: name,
      email,
      mobile,
      gender,
      dob,
      maritalStatus,
      category,
      aadharNumber,
      fatherName: maritalStatus === 'Married' && gender === 'Female' ? '' : fatherName,
      husbandName: maritalStatus === 'Married' && gender === 'Female'
        ? husbandName
        : '',
      address,
      dateOfJoining: dateCell(row.dateOfJoining || row['Date of Joining']),
      isClassTeacher,
      assignedClassTeacherFor,
      classAssignments,
      experience,
      status,
      documentsAttached: [],
    },
  };
};

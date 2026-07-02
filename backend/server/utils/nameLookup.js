import ModuleState from '../models/ModuleState.js';
import User from '../models/User.js';

const STUDENT_NAMESPACE = 'admin-student-management-students';
const TEACHER_NAMESPACE = 'admin-teacher-management-list';
const CLERK_NAMESPACE = 'admin-clerk-management-list';

const CACHE_TTL_MS = 30 * 1000;

// namespace -> { expires:number, map:Map<normalizedKey,name> }
const stateCache = new Map();

const norm = (value = '') => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '-');

// A username like STD-123 / FAM-123 / TCH-9 / CLK-4 / ADM-1 maps back to the
// bare id (123 / 9 / 4 / 1) that the ModuleState list entries are keyed on.
const stripRolePrefix = (value = '') => norm(value).replace(/^(STD|FAM|TCH|CLK|ADM)-/, '');

const getStateArray = async (namespace) => {
  const cached = stateCache.get(namespace);
  if (cached && cached.expires > Date.now()) return cached.map;

  const record = await ModuleState.findOne({ namespace }).lean();
  const value = Array.isArray(record?.value) ? record.value : [];
  const map = new Map();

  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const name =
      entry.name ||
      entry.rawProfile?.studentName ||
      entry.displayName ||
      '';
    if (!name) return;

    // Index by every id-like field so any of them resolves to the name.
    const keys = [
      entry.id,
      entry.empId,
      entry.admissionNumber,
      entry.rawProfile?.admissionNumber,
    ];
    keys.forEach((key) => {
      const normalized = norm(key);
      if (normalized) map.set(normalized, name);
    });
  });

  stateCache.set(namespace, { expires: Date.now() + CACHE_TTL_MS, map });
  return map;
};

/**
 * Resolve a raw username / role-id / admission number to a human display name.
 *
 * Order: teacher list -> clerk list -> student list -> User.displayName.
 * Falls back to the original username string when nothing matches.
 *
 * @param {string} username e.g. "TCH-983", "CLK-001", "STD-2024015", "ADM-001", "12"
 * @returns {Promise<string>} human name, or the trimmed username if unresolved
 */
export const resolveDisplayName = async (username) => {
  const raw = String(username ?? '').trim();
  if (!raw) return '';

  const bareId = stripRolePrefix(raw);

  const [teachers, clerks, students] = await Promise.all([
    getStateArray(TEACHER_NAMESPACE),
    getStateArray(CLERK_NAMESPACE),
    getStateArray(STUDENT_NAMESPACE),
  ]);

  const fromLists =
    teachers.get(bareId) ||
    teachers.get(norm(raw)) ||
    clerks.get(bareId) ||
    clerks.get(norm(raw)) ||
    students.get(bareId) ||
    students.get(norm(raw));
  if (fromLists) return fromLists;

  // Fallback: the generated User account carries a displayName (covers admins
  // and anyone whose list entry has been archived/removed).
  const user = await User.findOne({ username: norm(raw) }).select('displayName').lean();
  if (user?.displayName) return user.displayName;

  return raw;
};

/**
 * Resolve many usernames at once, de-duplicating lookups.
 * @param {string[]} usernames
 * @returns {Promise<Map<string,string>>} original username -> resolved name
 */
export const resolveDisplayNames = async (usernames = []) => {
  const unique = [...new Set((Array.isArray(usernames) ? usernames : []).map((u) => String(u ?? '').trim()).filter(Boolean))];
  const entries = await Promise.all(unique.map(async (username) => [username, await resolveDisplayName(username)]));
  return new Map(entries);
};

export const ROLLOVER_CLEARED_MODEL_NAMES = Object.freeze([
  'Assignment',
  'Application',
  'LeaveRequest',
  'Notification',
  'Meeting',
]);

export const ROLLOVER_CLEARED_MODULE_STATE_NAMESPACES = Object.freeze([
  'admin-notices-list',
]);

export const sanitizeRolloverSnapshot = (
  snapshot,
  { clearedTableNames = [], moduleStateTableName = '' } = {}
) => {
  const tables = { ...snapshot.tables };
  let changed = false;

  for (const tableName of clearedTableNames) {
    if (Object.hasOwn(tables, tableName)) {
      delete tables[tableName];
      changed = true;
    }
  }

  if (moduleStateTableName && Array.isArray(tables[moduleStateTableName])) {
    const clearedNamespaces = new Set(ROLLOVER_CLEARED_MODULE_STATE_NAMESPACES);
    const retainedRows = tables[moduleStateTableName].filter((row) => {
      const namespace = row?.namespace || row?.legacy_document?.namespace;
      return !clearedNamespaces.has(namespace);
    });
    if (retainedRows.length !== tables[moduleStateTableName].length) {
      tables[moduleStateTableName] = retainedRows;
      changed = true;
    }
  }

  const recordCount = Object.values(tables).reduce(
    (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
    0
  );
  if (snapshot.recordCount !== recordCount) changed = true;

  return {
    changed,
    snapshot: {
      ...snapshot,
      recordCount,
      tables,
    },
  };
};

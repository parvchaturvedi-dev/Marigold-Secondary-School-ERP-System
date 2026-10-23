import express from 'express';
import { randomUUID } from 'node:crypto';
import ModuleState from '../models/ModuleState.js';
import { getPostgresPool, isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { createNotification } from '../utils/notify.js';

const router = express.Router();

const STUDENTS_NAMESPACE = 'admin-student-management-students';
const CLASSES_NAMESPACE = 'admin-class-management-classes';
const CLASS_PREFERENCES_NAMESPACE = 'admin-class-preferences';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ensureDatabase = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }
  next();
};

router.use(ensureDatabase, requireRole('admin'));

const readState = async (namespace) => {
  const record = await ModuleState.findOne({ namespace }).lean();
  return Array.isArray(record?.value) ? record.value : [];
};

const getStudentClassName = (student = {}) =>
  student.className || student.class || student.rawProfile?.targetClass || '';

const normalizeStudent = (student = {}, index = 0) => {
  const raw = student.rawProfile || {};
  const admissionNumber = String(
    student.admissionNumber || student.id || raw.admissionNumber || ''
  ).trim();
  return {
    id: admissionNumber,
    admissionNumber,
    displayName:
      student.displayName || student.name || raw.studentName || `Student ${index + 1}`,
    className: String(getStudentClassName(student)).trim(),
    section: student.section || raw.section || '',
    rollNo: Number(student.rollNo || raw.rollNo || index + 1),
  };
};

const getSchoolData = async () => {
  const [studentRecords, classRecords, preferences] = await Promise.all([
    readState(STUDENTS_NAMESPACE),
    readState(CLASSES_NAMESPACE),
    readState(CLASS_PREFERENCES_NAMESPACE),
  ]);
  const seenStudentIds = new Set();
  const students = studentRecords.map(normalizeStudent).filter((student) => {
    if (!student.id || !student.className || seenStudentIds.has(student.id)) return false;
    seenStudentIds.add(student.id);
    return true;
  });
  const preferred = preferences
    .map((entry) =>
      typeof entry === 'string' ? entry : entry?.name || entry?.className || entry?.class || ''
    )
    .filter(Boolean);
  const classNames = [
    ...new Set([
      ...preferred,
      ...classRecords.map((entry) => entry?.name || entry?.className || entry?.class || ''),
      ...students.map((student) => student.className),
    ]),
  ].filter(Boolean);
  const rank = new Map(preferred.map((name, index) => [name, index]));
  classNames.sort(
    (a, b) =>
      (rank.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b) ?? Number.MAX_SAFE_INTEGER) ||
      String(a).localeCompare(String(b), undefined, { numeric: true })
  );
  return { students, classNames };
};

const toItem = (row) => {
  const purchasePrice = Number(row.purchase_price);
  const sellingPrice = Number(row.selling_price);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    quantityReceived: Number(row.quantity_received),
    stockQuantity: Number(row.stock_quantity),
    purchasePrice,
    sellingPrice,
    purchaseExpense: Number(row.purchase_expense),
    unitProfit: Number((sellingPrice - purchasePrice).toFixed(2)),
    active: row.active,
    createdAt: row.created_at,
  };
};

const roundMoney = (amount) => Number(Number(amount || 0).toFixed(2));

const readInventoryReport = async () => {
  const pool = getPostgresPool();
  const [itemsResult, issuesResult, schoolData] = await Promise.all([
    pool.query(
      `SELECT id, name, category, description, quantity_received, stock_quantity,
              purchase_price, stock_cost_value, selling_price, purchase_expense, active, created_at
       FROM public.inventory_items
       WHERE active = TRUE
       ORDER BY name, created_at`
    ),
    pool.query(
      `SELECT item_id, student_id, student_name, class_name, purchase_price,
              selling_price, issued_at
       FROM public.inventory_issues`
    ),
    getSchoolData(),
  ]);

  const items = itemsResult.rows.map(toItem);
  const issuesByItem = new Map();
  const issuesByClassAndItem = new Map();
  let issuedCost = 0;
  let revenue = 0;

  for (const issue of issuesResult.rows) {
    const purchasePrice = Number(issue.purchase_price);
    const sellingPrice = Number(issue.selling_price);
    const issueItemId = issue.item_id;
    const classKey = `${issue.class_name}\u0000${issueItemId}`;
    issuesByItem.set(issueItemId, [...(issuesByItem.get(issueItemId) || []), issue]);
    issuesByClassAndItem.set(classKey, [...(issuesByClassAndItem.get(classKey) || []), issue]);
    issuedCost += purchasePrice;
    revenue += sellingPrice;
  }

  const studentCountsByClass = new Map();
  for (const student of schoolData.students) {
    studentCountsByClass.set(
      student.className,
      (studentCountsByClass.get(student.className) || 0) + 1
    );
  }

  const itemReports = items.map((item) => {
    const issues = issuesByItem.get(item.id) || [];
    const itemIssuedCost = issues.reduce(
      (total, issue) => total + Number(issue.purchase_price),
      0
    );
    const itemRevenue = issues.reduce(
      (total, issue) => total + Number(issue.selling_price),
      0
    );
    const eligible = schoolData.students.length;
    return {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      quantityReceived: item.quantityReceived,
      stockQuantity: item.stockQuantity,
      issued: issues.length,
      pending: Math.max(0, eligible - issues.length),
      purchaseExpense: item.purchaseExpense,
      issuedCost: roundMoney(itemIssuedCost),
      revenue: roundMoney(itemRevenue),
      profit: roundMoney(itemRevenue - itemIssuedCost),
    };
  });

  const classReports = schoolData.classNames.flatMap((className) =>
    items.map((item) => {
      const issues = issuesByClassAndItem.get(`${className}\u0000${item.id}`) || [];
      const cost = issues.reduce((total, issue) => total + Number(issue.purchase_price), 0);
      const classRevenue = issues.reduce(
        (total, issue) => total + Number(issue.selling_price),
        0
      );
      const eligible = studentCountsByClass.get(className) || 0;
      return {
        className,
        itemId: item.id,
        itemName: item.name,
        eligible,
        issued: issues.length,
        pending: Math.max(0, eligible - issues.length),
        expenses: roundMoney(cost),
        revenue: roundMoney(classRevenue),
        profit: roundMoney(classRevenue - cost),
      };
    })
  );

  return {
    items,
    classes: schoolData.classNames.map((name) => ({
      name,
      studentCount: studentCountsByClass.get(name) || 0,
    })),
    itemReports,
    classReports,
    summary: {
      itemCount: items.length,
      stockQuantity: items.reduce((total, item) => total + item.stockQuantity, 0),
      issued: issuesResult.rows.length,
      pending: itemReports.reduce((total, item) => total + item.pending, 0),
      purchaseExpense: roundMoney(
        items.reduce((total, item) => total + item.purchaseExpense, 0)
      ),
      issuedCost: roundMoney(issuedCost),
      revenue: roundMoney(revenue),
      profit: roundMoney(revenue - issuedCost),
    },
  };
};

const parsePrice = (value) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.trim())
  ) {
    return NaN;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? roundMoney(amount) : NaN;
};

const parseQuantity = (value) => {
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 1000000
    ? quantity
    : NaN;
};

router.get('/', async (_request, response) => {
  response.json(await readInventoryReport());
});

router.get('/roster', async (request, response) => {
  const className = String(request.query.className || '').trim();
  const itemId = String(request.query.itemId || '').trim();
  if (!className || !UUID_PATTERN.test(itemId)) {
    response.status(400).json({ message: 'A valid class and inventory item are required.' });
    return;
  }

  const pool = getPostgresPool();
  const item = await pool.query(
    'SELECT id FROM public.inventory_items WHERE id = $1 AND active = TRUE',
    [itemId]
  );
  if (!item.rowCount) {
    response.status(404).json({ message: 'Inventory item was not found.' });
    return;
  }

  const { students } = await getSchoolData();
  const roster = students
    .filter((student) => student.className === className)
    .sort(
      (a, b) =>
        a.rollNo - b.rollNo || a.displayName.localeCompare(b.displayName)
    );
  const issuedResult = await pool.query(
    `SELECT student_id, issued_at
     FROM public.inventory_issues
     WHERE item_id = $1 AND class_name = $2`,
    [itemId, className]
  );
  const issues = new Map(
    issuedResult.rows.map((issue) => [issue.student_id, issue.issued_at])
  );
  response.json(
    roster.map((student) => ({
      ...student,
      issued: issues.has(student.id),
      issuedAt: issues.get(student.id) || null,
    }))
  );
});

router.post('/items', async (request, response) => {
  const name = String(request.body?.name || '').trim();
  const category = String(request.body?.category || '').trim();
  const description = String(request.body?.description || '').trim();
  const quantity = parseQuantity(request.body?.quantity);
  const purchasePrice = parsePrice(request.body?.purchasePrice);
  const sellingPrice = parsePrice(request.body?.sellingPrice);

  if (
    !name ||
    name.length > 120 ||
    category.length > 100 ||
    description.length > 1000 ||
    !Number.isInteger(quantity) ||
    Number.isNaN(purchasePrice) ||
    Number.isNaN(sellingPrice)
  ) {
    response.status(400).json({
      message: 'Enter a valid item name, quantity, purchase price, and selling price.',
    });
    return;
  }

  const id = randomUUID();
  const result = await getPostgresPool().query(
    `INSERT INTO public.inventory_items
      (id, name, category, description, quantity_received, stock_quantity,
       purchase_price, stock_cost_value, selling_price, purchase_expense, created_by_username)
     VALUES ($1, $2, $3, $4, $5, $5, $6, $5 * $6, $7, $5 * $6, $8)
     RETURNING id, name, category, description, quantity_received, stock_quantity,
                purchase_price, stock_cost_value, selling_price, purchase_expense, active, created_at`,
    [
      id,
      name,
      category,
      description,
      quantity,
      purchasePrice,
      sellingPrice,
      request.auth.username,
    ]
  );
  response.status(201).json({ item: toItem(result.rows[0]) });
});

router.post('/items/:itemId/restock', async (request, response) => {
  const { itemId } = request.params;
  const quantity = parseQuantity(request.body?.quantity);
  const purchasePrice =
    request.body?.purchasePrice === '' || request.body?.purchasePrice === undefined
      ? null
      : parsePrice(request.body.purchasePrice);
  const sellingPrice =
    request.body?.sellingPrice === '' || request.body?.sellingPrice === undefined
      ? null
      : parsePrice(request.body.sellingPrice);

  if (
    !UUID_PATTERN.test(itemId) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    (purchasePrice !== null && Number.isNaN(purchasePrice)) ||
    (sellingPrice !== null && Number.isNaN(sellingPrice))
  ) {
    response.status(400).json({ message: 'Enter a valid restock quantity and prices.' });
    return;
  }

  const client = await getPostgresPool().connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT purchase_price, stock_cost_value, stock_quantity, selling_price
       FROM public.inventory_items
       WHERE id = $1 AND active = TRUE
       FOR UPDATE`,
      [itemId]
    );
    if (!currentResult.rowCount) {
      await client.query('ROLLBACK');
      response.status(404).json({ message: 'Inventory item was not found.' });
      return;
    }

    const nextPurchasePrice =
      purchasePrice ?? Number(currentResult.rows[0].purchase_price);
    const nextSellingPrice =
      sellingPrice ?? Number(currentResult.rows[0].selling_price);
    const nextStockCost =
      Number(currentResult.rows[0].stock_cost_value) + quantity * nextPurchasePrice;
    const nextStockQuantity = Number(currentResult.rows[0].stock_quantity) + quantity;
    const averagePurchasePrice = roundMoney(nextStockCost / nextStockQuantity);
    const result = await client.query(
      `UPDATE public.inventory_items
       SET quantity_received = quantity_received + $2,
           stock_quantity = stock_quantity + $2,
           purchase_price = $3,
           stock_cost_value = stock_cost_value + ($2 * $4),
           selling_price = $5,
           purchase_expense = purchase_expense + ($2 * $4),
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, category, description, quantity_received, stock_quantity,
                 purchase_price, stock_cost_value, selling_price, purchase_expense, active, created_at`,
      [itemId, quantity, averagePurchasePrice, nextPurchasePrice, nextSellingPrice]
    );
    await client.query('COMMIT');
    response.json({ item: toItem(result.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

router.post('/issues', async (request, response) => {
  const className = String(request.body?.className || '').trim();
  const itemId = String(request.body?.itemId || '').trim();
  const requestedIds = Array.isArray(request.body?.studentIds)
    ? [...new Set(request.body.studentIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];

  if (
    !className ||
    !UUID_PATTERN.test(itemId) ||
    !requestedIds.length ||
    requestedIds.length > 1000
  ) {
    response.status(400).json({ message: 'Select a class, item, and at least one student.' });
    return;
  }

  const { students } = await getSchoolData();
  const classRoster = students.filter((student) => student.className === className);
  const rosterById = new Map(classRoster.map((student) => [student.id, student]));
  if (requestedIds.some((studentId) => !rosterById.has(studentId))) {
    response.status(400).json({ message: 'One or more selected students are not in this class.' });
    return;
  }

  const pool = getPostgresPool();
  const client = await pool.connect();
  let newIssues = [];
  const issuedCosts = new Map();
  try {
    await client.query('BEGIN');
    const itemResult = await client.query(
      `SELECT id, name, stock_quantity, stock_cost_value, purchase_price, selling_price
       FROM public.inventory_items
       WHERE id = $1 AND active = TRUE
       FOR UPDATE`,
      [itemId]
    );
    if (!itemResult.rowCount) {
      await client.query('ROLLBACK');
      response.status(404).json({ message: 'Inventory item was not found.' });
      return;
    }

    const item = itemResult.rows[0];
    const existing = await client.query(
      `SELECT student_id
       FROM public.inventory_issues
       WHERE item_id = $1 AND student_id = ANY($2::text[])`,
      [itemId, requestedIds]
    );
    const alreadyIssued = new Set(existing.rows.map((row) => row.student_id));
    newIssues = requestedIds.filter((studentId) => !alreadyIssued.has(studentId));

    if (newIssues.length > Number(item.stock_quantity)) {
      await client.query('ROLLBACK');
      response.status(409).json({
        message: `Only ${item.stock_quantity} unit(s) remain in stock; ${newIssues.length} new issue(s) were selected.`,
      });
      return;
    }

    let remainingQuantity = Number(item.stock_quantity);
    let remainingCost = Number(item.stock_cost_value);
    for (const studentId of newIssues) {
      const student = rosterById.get(studentId);
      const unitCost =
        remainingQuantity === 1
          ? roundMoney(remainingCost)
          : roundMoney(remainingCost / remainingQuantity);
      await client.query(
        `INSERT INTO public.inventory_issues
          (id, item_id, student_id, student_name, class_name, purchase_price,
           selling_price, issued_by_username)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          itemId,
          studentId,
          student.displayName,
          className,
          unitCost,
          item.selling_price,
          request.auth.username,
        ]
      );
      issuedCosts.set(studentId, unitCost);
      remainingQuantity -= 1;
      remainingCost = roundMoney(remainingCost - unitCost);
    }

    if (newIssues.length) {
      await client.query(
        `UPDATE public.inventory_items
         SET stock_quantity = stock_quantity - $2,
             stock_cost_value = $3,
             purchase_price = CASE
               WHEN stock_quantity - $2 > 0
                 THEN round($3 / (stock_quantity - $2), 2)
               ELSE purchase_price
             END,
             updated_at = now()
         WHERE id = $1`,
        [itemId, newIssues.length, remainingCost]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const item = (await pool.query('SELECT name FROM public.inventory_items WHERE id = $1', [
    itemId,
  ])).rows[0];
  const notificationResults = await Promise.allSettled(
    newIssues.map((studentId) => {
      const student = rosterById.get(studentId);
      return createNotification({
        title: `Item issued: ${item.name}`,
        description: `${item.name} has been issued to ${student.displayName}.`,
        type: 'inventory',
        linkPage: 'Notifications',
        recipientRole: 'student',
        recipientStudentId: studentId,
        recipientClassName: className,
      });
    })
  );
  const notificationFailures = notificationResults.filter(
    (result) => result.status === 'rejected'
  );
  for (const failure of notificationFailures) {
    console.error('[inventory] issue notification failed:', failure.reason?.message || failure.reason);
  }

  response.json({
    issued: newIssues.length,
    alreadyIssued: requestedIds.length - newIssues.length,
    notificationFailures: notificationFailures.length,
    issuedCost: roundMoney(
      [...issuedCosts.values()].reduce((total, cost) => total + cost, 0)
    ),
  });
});

router.post('/reminders', async (request, response) => {
  const className = String(request.body?.className || '').trim();
  const itemId = String(request.body?.itemId || '').trim();
  if (!className || !UUID_PATTERN.test(itemId)) {
    response.status(400).json({ message: 'A valid class and inventory item are required.' });
    return;
  }

  const pool = getPostgresPool();
  const itemResult = await pool.query(
    'SELECT name FROM public.inventory_items WHERE id = $1 AND active = TRUE',
    [itemId]
  );
  if (!itemResult.rowCount) {
    response.status(404).json({ message: 'Inventory item was not found.' });
    return;
  }

  const { students } = await getSchoolData();
  const classRoster = students.filter((student) => student.className === className);
  const issuedResult = await pool.query(
    `SELECT student_id
     FROM public.inventory_issues
     WHERE item_id = $1 AND class_name = $2`,
    [itemId, className]
  );
  const issued = new Set(issuedResult.rows.map((row) => row.student_id));
  const pending = classRoster.filter((student) => !issued.has(student.id));
  if (!pending.length) {
    response.json({ reminded: 0 });
    return;
  }

  const itemName = itemResult.rows[0].name;
  const results = await Promise.allSettled(
    pending.map((student) =>
      createNotification({
        title: `Pending item: ${itemName}`,
        description: `Our records show that ${itemName} has not yet been issued to ${student.displayName}. Please contact the school office if this is incorrect.`,
        type: 'inventory',
        linkPage: 'Notifications',
        recipientRole: 'student',
        recipientStudentId: student.id,
        recipientClassName: className,
      })
    )
  );
  const failures = results.filter((result) => result.status === 'rejected');
  for (const failure of failures) {
    console.error('[inventory] pending reminder failed:', failure.reason?.message || failure.reason);
  }
  response.json({
    reminded: pending.length - failures.length,
    notificationFailures: failures.length,
  });
});

export default router;

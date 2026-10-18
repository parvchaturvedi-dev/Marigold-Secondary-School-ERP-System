import mongoose from 'mongoose';

const { EJSON } = mongoose.mongo.BSON;
const comparisonOperators = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists']);

const getPath = (value, path) =>
  path.split('.').reduce((current, part) => {
    if (Array.isArray(current)) return current.flatMap((entry) => (entry == null ? [] : [entry[part]]));
    return current == null ? undefined : current[part];
  }, value);

const sameValue = (left, right) => {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (left instanceof Date || right instanceof Date) {
    const leftDate = new Date(left).getTime();
    const rightDate = new Date(right).getTime();
    return Number.isFinite(leftDate) && leftDate === rightDate;
  }
  return String(left) === String(right);
};

const compare = (actual, operator, expected) => {
  if (operator === '$exists') return expected ? actual !== undefined : actual === undefined;
  if (operator === '$eq') return sameValue(actual, expected);
  if (operator === '$ne') return !sameValue(actual, expected);
  if (operator === '$in' || operator === '$nin') {
    const values = Array.isArray(actual) ? actual : [actual];
    const found = (expected || []).some((candidate) => values.some((value) => sameValue(value, candidate)));
    return operator === '$in' ? found : !found;
  }
  if (actual === undefined || actual === null) return false;
  if (operator === '$gt') return actual > expected;
  if (operator === '$gte') return actual >= expected;
  if (operator === '$lt') return actual < expected;
  if (operator === '$lte') return actual <= expected;
  return false;
};

const matchesField = (actual, expected) => {
  if (expected instanceof RegExp) {
    return (Array.isArray(actual) ? actual : [actual]).some((value) => expected.test(String(value ?? '')));
  }
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
    const operators = Object.keys(expected).filter((key) => key.startsWith('$'));
    if (operators.length) {
      return operators.every((operator) => {
        if (operator === '$not') return !matchesField(actual, expected[operator]);
        if (operator === '$elemMatch') {
          return Array.isArray(actual) && actual.some((item) => matches(item, expected[operator]));
        }
        if (operator === '$all') {
          return Array.isArray(actual) && expected[operator].every((entry) => actual.some((item) => sameValue(item, entry)));
        }
        if (operator === '$size') return Array.isArray(actual) && actual.length === expected[operator];
        if (!comparisonOperators.has(operator)) {
          throw new Error(`Unsupported PostgreSQL query operator: ${operator}`);
        }
        return compare(actual, operator, expected[operator]);
      });
    }
    return actual != null && Object.entries(expected).every(([key, value]) =>
      matchesField(actual[key], value)
    );
  }
  if (Array.isArray(actual)) return actual.some((value) => sameValue(value, expected));
  return sameValue(actual, expected);
};

const matches = (document, filter = {}) =>
  Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((branch) => matches(document, branch));
    if (key === '$and') return expected.every((branch) => matches(document, branch));
    if (key === '$nor') return !expected.some((branch) => matches(document, branch));
    if (key.startsWith('$')) throw new Error(`Unsupported PostgreSQL filter operator: ${key}`);
    return matchesField(getPath(document, key), expected);
  });

const clone = (value) => EJSON.parse(EJSON.stringify(value, { relaxed: false }), { relaxed: false });
const serialize = (value) => EJSON.stringify(value, { relaxed: false });

const setPath = (target, path, value) => {
  const parts = path.split('.');
  const last = parts.pop();
  let parent = target;
  for (const part of parts) {
    if (!parent[part] || typeof parent[part] !== 'object') parent[part] = {};
    parent = parent[part];
  }
  parent[last] = value;
};

const unsetPath = (target, path) => {
  const parts = path.split('.');
  const last = parts.pop();
  let parent = target;
  for (const part of parts) {
    if (!parent?.[part] || typeof parent[part] !== 'object') return;
    parent = parent[part];
  }
  if (parent) delete parent[last];
};

const applyUpdate = (document, update, { inserting = false } = {}) => {
  const hasOperators = Object.keys(update || {}).some((key) => key.startsWith('$'));
  if (!hasOperators) {
    for (const [key, value] of Object.entries(update || {})) setPath(document, key, clone(value));
  } else {
    for (const [operator, fields] of Object.entries(update)) {
      if (operator === '$set' || (operator === '$setOnInsert' && inserting)) {
        for (const [path, value] of Object.entries(fields)) setPath(document, path, clone(value));
      } else if (operator === '$unset') {
        for (const path of Object.keys(fields)) unsetPath(document, path);
      } else if (operator === '$inc') {
        for (const [path, value] of Object.entries(fields)) {
          setPath(document, path, (Number(getPath(document, path)) || 0) + Number(value));
        }
      } else if (operator === '$push' || operator === '$addToSet') {
        for (const [path, rawValue] of Object.entries(fields)) {
          const array = getPath(document, path) || [];
          if (!Array.isArray(array)) throw new Error(`${path} is not an array.`);
          const values = rawValue && typeof rawValue === 'object' && '$each' in rawValue
            ? rawValue.$each
            : [rawValue];
          for (const value of values) {
            if (operator === '$push' || !array.some((item) => sameValue(item, value))) array.push(clone(value));
          }
          setPath(document, path, array);
        }
      } else if (operator === '$pull') {
        for (const [path, condition] of Object.entries(fields)) {
          const array = getPath(document, path) || [];
          if (!Array.isArray(array)) throw new Error(`${path} is not an array.`);
          setPath(document, path, array.filter((item) =>
            condition && typeof condition === 'object' && !Array.isArray(condition)
              ? !matches(item, condition)
              : !sameValue(item, condition)
          ));
        }
      } else if (operator !== '$setOnInsert') {
        throw new Error(`Unsupported PostgreSQL update operator: ${operator}`);
      }
    }
  }
  return document;
};

const getModelColumns = (model) => {
  const columns = new Map();
  for (const [pathName, schemaType] of Object.entries(model.schema.paths)) {
    if (pathName === '_id' || pathName === '__v') continue;
    const root = pathName.split('.')[0];
    if (columns.has(root)) continue;
    const nested = pathName.includes('.');
    columns.set(root, {
      name: root,
      column: root.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replaceAll('.', '_').toLowerCase(),
      sqlType: nested
        ? 'JSONB'
        : {
            String: 'TEXT',
            Number: 'DOUBLE PRECISION',
            Boolean: 'BOOLEAN',
            Date: 'TIMESTAMPTZ',
            Buffer: 'BYTEA',
            ObjectId: 'TEXT',
          }[schemaType.instance] || 'JSONB',
    });
  }
  return [...columns.values()];
};

const sqlValue = (value, sqlType) => {
  if (value === undefined || value === null) return null;
  if (sqlType === 'JSONB') return serialize(value);
  if (sqlType === 'TEXT' && typeof value === 'object') return String(value);
  if (sqlType === 'BYTEA') {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (value?._bsontype === 'Binary' && value.buffer) {
      return Buffer.from(value.buffer).subarray(0, value.position);
    }
    throw new Error('Cannot encode this MongoDB binary value as PostgreSQL BYTEA.');
  }
  return value;
};

class Query {
  constructor(model, action, filter, payload, options = {}) {
    this.model = model;
    this.action = action;
    this.filter = filter || {};
    this.payload = payload;
    this.options = options;
    this.projection = null;
    this.sortOrder = null;
    this.rowLimit = null;
    this.rowSkip = 0;
    this.isLean = false;
  }

  select(projection) {
    this.projection = projection;
    return this;
  }

  sort(order) {
    this.sortOrder = order;
    return this;
  }

  limit(value) {
    this.rowLimit = Number(value);
    return this;
  }

  skip(value) {
    this.rowSkip = Number(value);
    return this;
  }

  lean(value = true) {
    this.isLean = value;
    return this;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(callback) {
    return this.exec().finally(callback);
  }

  async exec() {
    const model = this.model;
    if (this.action === 'find' || this.action === 'findOne' || this.action === 'count') {
      const result = await model.pgPool.query(
        `SELECT legacy_document FROM public.${model.pgTable} ORDER BY id`
      );
      let documents = result.rows.map((row) => EJSON.parse(JSON.stringify(row.legacy_document), { relaxed: false }));
      documents = documents.filter((document) => matches(document, this.filter));
      if (this.action === 'count') return documents.length;
      if (this.sortOrder) {
        const sortEntries = typeof this.sortOrder === 'string'
          ? this.sortOrder.trim().split(/\s+/).map((field) => [field.replace(/^-/, ''), field.startsWith('-') ? -1 : 1])
          : Object.entries(this.sortOrder);
        documents.sort((left, right) => {
          for (const [field, direction] of sortEntries) {
            const a = getPath(left, field);
            const b = getPath(right, field);
            if (sameValue(a, b)) continue;
            if (a == null) return -1 * direction;
            if (b == null) return direction;
            return (a < b ? -1 : 1) * direction;
          }
          return 0;
        });
      }
      if (this.action === 'findOne') documents = documents.slice(0, 1);
      if (this.rowSkip) documents = documents.slice(this.rowSkip);
      if (this.rowLimit != null) documents = documents.slice(0, this.rowLimit);
      documents = documents.map((document) => applyProjection(document, this.projection));
      return this.action === 'findOne'
        ? (documents[0] ? returnDocument(model, documents[0], this.isLean) : null)
        : documents.map((document) => returnDocument(model, document, this.isLean));
    }

    if (this.action === 'update') return updateDocuments(model, this.filter, this.payload, this.options);
    if (this.action === 'delete') return deleteDocuments(model, this.filter, this.options);
    if (this.action === 'findOneAndDelete') {
      const document = await new Query(model, 'findOne', this.filter).exec();
      if (!document) return null;
      await deleteDocuments(model, { _id: document._id }, {});
      return this.isLean ? document.toObject() : document;
    }
    if (this.action === 'findOneAndUpdate') {
      return updateOneAndReturn(model, this.filter, this.payload, this.options, this.isLean);
    }
    throw new Error(`Unsupported PostgreSQL model query: ${this.action}`);
  }
}

const applyProjection = (document, projection) => {
  if (!projection) return document;
  const entries = typeof projection === 'string'
    ? projection.trim().split(/\s+/).filter(Boolean).map((field) => [field.replace(/^-/, ''), field.startsWith('-') ? 0 : 1])
    : Object.entries(projection);
  const inclusion = entries.filter(([, include]) => Boolean(include));
  if (inclusion.length) {
    const result = {};
    for (const [path] of inclusion) {
      const value = getPath(document, path);
      if (value !== undefined) setPath(result, path, value);
    }
    if (document._id !== undefined && !entries.some(([path, include]) => path === '_id' && !include)) {
      result._id = document._id;
    }
    return result;
  }
  const result = clone(document);
  for (const [path, include] of entries) if (!include) unsetPath(result, path);
  return result;
};

const returnDocument = (model, document, lean) => lean ? document : model.hydrate(document);

const selectRows = async (model, client, filter, forUpdate = false) => {
  const result = await client.query(
    `SELECT id, legacy_document FROM public.${model.pgTable} ORDER BY id${forUpdate ? ' FOR UPDATE' : ''}`
  );
  return result.rows
    .map((row) => ({
      id: row.id,
      document: EJSON.parse(JSON.stringify(row.legacy_document), { relaxed: false }),
    }))
    .filter(({ document }) => matches(document, filter));
};

const saveDocument = async (model, document, { insertOnly = false, client = model.pgPool } = {}) => {
  const value = document instanceof model ? document.toObject({ depopulate: true, flattenMaps: true }) : clone(document);
  if (!value._id) value._id = new mongoose.Types.ObjectId();
  if (model.schema.options.timestamps) {
    const now = new Date();
    value.createdAt ||= now;
    value.updatedAt = now;
  }
  await (document instanceof model ? document : model.hydrate(value)).validate();
  const serialized = serialize(value);
  const columns = model.pgColumns;
  const names = ['id', 'legacy_document', ...columns.map(({ column }) => column)];
  const values = [String(value._id), serialized, ...columns.map(({ name, sqlType }) => sqlValue(value[name], sqlType))];
  const placeholders = names.map((_, index) => index === 1 ? `$${index + 1}::jsonb` : `$${index + 1}`);
  const updates = names.slice(1).map((name) => `${quote(name)} = EXCLUDED.${quote(name)}`);
  await client.query(
    `INSERT INTO public.${model.pgTable} (${names.map(quote).join(', ')})
     VALUES (${placeholders.join(', ')})
     ${insertOnly ? 'ON CONFLICT (id) DO NOTHING' : `ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`}`,
    values
  );
  if (document instanceof model) {
    document.$isNew = false;
    document.createdAt = value.createdAt;
    document.updatedAt = value.updatedAt;
  }
  return document instanceof model ? document : model.hydrate(value);
};

const quote = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;

const transact = async (model, callback) => {
  const client = await model.pgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`LOCK TABLE public.${model.pgTable} IN EXCLUSIVE MODE`);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateDocuments = (model, filter, update, options) =>
  transact(model, async (client) => {
    const rows = await selectRows(model, client, filter, true);
    const selected = options.multi ? rows : rows.slice(0, 1);
    if (!selected.length && options.upsert) {
      const base = new model(filter);
      const document = base.toObject({ depopulate: true, flattenMaps: true });
      applyUpdate(document, update, { inserting: true });
      await saveDocument(model, document, { client });
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    for (const row of selected) {
      applyUpdate(row.document, update);
      await saveDocument(model, row.document, { client });
    }
    return {
      acknowledged: true,
      matchedCount: selected.length,
      modifiedCount: selected.length,
      upsertedCount: 0,
    };
  });

const updateOneAndReturn = (model, filter, update, options, lean) =>
  transact(model, async (client) => {
    const [row] = await selectRows(model, client, filter, true);
    if (!row && !options.upsert) return null;
    const inserting = !row;
    const document = row?.document || new model(filter).toObject({ depopulate: true, flattenMaps: true });
    const before = clone(document);
    applyUpdate(document, update, { inserting });
    if (inserting) {
      await saveDocument(model, document, { client });
      return returnDocument(model, document, lean);
    }
    await saveDocument(model, document, { client });
    return returnDocument(model, options.new || options.returnDocument === 'after' ? document : before, lean);
  });

const deleteDocuments = (model, filter, { single = false } = {}) =>
  transact(model, async (client) => {
    const rows = await selectRows(model, client, filter, true);
    const selected = single ? rows.slice(0, 1) : rows;
    for (const row of selected) {
      await client.query(`DELETE FROM public.${model.pgTable} WHERE id = $1`, [row.id]);
    }
    return { acknowledged: true, deletedCount: selected.length };
  });

const getExpressionValue = (expression, document) => {
  if (typeof expression === 'string' && expression.startsWith('$')) return getPath(document, expression.slice(1));
  if (Array.isArray(expression)) return expression.map((entry) => getExpressionValue(entry, document));
  if (expression && typeof expression === 'object') {
    return Object.fromEntries(Object.entries(expression).map(([key, value]) => [key, getExpressionValue(value, document)]));
  }
  return expression;
};

const aggregate = async (model, pipeline = []) => {
  const all = await new Query(model, 'find', {}, null).lean().exec();
  let documents = all;
  for (const stage of pipeline) {
    if (stage.$match) documents = documents.filter((document) => matches(document, stage.$match));
    else if (stage.$group) {
      const groups = new Map();
      for (const document of documents) {
        const groupId = getExpressionValue(stage.$group._id, document);
        const key = JSON.stringify(groupId);
        if (!groups.has(key)) groups.set(key, { _id: groupId });
        const group = groups.get(key);
        for (const [field, expression] of Object.entries(stage.$group)) {
          if (field === '_id' || !('$sum' in expression)) continue;
          const sumExpression = expression.$sum;
          let contribution;
          if (typeof sumExpression === 'number') contribution = sumExpression;
          else if (sumExpression?.$cond) {
            const [condition, yes, no] = sumExpression.$cond;
            contribution = evaluateCondition(condition, document) ? yes : no;
          } else contribution = getExpressionValue(sumExpression, document);
          group[field] = (group[field] || 0) + (Number(contribution) || 0);
        }
      }
      documents = [...groups.values()];
    } else if (stage.$project) {
      documents = documents.map((document) => {
        const result = {};
        for (const [field, expression] of Object.entries(stage.$project)) {
          if (expression === 0) continue;
          const value = expression === 1 ? getPath(document, field) : getExpressionValue(expression, document);
          if (value !== undefined) result[field] = value;
        }
        return result;
      });
    } else if (stage.$sort) {
      documents.sort((left, right) => {
        for (const [field, direction] of Object.entries(stage.$sort)) {
          if (sameValue(left[field], right[field])) continue;
          return (left[field] < right[field] ? -1 : 1) * direction;
        }
        return 0;
      });
    } else {
      throw new Error(`Unsupported PostgreSQL aggregation stage: ${Object.keys(stage)[0]}`);
    }
  }
  return documents;
};

const evaluateCondition = (condition, document) => {
  if (condition?.$eq) {
    const [left, right] = condition.$eq.map((item) => getExpressionValue(item, document));
    return sameValue(left, right);
  }
  if (condition?.$and) return condition.$and.every((item) => evaluateCondition(item, document));
  if (condition?.$or) return condition.$or.some((item) => evaluateCondition(item, document));
  return Boolean(getExpressionValue(condition, document));
};

export const configurePostgresModels = (pool) => {
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    model.pgPool = pool;
    model.pgTable = quote(model.collection.collectionName);
    model.pgColumns = getModelColumns(model);
    model.find = (filter = {}, projection = null) => new Query(model, 'find', filter, null).select(projection);
    model.findOne = (filter = {}, projection = null) => new Query(model, 'findOne', filter, null).select(projection);
    model.findById = (id, projection = null) => new Query(model, 'findOne', { _id: id }, null).select(projection);
    model.countDocuments = (filter = {}) => new Query(model, 'count', filter);
    model.findOneAndUpdate = (filter, update, options = {}) =>
      new Query(model, 'findOneAndUpdate', filter, update, options);
    model.findByIdAndUpdate = (id, update, options = {}) =>
      new Query(model, 'findOneAndUpdate', { _id: id }, update, options);
    model.findOneAndDelete = (filter) => new Query(model, 'findOneAndDelete', filter);
    model.findByIdAndDelete = (id) => new Query(model, 'findOneAndDelete', { _id: id });
    model.updateOne = (filter, update, options = {}) => updateDocuments(model, filter, update, options);
    model.updateMany = (filter, update, options = {}) =>
      updateDocuments(model, filter, update, { ...options, multi: true });
    model.deleteOne = (filter) => deleteDocuments(model, filter, { single: true });
    model.deleteMany = (filter = {}) => deleteDocuments(model, filter);
    model.aggregate = (pipeline) => aggregate(model, pipeline);
    model.create = async (values) => {
      if (Array.isArray(values)) return Promise.all(values.map((value) => model.create(value)));
      const document = new model(values);
      return saveDocument(model, document);
    };
    model.insertMany = async (values) => Promise.all(values.map((value) => model.create(value)));
    model.bulkWrite = async (operations) => {
      let matchedCount = 0;
      let modifiedCount = 0;
      let upsertedCount = 0;
      for (const operation of operations) {
        if (operation.updateOne) {
          const result = await updateDocuments(
            model,
            operation.updateOne.filter,
            operation.updateOne.update,
            { ...operation.updateOne, multi: false }
          );
          matchedCount += result.matchedCount;
          modifiedCount += result.modifiedCount;
          upsertedCount += result.upsertedCount;
        } else if (operation.insertOne) {
          await model.create(operation.insertOne.document);
          upsertedCount += 1;
        } else {
          throw new Error('Unsupported PostgreSQL bulk operation.');
        }
      }
      return { acknowledged: true, matchedCount, modifiedCount, upsertedCount };
    };
    model.exists = async (filter) => {
      const document = await new Query(model, 'findOne', filter, null).select({ _id: 1 }).lean();
      return document ? { _id: document._id } : null;
    };
    model.prototype.save = function save() {
      return saveDocument(model, this);
    };
  }
};

export const isPostgresConfigured = () => mongoose.modelNames().length > 0;

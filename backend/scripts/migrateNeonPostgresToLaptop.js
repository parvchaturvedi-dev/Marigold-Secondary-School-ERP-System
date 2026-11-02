import { spawnSync } from 'node:child_process';
import { chmod, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import '../server/utils/loadEnv.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backupDirectory = resolve(homedir(), 'erp-migration-backups');
const { Client } = pg;

const parseDatabaseUrl = (value, label, { neonOnly = false, localOnly = false } = {}) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid PostgreSQL connection URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${label} must use PostgreSQL.`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!database || !url.hostname || !url.username) {
    throw new Error(`${label} must include a host, database, and username.`);
  }
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (neonOnly && (!url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler.'))) {
    throw new Error('Use the Neon direct (non-pooler) connection URL.');
  }
  if (localOnly && !isLocal) {
    throw new Error('The active backend DATABASE_URL is not local; refusing to replace a non-local database.');
  }
  return {
    url,
    database,
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: database,
      PGSSLMODE: neonOnly ? 'verify-full' : url.searchParams.get('sslmode') || 'prefer',
    },
  };
};

const readLine = (prompt, { hidden = false } = {}) =>
  new Promise((resolveInput, reject) => {
    process.stdout.write(prompt);
    let answer = '';
    const input = process.stdin;
    const wasRaw = input.isTTY && input.isRaw;
    if (hidden && input.isTTY) input.setRawMode(true);

    const cleanup = () => {
      input.removeListener('data', onData);
      input.removeListener('error', onError);
      if (hidden && input.isTTY) input.setRawMode(Boolean(wasRaw));
    };
    const finish = (value) => {
      cleanup();
      process.stdout.write('\n');
      resolveInput(value.trim());
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Cancelled by user.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish(answer);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          answer = answer.slice(0, -1);
        } else {
          answer += character;
          if (!hidden) process.stdout.write(character);
        }
      }
    };

    input.on('data', onData);
    input.once('error', onError);
    input.resume();
  });

const runCommand = (command, args, env, description) => {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.error) {
    throw new Error(`${description} could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status ?? 'unknown'}.`);
  }
};

const dumpDatabase = (database, path, description) => {
  runCommand(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', '--file', path],
    database.env,
    description
  );
};

const getDatabaseInfo = async (database) => {
  const client = new Client({
    connectionString: database.url.toString(),
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT current_database() AS database,
             current_setting('server_version') AS version,
             current_user AS username
    `);
    return result.rows[0];
  } finally {
    await client.end();
  }
};

const getTableCounts = async (database, label) => {
  const client = new Client({
    connectionString: database.url.toString(),
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const tables = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        AND table_schema NOT LIKE 'pg_toast%'
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);
    const counts = new Map();
    for (const { table_schema: schema, table_name: table } of tables.rows) {
      const qualifiedName = `${schema}.${table}`;
      const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
      const result = await client.query(
        `SELECT count(*)::bigint AS count FROM ${quote(schema)}.${quote(table)}`
      );
      counts.set(qualifiedName, String(result.rows[0].count));
    }
    console.log(`${label}: checked ${counts.size} tables.`);
    return counts;
  } finally {
    await client.end();
  }
};

const clearUserSchemas = async (database) => {
  const client = new Client({
    connectionString: database.url.toString(),
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const schemas = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
        AND schema_name NOT LIKE 'pg_toast%'
        AND schema_name NOT LIKE 'pg_temp_%'
      ORDER BY schema_name
    `);
    await client.query('BEGIN');
    for (const { schema_name: schema } of schemas.rows) {
      const quote = `"${schema.replaceAll('"', '""')}"`;
      await client.query(`DROP SCHEMA ${quote} CASCADE`);
    }
    await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

const restoreDatabase = async (database, backupPath, description) => {
  await clearUserSchemas(database);
  runCommand(
    'pg_restore',
    [
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      '--single-transaction',
      '--dbname',
      database.database,
      backupPath,
    ],
    database.env,
    description
  );
};

const verifyCounts = (sourceCounts, targetCounts, sourceLabel, targetLabel) => {
  const mismatches = [];
  for (const [table, count] of sourceCounts) {
    if (targetCounts.get(table) !== count) mismatches.push(`${table} (source ${count}, target ${targetCounts.get(table) ?? 'missing'})`);
  }
  for (const [table, count] of targetCounts) {
    if (!sourceCounts.has(table)) mismatches.push(`${table} (only in target, ${count} rows)`);
  }
  if (mismatches.length) {
    throw new Error(
      `Table counts do not match between ${sourceLabel} and ${targetLabel}: ${mismatches.join('; ')}`
    );
  }
};

const run = async () => {
  if (!process.stdin.isTTY) {
    throw new Error('Run this migration from the interactive Windows batch file so credentials can be entered privately.');
  }
  const local = parseDatabaseUrl(process.env.DATABASE_URL || '', 'Active backend DATABASE_URL', {
    localOnly: true,
  });
  const neonUrl = await readLine('Paste the Neon DIRECT connection URL (input hidden): ', { hidden: true });
  const neon = parseDatabaseUrl(neonUrl, 'Neon connection URL', { neonOnly: true });
  if (neon.url.toString() === local.url.toString()) {
    throw new Error('The Neon source and local target URLs must be different.');
  }

  const [neonInfo, localInfo] = await Promise.all([
    getDatabaseInfo(neon),
    getDatabaseInfo(local),
  ]);
  console.log(`Source: Neon database "${neonInfo.database}" (PostgreSQL ${neonInfo.version}).`);
  console.log(`Target: laptop database "${localInfo.database}" (PostgreSQL ${localInfo.version}).`);
  console.log('The local database will be replaced; Neon will remain unchanged.');
  console.log('A Neon dump downloads database contents and may use your Neon transfer quota.');
  const confirmation = await readLine('Type REPLACE LAPTOP WITH NEON to continue: ');
  if (confirmation !== 'REPLACE LAPTOP WITH NEON') {
    console.log('Cancelled. No database changes were made.');
    return;
  }

  const serviceCheck = spawnSync('systemctl', ['cat', 'mgps-erp'], {
    stdio: 'ignore',
  });
  if (serviceCheck.status !== 0) {
    throw new Error('The mgps-erp systemd service is not installed. Run the migration on the laptop WSL installation.');
  }

  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await chmod(backupDirectory, 0o700);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const neonBackup = resolve(backupDirectory, `neon-erp-${timestamp}.dump`);
  const localBackup = resolve(backupDirectory, `laptop-before-neon-${timestamp}.dump`);

  runCommand('sudo', ['systemctl', 'stop', 'mgps-erp'], process.env, 'Stopping the ERP backend');
  let backendStopped = true;
  let replacementStarted = false;
  try {
    console.log('Creating protected backups before replacing the laptop database...');
    dumpDatabase(neon, neonBackup, 'Backing up Neon');
    dumpDatabase(local, localBackup, 'Backing up the laptop database');
    await chmod(neonBackup, 0o600);
    await chmod(localBackup, 0o600);

    console.log('Replacing laptop database contents with the Neon backup...');
    replacementStarted = true;
    await restoreDatabase(local, neonBackup, 'Restoring Neon data onto the laptop');
    const [neonCounts, localCounts] = await Promise.all([
      getTableCounts(neon, 'Neon source'),
      getTableCounts(local, 'Laptop target'),
    ]);
    verifyCounts(neonCounts, localCounts, 'Neon source', 'laptop target');

    console.log('Migration verified. Neon remains unchanged and the backend still uses local PostgreSQL.');
    console.log(`Neon backup: ${neonBackup}`);
    console.log(`Pre-migration laptop backup: ${localBackup}`);
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    if (replacementStarted) {
      console.error('Restoring the pre-migration laptop backup...');
      try {
        await restoreDatabase(local, localBackup, 'Recovering the laptop database');
        console.error(`Laptop database recovery succeeded. Backup retained at ${localBackup}`);
      } catch (restoreError) {
        console.error(`Automatic recovery failed: ${restoreError.message}`);
        console.error(`Do not restart the backend until the laptop backup is restored manually: ${localBackup}`);
      }
    }
    throw error;
  } finally {
    if (backendStopped) {
      const restart = spawnSync('sudo', ['systemctl', 'start', 'mgps-erp'], {
        stdio: 'inherit',
      });
      backendStopped = false;
      if (restart.status !== 0) {
        console.error('Backend did not restart; check: sudo systemctl status mgps-erp');
      }
    }
  }
};

run().catch((error) => {
  console.error(`Migration stopped: ${error.message}`);
  process.exitCode = 1;
});

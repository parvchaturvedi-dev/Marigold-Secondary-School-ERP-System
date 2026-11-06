export const withPostgresAdvisoryLock = async (pool, lockId, task) => {
  const client = await pool.connect();
  let acquired = false;
  let discardClient = false;

  try {
    const result = await client.query(
      'SELECT pg_try_advisory_lock($1::bigint) AS acquired',
      [String(lockId)]
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) return { acquired: false, value: undefined };

    return { acquired: true, value: await task() };
  } finally {
    if (acquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [String(lockId)]);
      } catch (error) {
        discardClient = true;
        throw error;
      }
    }

    client.release(discardClient);
  }
};

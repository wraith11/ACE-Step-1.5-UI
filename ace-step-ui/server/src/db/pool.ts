import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.dirname(config.database.path);
import { mkdirSync } from 'fs';
try {
  mkdirSync(dataDir, { recursive: true });
} catch {
  // already exists
}

const dbInstance = new Database(config.database.path);
dbInstance.pragma('journal_mode = WAL');
dbInstance.pragma('foreign_keys = ON');

export { dbInstance as db };

function sanitizeParams(params?: unknown[]): unknown[] | undefined {
  if (!params) return params;
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (Array.isArray(p) || (typeof p === 'object' && p !== null)) return JSON.stringify(p);
    return p;
  });
}

interface QueryResult {
  rows: any[];
  rowCount: number;
}

function executeQuery(sql: string, params?: unknown[], dbRef: Database.Database = dbInstance): QueryResult {
  const sanitizedParams = sanitizeParams(params);

  let convertedSql = sql;
  if (sanitizedParams && sanitizedParams.length > 0) {
    convertedSql = sql.replace(/\$(\d+)/g, '?');
  }

  convertedSql = convertedSql
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
    .replace(/::text/gi, '')
    .replace(/::integer/gi, '')
    .replace(/::boolean/gi, '')
    .replace(/GREATEST\(([^,]+),\s*(\d+)\)/gi, 'MAX($1, $2)');

  const insertMatch = convertedSql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)/i);
  if (insertMatch) {
    const tableName = insertMatch[1];
    const columns = insertMatch[2].split(',').map((c) => c.trim().toLowerCase());
    const tablesNeedingId = ['users', 'songs', 'playlists', 'generation_jobs', 'comments', 'reference_tracks', 'contact_submissions'];
    if (tablesNeedingId.includes(tableName.toLowerCase()) && !columns.includes('id')) {
      const newId = randomUUID();
      const updatedColumns = 'id, ' + insertMatch[2];
      const valuesMatch = convertedSql.match(/VALUES\s*\(([^)]+)\)/i);
      if (valuesMatch) {
        const updatedValues = `VALUES ('${newId}', ${valuesMatch[1]})`;
        convertedSql = convertedSql.replace(/\([^)]+\)\s*VALUES/i, `(${updatedColumns}) VALUES`);
        convertedSql = convertedSql.replace(/VALUES\s*\([^)]+\)/i, updatedValues);
      }
    }
  }

  try {
    const isSelect = /^\s*(SELECT|RETURNING)/i.test(convertedSql) || convertedSql.includes('RETURNING');
    if (isSelect || convertedSql.includes('RETURNING')) {
      const stmt = dbRef.prepare(convertedSql);
      const rows = sanitizedParams ? stmt.all(...sanitizedParams) : stmt.all();
      return { rows, rowCount: rows.length };
    } else {
      const stmt = dbRef.prepare(convertedSql);
      const result = sanitizedParams ? stmt.run(...sanitizedParams) : stmt.run();
      return { rows: [], rowCount: result.changes };
    }
  } catch (error) {
    console.error('SQLite query error:', error);
    console.error('SQL:', convertedSql);
    console.error('Params:', sanitizedParams);
    throw error;
  }
}

class SqliteClient {
  private inTransaction = false;

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    return executeQuery(sql, params, dbInstance);
  }

  release() {
    if (this.inTransaction) {
      try { dbInstance.exec('ROLLBACK'); } catch { /* ignore */ }
      this.inTransaction = false;
    }
  }
}

export const pool = {
  query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
    return executeQuery(sql, params);
  },
  connect: async () => {
    const client = new SqliteClient();
    const originalQuery = client.query.bind(client);
    client.query = async (sql: string, params?: unknown[]) => {
      const upperSql = sql.trim().toUpperCase();
      if (upperSql === 'BEGIN') { dbInstance.exec('BEGIN IMMEDIATE'); (client as any).inTransaction = true; return { rows: [], rowCount: 0 }; }
      if (upperSql === 'COMMIT') { dbInstance.exec('COMMIT'); (client as any).inTransaction = false; return { rows: [], rowCount: 0 }; }
      if (upperSql === 'ROLLBACK') { dbInstance.exec('ROLLBACK'); (client as any).inTransaction = false; return { rows: [], rowCount: 0 }; }
      return originalQuery(sql, params);
    };
    return client;
  },
  end: async () => {
    dbInstance.close();
  },
};
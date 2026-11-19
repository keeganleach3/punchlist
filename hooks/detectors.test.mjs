import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSecrets,
  detectMissingRLS,
  detectSqlInterpolation,
} from './detectors.mjs';

// ---------------------------------------------------------------- secrets

test('flags an AWS access key id', () => {
  const f = detectSecrets('const k = "AKIA' + 'IOSFODNN7EXAMPLE";');
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, 'secret');
});

test('flags a private key block', () => {
  const f = detectSecrets('-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEpAIBAAKC\n');
  assert.equal(f.length, 1);
});

test('flags a connection string with an inline password', () => {
  const f = detectSecrets('DB="postgres' + 'ql://admin:hunter2mypass@db.host:5432/app"');
  assert.equal(f.length, 1);
});

test('flags a JWT-shaped service key', () => {
  const jwt =
    'eyJ' + 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ' + 'yb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnop';
  const f = detectSecrets(`const key = "${jwt}"`);
  assert.equal(f.length, 1);
});

test('flags an assigned api key literal', () => {
  const f = detectSecrets('api_key = "sk_' + 'live_9f8a7b6c5d4e3f2a1b0c"');
  assert.equal(f.length, 1);
});

test('reports a 1-indexed line number', () => {
  const f = detectSecrets('line one\nline two\nconst k = "AKIA' + 'IOSFODNN7EXAMPLE";');
  assert.equal(f[0].line, 3);
});

test('never echoes the raw secret in the excerpt', () => {
  const f = detectSecrets('const k = "AKIA' + 'IOSFODNN7EXAMPLE";');
  assert.ok(!f[0].excerpt.includes('AKIA' + 'IOSFODNN7EXAMPLE'));
});

test('does not flag env lookups', () => {
  assert.equal(detectSecrets('const k = process.env.API_KEY;').length, 0);
  assert.equal(detectSecrets('key = os.environ["API_KEY"]').length, 0);
});

test('does not flag placeholders', () => {
  assert.equal(detectSecrets('api_key = "your-api-key-here"').length, 0);
  assert.equal(detectSecrets('api_key = "xxxxxxxxxxxxxxxxxxxx"').length, 0);
  assert.equal(detectSecrets('password = "changeme-placeholder"').length, 0);
  assert.equal(detectSecrets('token = "${SUPABASE_TOKEN}"').length, 0);
  assert.equal(detectSecrets('secret = "<REDACTED>"').length, 0);
});

test('does not flag a short value', () => {
  assert.equal(detectSecrets('password = "abc"').length, 0);
});

test('respects an inline override annotation on the same line', () => {
  const src =
    'const k = "AKIA' + 'IOSFODNN7EXAMPLE"; // punchlist:allow secret — fixture for the detector test';
  assert.equal(detectSecrets(src).length, 0);
});

test('an override for a different rule does not suppress', () => {
  const src = 'const k = "AKIA' + 'IOSFODNN7EXAMPLE"; // punchlist:allow rls — wrong rule';
  assert.equal(detectSecrets(src).length, 1);
});

// -------------------------------------------------------------------- rls

test('flags CREATE TABLE with no ENABLE ROW LEVEL SECURITY', () => {
  const sql = 'CREATE TABLE public.orders (id uuid primary key, owner uuid);';
  const f = detectMissingRLS(sql, 'supabase/migrations/001_orders.sql');
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, 'rls');
});

test('accepts CREATE TABLE when RLS is enabled for that table', () => {
  const sql = [
    'CREATE TABLE public.orders (id uuid primary key);',
    'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;',
  ].join('\n');
  assert.equal(detectMissingRLS(sql, 'migrations/001.sql').length, 0);
});

test('flags only the table missing RLS when several are created', () => {
  const sql = [
    'CREATE TABLE public.a (id int);',
    'CREATE TABLE public.b (id int);',
    'ALTER TABLE public.a ENABLE ROW LEVEL SECURITY;',
  ].join('\n');
  const f = detectMissingRLS(sql, 'migrations/001.sql');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /\bb\b/);
});

test('ignores temp tables', () => {
  const sql = 'CREATE TEMP TABLE scratch (id int);';
  assert.equal(detectMissingRLS(sql, 'migrations/001.sql').length, 0);
});

test('ignores unlogged tables', () => {
  const sql = 'CREATE UNLOGGED TABLE scratch (id int);';
  assert.equal(detectMissingRLS(sql, 'migrations/001.sql').length, 0);
});

test('ignores non-SQL files', () => {
  const src = 'const q = "CREATE TABLE public.orders (id int)";';
  assert.equal(detectMissingRLS(src, 'src/docs.ts').length, 0);
});

test('respects an rls override anywhere in the content', () => {
  const sql = [
    '-- punchlist:allow rls — analytics rollup, no user rows',
    'CREATE TABLE public.rollup (id int);',
  ].join('\n');
  assert.equal(detectMissingRLS(sql, 'migrations/002.sql').length, 0);
});

test('matches RLS enablement across schema qualification', () => {
  const sql = [
    'CREATE TABLE orders (id int);',
    'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;',
  ].join('\n');
  assert.equal(detectMissingRLS(sql, 'migrations/003.sql').length, 0);
});

// ---------------------------------------------------------- sql injection

test('flags a JS template literal building SQL', () => {
  const src = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
  const f = detectSqlInterpolation(src);
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, 'sql-interp');
});

test('flags a Python f-string building SQL', () => {
  const src = 'q = f"DELETE FROM sessions WHERE token = {tok}"';
  assert.equal(detectSqlInterpolation(src).length, 1);
});

test('flags string concatenation building SQL', () => {
  const src = 'const q = "SELECT * FROM users WHERE id = " + userId;';
  assert.equal(detectSqlInterpolation(src).length, 1);
});

test('does not flag a parameterized query', () => {
  const src = 'const q = "SELECT * FROM users WHERE id = $1";';
  assert.equal(detectSqlInterpolation(src).length, 0);
});

test('does not flag interpolation without SQL keywords', () => {
  const src = 'const msg = `hello ${name}`;';
  assert.equal(detectSqlInterpolation(src).length, 0);
});

test('respects a sql-interp override on the same line', () => {
  const src =
    'const q = `SELECT * FROM t WHERE id = ${id}`; // punchlist:allow sql-interp — id is a validated enum';
  assert.equal(detectSqlInterpolation(src).length, 0);
});

// -------------------------------------------------- additional cases

test('does not flag an error message mentioning UPDATE', () => {
  const src = 'throw new Error(`Failed to UPDATE ${table}`);';
  assert.equal(detectSqlInterpolation(src).length, 0);
});

test('does not flag a log message concatenating near SELECT', () => {
  const src = 'console.log("SELECT failed for user " + userId);';
  assert.equal(detectSqlInterpolation(src).length, 0);
});

test('still flags real SQL shapes in a template literal', () => {
  const src = 'const q = `UPDATE users SET name = ${name} WHERE id = 1`;';
  assert.equal(detectSqlInterpolation(src).length, 1);
});

test('does not flag Helm/Jinja template values', () => {
  assert.equal(detectSecrets('password: "{{ .Values.db.password }}"').length, 0);
  assert.equal(detectSecrets('token: "{% raw %}abc{% endraw %}"').length, 0);
});

test('flags an unquoted yaml-style secret', () => {
  const f = detectSecrets('db_password: hunter2secret9value31x');
  assert.equal(f.length, 1);
});

test('does not flag an unquoted UUID token', () => {
  assert.equal(
    detectSecrets('session_token: 550e8400-e29b-41d4-a716-446655440000').length,
    0,
  );
});

test('accepts a double-hyphen override as well as an em dash', () => {
  const src =
    'const k = "AKIA' + 'IOSFODNN7EXAMPLE"; // punchlist:allow secret -- docs fixture';
  assert.equal(detectSecrets(src).length, 0);
});

test('an override with no reason does not suppress', () => {
  const src = 'const k = "AKIA' + 'IOSFODNN7EXAMPLE"; // punchlist:allow secret —';
  assert.equal(detectSecrets(src).length, 1);
});

// ------------------------------------------- adversarial-review additions

test('flags vendor formats gitleaks covers and v1 missed', () => {
  const cases = [
    'const s = "sk_' + 'live_a1B2c3D4e5F6g7H8i9J0";',
    'const g = "AI' + 'zaSyA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU1";',
    'const gl = "glpat' + '-a1B2c3D4e5F6g7H8i9J0";',
    'const n = "npm' + '_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8";',
    'url = "https://hooks.slack' + '.com/services/T0001/B0001/a1B2c3D4e5F6g7H8i9J0k1L2";',
    'conn = "DefaultEndpointsProtocol=https;Account' + 'Key=a1B2c3D4e5F6g7H8i9J0a1B2c3D4e5F6g7H8i9J0ab==;"',
  ];
  for (const c of cases) {
    assert.equal(detectSecrets(c).length, 1, `missed: ${c.slice(0, 40)}`);
  }
});

test('does not flag a Stripe publishable key', () => {
  assert.equal(detectSecrets('const p = "pk_live_a1B2c3D4e5F6g7H8i9J0";').length, 0);
});

test('flags a multi-line template literal building SQL', () => {
  const src = [
    'const q = `',
    '  SELECT * FROM users',
    '  WHERE id = ${userId}',
    '`;',
  ].join('\n');
  assert.equal(detectSqlInterpolation(src).length, 1);
});

test('multi-line template literal without SQL shape stays clean', () => {
  const src = ['const t = `', '  Hello ${name},', '  welcome back.', '`;'].join('\n');
  assert.equal(detectSqlInterpolation(src).length, 0);
});

test('multi-line SQL respects an override on the opening line', () => {
  const src = [
    'const q = ` // punchlist:allow sql-interp — ids are validated enums',
    '  SELECT * FROM t WHERE id = ${id}',
    '`;',
  ].join('\n');
  assert.equal(detectSqlInterpolation(src).length, 0);
});

test('does not flag csrf/nonce token variables', () => {
  assert.equal(detectSecrets('csrf_token = "aGVsbG8gd29ybGQxMjM0NTY="').length, 0);
  assert.equal(detectSecrets('nonce_token = "a1b2c3d4e5f6g7h8i9j0"').length, 0);
});

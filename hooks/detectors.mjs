// Detectors operate on the incoming content string only — never the filesystem.
// Each returns Finding[] = { rule, line, excerpt, message }.
//
// Rule ids are load-bearing: they appear in the override annotation, in
// skills/code/references/security.md, and in the tests. Do not rename one in isolation.

// Em dash or double hyphen; the reason is mandatory — an override with no
// stated reason is the deferred-cleanup pattern the gate exists to catch.
const OVERRIDE = /punchlist:allow\s+([a-z-]+)\s+(?:—|--)\s*(\S.*)/;

/** True if `line` carries a reasoned override annotation for `rule`. */
export function hasOverride(line, rule) {
  const m = line.match(OVERRIDE);
  return Boolean(m && m[1] === rule);
}

/** Every override annotation in `content`, for the learnings write-back. */
export function getOverrides(content) {
  const out = [];
  content.split('\n').forEach((line, i) => {
    const m = line.match(OVERRIDE);
    if (m) out.push({ rule: m[1], reason: m[2].trim(), line: i + 1 });
  });
  return out;
}

// ---------------------------------------------------------------- secrets

// Values that look like secrets but are not. Applied ONLY to the generic
// `key = "value"` case — a structural match (AWS key id, private key block,
// JWT, connection string) is its own evidence and is never suppressed here.
// Suppressing structurally-matched secrets is how a real key ships: AWS's own
// documented fake ends in EXAMPLE, so a substring test would whitelist the
// entire AKIA shape.
const PLACEHOLDER =
  /^(\$\{|<|%|\{|your[-_]|example|placeholder|dummy|fake|sample|changeme|redacted|xxx+|\*{4,}|test[-_]?(key|token|secret)|insert[-_]|todo)/i;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlaceholder(value) {
  if (PLACEHOLDER.test(value)) return true; // `{`-leading = Helm/Jinja/format ref
  if (/^(.)\1+$/.test(value)) return true; // all one character
  if (/\$\{[^}]+\}/.test(value)) return true; // interpolated
  if (/^(process\.env|os\.environ)/.test(value)) return true;
  if (UUID.test(value)) return true; // row ids, not credentials
  return false;
}

const SECRET_PATTERNS = [
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: 'AWS access key id' },
  {
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
    what: 'private key block',
  },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, what: 'GitHub token' },
  { re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, what: 'Slack token' },
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/, what: 'Anthropic API key' },
  { re: /\bsk-[A-Za-z0-9]{20,}\b/, what: 'OpenAI-style API key' },
  { re: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/, what: 'OpenAI project API key' },
  { re: /\bsb_secret_[A-Za-z0-9_-]{20,}/, what: 'Supabase secret key' },
  // pk_ (publishable) is deliberately excluded — it is public by design.
  { re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/, what: 'Stripe key' },
  { re: /\bAIza[0-9A-Za-z_-]{30,}\b/, what: 'Google API key' },
  { re: /\bglpat-[A-Za-z0-9_-]{20,}\b/, what: 'GitLab PAT' },
  { re: /\bnpm_[A-Za-z0-9]{30,}\b/, what: 'npm token' },
  { re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/, what: 'SendGrid key' },
  { re: /AccountKey=[A-Za-z0-9+/]{40,}={0,2}/, what: 'Azure storage key' },
  {
    re: /hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]{16,}/,
    what: 'Slack webhook URL',
  },
  {
    re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    what: 'JWT (possible service-role key)',
  },
  {
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@/]{4,}@/,
    what: 'connection string with inline password',
  },
];

// key = "value" / key: 'value' — the generic assignment case. The `[\w-]*`
// prefix matters: real keys are `DB_PASSWORD`, `POSTGRES_PASSWORD`,
// `stripe_secret` — a bare \b boundary never matches them.
const ASSIGNED =
  /\b([\w-]*(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|credential|private[_-]?key|access[_-]?key|service[_-]?role[_-]?key|auth))\b["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/i;

// Key names that *contain* "token" but are not credentials: per-request CSRF
// tokens, nonces, anti-forgery values. Hard-blocking these is the annoyance
// class that gets gates disabled.
const NON_SECRET_KEY = /(csrf|xsrf|nonce|anti[-_]?forgery)/i;

// Unquoted yaml/env form: `db_password: value` with nothing after the value.
// The end-of-line requirement is load-bearing — a JS `password = someVar;`
// ends in `;` and never matches, which keeps variable references out.
// Value must mix letters and digits; `auth` is excluded (too prose-common bare).
const ASSIGNED_BARE =
  /\b([\w-]*(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|credential|private[_-]?key|access[_-]?key|service[_-]?role[_-]?key))\b["']?\s*[:=]\s*([A-Za-z0-9_\-./+=]{16,})\s*(?:#.*)?$/i;

/** Never echo a full secret back into the transcript. */
function redact(value) {
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}…${'*'.repeat(6)}`;
}

export function detectSecrets(content) {
  const findings = [];

  content.split('\n').forEach((line, i) => {
    if (hasOverride(line, 'secret')) return;

    // Structural patterns are self-evidencing — no placeholder suppression.
    for (const { re, what } of SECRET_PATTERNS) {
      const m = line.match(re);
      if (m) {
        findings.push({
          rule: 'secret',
          line: i + 1,
          excerpt: redact(m[0]),
          message: `Hardcoded ${what}.`,
        });
        return; // one finding per line is enough to block
      }
    }

    // Quoted form flags on length alone; the bare form additionally requires
    // a letter+digit mix so prose like `password: temporarily-disabled` and
    // bare identifiers stay out of a hard gate.
    const q0 = line.match(ASSIGNED);
    const q = q0 && !NON_SECRET_KEY.test(q0[1]) ? q0 : null;
    const b0 = q ? null : line.match(ASSIGNED_BARE);
    const b = b0 && !NON_SECRET_KEY.test(b0[1]) ? b0 : null;
    const hit =
      (q && !isPlaceholder(q[2])) ||
      (b && !isPlaceholder(b[2]) && /[A-Za-z]/.test(b[2]) && /[0-9]/.test(b[2]));
    if (hit) {
      const a = q ?? b;
      findings.push({
        rule: 'secret',
        line: i + 1,
        excerpt: redact(a[2]),
        message: `Hardcoded value assigned to \`${a[1]}\`.`,
      });
    }
  });

  return findings;
}

// -------------------------------------------------------------------- rls

const SQL_FILE = /\.(sql|pgsql)$/i;
const CREATE_TABLE =
  /\bCREATE\s+(?:(TEMP|TEMPORARY|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."]+)/gi;
const ENABLE_RLS =
  /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z0-9_."]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

/** Bare table name, schema and quotes stripped, lowercased. */
function bareName(ident) {
  const parts = ident.replace(/"/g, '').split('.');
  return parts[parts.length - 1].toLowerCase();
}

export function detectMissingRLS(content, filePath = '') {
  if (!SQL_FILE.test(filePath)) return [];
  if (content.split('\n').some((l) => hasOverride(l, 'rls'))) return [];

  // Commented-out SQL neither creates a table nor enables RLS. Block comments
  // keep their newlines so reported line numbers stay true.
  const sql = content.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')).replace(/--[^\n]*/g, '');
  const created = new Map(); // bare name -> 1-indexed line
  for (const m of sql.matchAll(CREATE_TABLE)) {
    if (m[1]) continue; // TEMP / TEMPORARY / UNLOGGED — no user rows
    created.set(bareName(m[2]), sql.slice(0, m.index).split('\n').length);
  }

  const enabled = new Set(
    [...sql.matchAll(ENABLE_RLS)].map((m) => bareName(m[1])),
  );

  return [...created.entries()]
    .filter(([name]) => !enabled.has(name))
    .map(([name, line]) => ({
      rule: 'rls',
      line,
      excerpt: `CREATE TABLE ${name}`,
      message: `Table \`${name}\` is created without \`ENABLE ROW LEVEL SECURITY\` in the same migration.`,
    }));
}

// ---------------------------------------------------------- sql injection

// A statement *shape*, tested against the built string itself — not a keyword
// anywhere on the line. Bare SELECT/UPDATE appear constantly in error messages
// and logs (a failed-UPDATE message naming a table); requiring FROM/SET/INTO keeps those
// out of a hard gate while every real query still matches.
const SQL_SHAPE =
  /\b(SELECT\b[^;`"']*?\bFROM\b|INSERT\s+INTO\b|UPDATE\b[^;`"']*?\bSET\b|DELETE\s+FROM\b|DROP\s+TABLE\b|TRUNCATE\s+TABLE\b|ALTER\s+TABLE\b)/i;

const INTERP_FORMS = [
  { re: /`[^`]*\$\{[^}]*\}[^`]*`/, what: 'template literal' },
  { re: /\bf(["'])(?:(?!\1).)*\{[^}]*\}(?:(?!\1).)*\1/, what: 'f-string' },
  {
    re: /(["'])(?:(?!\1).)*\1\s*\+\s*[A-Za-z_$][\w$.]*/,
    what: 'string concatenation',
  },
];

// Whole-content pass: multi-line template literals are the dominant real
// shape of built SQL in JS, and a per-line scan structurally cannot see them
// (the `${}` line has no SQL shape; the SELECT line has no interpolation).
// Independently flagged by two adversarial reviews before this existed.
const TEMPLATE_SPAN = /`(?:[^`\\]|\\.)*`/g;

export function detectSqlInterpolation(content) {
  const findings = [];
  const lines = content.split('\n');
  const flaggedLines = new Set();

  lines.forEach((line, i) => {
    if (hasOverride(line, 'sql-interp')) return;

    for (const { re, what } of INTERP_FORMS) {
      const m = line.match(re);
      if (m && SQL_SHAPE.test(m[0])) {
        findings.push({
          rule: 'sql-interp',
          line: i + 1,
          excerpt: line.trim().slice(0, 80),
          message: `SQL built by ${what}. Use parameter placeholders instead.`,
        });
        flaggedLines.add(i + 1);
        return;
      }
    }
  });

  for (const m of content.matchAll(TEMPLATE_SPAN)) {
    const span = m[0];
    if (!span.includes('\n')) continue; // single-line handled above
    if (!span.includes('${') || !SQL_SHAPE.test(span)) continue;
    const startLine = content.slice(0, m.index).split('\n').length;
    if (flaggedLines.has(startLine)) continue;
    const spanLines = span.split('\n').length;
    const covered = lines.slice(startLine - 1, startLine - 1 + spanLines);
    if (covered.some((l) => hasOverride(l, 'sql-interp'))) continue;
    findings.push({
      rule: 'sql-interp',
      line: startLine,
      excerpt: covered[0].trim().slice(0, 80),
      message: 'SQL built by multi-line template literal. Use parameter placeholders instead.',
    });
  }

  return findings;
}

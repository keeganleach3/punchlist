import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEXT } from './session-start.mjs';

const script = fileURLToPath(new URL('./session-start.mjs', import.meta.url));
const run = (input) => execFileSync(process.execPath, [script], { input, encoding: 'utf8' });

test('text is at most 160 words and names both skills exactly', () => {
  assert.ok(TEXT.trim().split(/\s+/).length <= 160);
  assert.ok(TEXT.includes('`punchlist:code`'));
  assert.ok(TEXT.includes('`punchlist:design`'));
});

test('prints exactly one SessionStart JSON object, whatever stdin holds', () => {
  for (const input of ['{}', '', 'not json', '{"hook_event_name":"SessionStart"}']) {
    const out = run(input);
    assert.deepEqual(JSON.parse(out), {
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: TEXT },
    });
    assert.equal(out.trim().split('\n').length, 1);
  }
});

test('hooks.json wires SessionStart with no matcher', () => {
  const cfg = JSON.parse(execFileSync(process.execPath, ['-e', "process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))", fileURLToPath(new URL('./hooks.json', import.meta.url))], { encoding: 'utf8' }));
  const entry = cfg.hooks.SessionStart[0];
  assert.equal(entry.matcher, undefined);
  assert.match(entry.hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/session-start\.mjs/);
});

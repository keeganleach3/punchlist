#!/usr/bin/env node
// SessionStart: tells the model when to load which skill. Skills only help if
// they are loaded before acting; nothing else in the plugin forces that.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TEXT =
  'The punchlist plugin is installed. Load a skill BEFORE acting, not after: ' +
  '(1) Before writing code for a new service, endpoint, route, schema, migration or job, or any change touching auth, money or a public endpoint: load the `punchlist:code` skill and follow its contract step first. ' +
  '(2) Before building or changing a page, dashboard, chart, or any number shown on screen: load the `punchlist:design` skill first. ' +
  "(3) Before saying a change is done, fixed or passing: load that skill's `verify` reference. " +
  '(4) Before dispatching a subagent: load `shared/dispatch.md` through either skill. ' +
  'If the task is none of these, do not load them.';

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const out = JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: TEXT } });
  // stdin is never read: the output does not depend on it, and a closed or empty pipe must not matter.
  try {
    process.stdout.write(`${out}\n`);
  } catch {
    /* never throw into the session */
  }
  process.exit(0);
}

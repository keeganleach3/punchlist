import { homedir } from 'node:os';
import { join } from 'node:path';

/** Folder holding CODE-LEARNINGS.md and DESIGN-LEARNINGS.md. */
export const notesDir = (env = process.env) => env.PUNCHLIST_NOTES_DIR || join(homedir(), '.claude');

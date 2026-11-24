import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Node resolves the module URL through the installed current symlink, but argv
// retains the path supplied by the systemd unit or the operator.
export function invokedDirectly(moduleUrl) {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === fileURLToPath(moduleUrl); }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

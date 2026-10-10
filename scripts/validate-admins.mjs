import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

export function validateAdmins(raw) {
  const doc = YAML.parseDocument(raw, { uniqueKeys: true, strict: true });
  if (doc.errors.length) throw new Error('Invalid YAML: ' + doc.errors[0].message);
  const config = doc.toJS();
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      Object.keys(config).length !== 1 || !Array.isArray(config.admins)) {
    throw new Error('Expected only an admins: list');
  }
  const seen = new Set();
  const normalized = [];
  for (const entry of config.admins) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).some(key => !['email', 'enabled'].includes(key)) ||
        typeof entry.email !== 'string' || typeof entry.enabled !== 'boolean') {
      throw new Error('Each administrator must have email and enabled boolean');
    }
    const email = entry.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid administrator email');
    if (seen.has(email)) throw new Error('Duplicate administrator email');
    seen.add(email);
    normalized.push({ email, enabled: entry.enabled });
  }
  return normalized;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] || 'config/admins.yaml';
  try {
    const admins = validateAdmins(fs.readFileSync(path, 'utf8'));
    console.log(`Validated ${admins.length} administrator entries`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

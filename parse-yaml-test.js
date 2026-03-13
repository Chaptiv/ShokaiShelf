import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const content = fs.readFileSync(path.join(__dirname, 'artifacts', 'latest-mac.yml'), 'utf8');
  const parsed = yaml.load(content);
  console.log('Successfully parsed YAML.');
  console.log('Version:', parsed.version);
  console.log('Release Notes (preview):', typeof parsed.releaseNotes === 'string' ? parsed.releaseNotes.substring(0, 50) + '...' : 'Missing');
} catch (err) {
  console.error('YAML parse error:', err);
}

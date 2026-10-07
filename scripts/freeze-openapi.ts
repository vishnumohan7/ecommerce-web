import { writeFile } from 'node:fs/promises';
async function main() {
  const base = (process.env.API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
  const response = await fetch(`${base}/api/docs-json`);
  if (!response.ok) throw new Error(`OpenAPI endpoint returned ${response.status}`);
  await writeFile('docs/openapi-v1.json', `${JSON.stringify(await response.json(), null, 2)}\n`);
  console.log('Frozen docs/openapi-v1.json');
}
void main();

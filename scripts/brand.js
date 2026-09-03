#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npm run brand <slug>');
  console.error('Example: npm run brand hidden-hill-farm');
  process.exit(1);
}

const brandPath = path.join(__dirname, '..', 'constants', 'brands', `${slug}.json`);
if (!fs.existsSync(brandPath)) {
  const available = fs.readdirSync(path.join(__dirname, '..', 'constants', 'brands'))
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.replace('.json', ''));
  console.error(`Brand not found: ${slug}`);
  console.error(`Available: ${available.join(', ')}`);
  process.exit(1);
}

const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));

const output = `// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE BRAND CONFIG — generated from brands/${slug}.json
// Do not edit directly. Run: npm run brand ${slug}
// ─────────────────────────────────────────────────────────────────────────────

const config = {
  slug:      '${brand.slug}',
  barnName:  '${brand.barnName}',
  appName:   '${brand.appName}',
  tagline:   '${brand.tagline ?? ''}',
  chipStyle: 'outlined' as const,
  colors: {
    background: '${brand.theme.surface}',
    primary:    '${brand.theme.primary}',
    accent:     '${brand.theme.secondary}',
  },
} as const;

export default config;
`;

const outputPath = path.join(__dirname, '..', 'constants', 'brand-config.ts');
fs.writeFileSync(outputPath, output);

console.log(`✓ Switched to: ${brand.barnName} (${slug})`);
console.log(`  Primary:   ${brand.theme.primary}`);
console.log(`  Secondary: ${brand.theme.secondary}`);
console.log(`  Surface:   ${brand.theme.surface}`);
console.log('');
console.log('Restart your dev server to apply changes.');

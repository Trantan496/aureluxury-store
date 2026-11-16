import '../scripts/lint-minimatch-compat.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';

const require = createRequire(import.meta.url);
const match = require('minimatch');

test('patched minimatch preserves CommonJS callable and ESM class consumers', async () => {
  assert.equal(require('minimatch/package.json').version, '11.0.3');
  const imported = await import(pathToFileURL(require.resolve('minimatch')).href);
  assert.equal(typeof imported.default.Minimatch, 'function');
  assert.equal(match('src/app/page.tsx', '**/*.tsx'), true);
  assert.equal(new imported.default.Minimatch('**/*.tsx').match('src/app/page.tsx'), true);
});
test('legacy Minimatch class preserves dotfile matching options', () => {
  const matcher = new match.Minimatch('**/*.ts', { dot: true });
  assert.equal(matcher.match('src/.internal/example.ts'), true);
  assert.equal(matcher.match('src/.internal/example.js'), false);
});
test('legacy makeRe supports import rule globs', () => {
  const expression = match.makeRe('src/features/**/!(*.test).ts');
  assert.equal(typeof expression.test, 'function');
  assert.equal(expression.test('src/features/payments/service.ts'), true);
  assert.equal(expression.test('src/features/payments/service.test.ts'), false);
});
test('legacy filter helper preserves ignore glob behavior', () => {
  assert.deepEqual(['.next/types/routes.ts', 'src/app/page.tsx'].filter(match.filter('.next/**', { dot: true })), ['.next/types/routes.ts']);
});
test('legacy match helper preserves brace expansion', () => {
  assert.deepEqual(match.match(['src/page.ts', 'src/page.tsx', 'src/style.css'], '**/*.{ts,tsx}'), ['src/page.ts', 'src/page.tsx']);
});
test('legacy defaults returns a callable matcher with bound helper options', () => {
  const insensitive = match.defaults({ nocase: true });
  assert.equal(insensitive('PRODUCT.TSX', '*.tsx'), true);
  assert.equal(new insensitive.Minimatch('*.tsx').match('PRODUCT.TSX'), true);
});
test('modern named minimatch export remains available to TypeScript ESLint', () => {
  const parserRequire = createRequire(require.resolve('@typescript-eslint/typescript-estree'));
  const modern = parserRequire('minimatch');
  assert.equal(typeof modern.minimatch, 'function');
  assert.equal(modern.minimatch('src/features/payments/service.ts', 'src/**/*.ts'), true);
});
test('ESLint still enforces Next React and accessibility rules with generated files ignored', async () => {
  const eslint = new ESLint({ overrideConfig: [{ rules: { 'react/forbid-component-props': ['error', { forbid: [{ propName: 'style', allowedFor: ['Allowed*'] }] }], 'import/no-internal-modules': ['error', { forbid: ['forbidden/**'] }] } }] });
  assert.equal(await eslint.isPathIgnored('.next/types/routes.ts'), true);
  const [result] = await eslint.lintText('import item from "forbidden/internal"; export default function Example() { return <section><img src="/image.png"/><Button style={{color:"red"}}>{String(item)}</Button></section>; }', { filePath: 'src/audit-fixture.tsx' });
  const rules = new Set(result.messages.map(message => message.ruleId));
  assert.ok(rules.has('@next/next/no-img-element'));
  assert.ok(rules.has('jsx-a11y/alt-text'));
  assert.ok(rules.has('react/forbid-component-props'));
  assert.ok(rules.has('import/no-internal-modules'));
});

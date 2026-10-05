import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const moneyName = /price|amount|total|fee|discount|tax|subtotal/i;
const custom = {
  rules: {
    'no-money-number': {
      create(context) {
        return {
          TSPropertySignature(node) {
            const name = node.key?.name;
            if (typeof name === 'string' && moneyName.test(name) && node.typeAnnotation?.typeAnnotation?.type === 'TSNumberKeyword') context.report({ node, message: 'Money must use bigint or a wire string.' });
          },
        };
      },
    },
    'no-raw-hex': {
      create(context) { return { Literal(node) { if (typeof node.value === 'string' && /#[0-9a-f]{3,8}\b/i.test(node.value)) context.report({ node, message: 'Use a branding CSS token.' }); } }; },
    },
    'no-jsx-literals': {
      create(context) { return { JSXText(node) { if (node.value.trim()) context.report({ node, message: 'User-facing JSX text must come from i18n.' }); } }; },
    },
  },
};

export default tseslint.config(
  { ignores: ['**/.next/**', '**/dist/**', '**/coverage/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: ['**/*.ts', '**/*.tsx'], languageOptions: { ...config.languageOptions, parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }, globals: { ...globals.node, ...globals.browser } } })),
  { files: ['**/*.ts', '**/*.tsx'], plugins: { local: custom }, rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unnecessary-condition': 'off', 'local/no-money-number': 'error' } },
  { files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'], rules: { 'local/no-raw-hex': 'error', 'local/no-jsx-literals': 'error' } },
  { files: ['apps/api/src/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/common/database/prisma.service'], message: 'Use TenantScopedPrismaService.' }] }] } },
  { files: ['apps/api/src/**/*.ts'], rules: { '@typescript-eslint/no-extraneous-class': 'off' } },
  { files: ['apps/api/src/common/database/**/*.ts'], rules: { 'no-restricted-imports': 'off' } },
  { files: ['**/*.test.ts', '**/*.spec.ts'], rules: { '@typescript-eslint/no-confusing-void-expression': 'off' } },
  { files: ['apps/api/prisma/seed-*.ts'], rules: { '@typescript-eslint/no-non-null-assertion': 'off', '@typescript-eslint/restrict-template-expressions': 'off' } },
  { files: ['scripts/**/*.ts', '**/*.config.{js,mjs,ts}'], rules: { '@typescript-eslint/no-unsafe-call': 'off', '@typescript-eslint/no-unsafe-member-access': 'off', '@typescript-eslint/no-unsafe-assignment': 'off' } },
);

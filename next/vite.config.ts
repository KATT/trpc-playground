import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 80,
    ignorePatterns: [
      'pnpm-lock.yaml',
      '.repos/**',
      '**/dist/**',
      'spikes/**/generated/**',
    ],
  },
  lint: {
    ignorePatterns: ['.repos/**', '**/dist/**', 'spikes/**/generated/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ['spikes/**'],
        rules: {
          'no-console': 'off',
        },
      },
    ],
  },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'test/**/*.test.ts',
      'spikes/**/*.test.ts',
    ],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.vitest.json',
      include: ['packages/*/src/**/*.test-d.ts', 'spikes/**/*.test-d.ts'],
    },
  },
  staged: {
    '*': 'vp check --fix',
    '*.ts': 'vp test related --run',
  },
});

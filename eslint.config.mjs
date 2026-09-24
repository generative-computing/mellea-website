import nextConfig from 'eslint-config-next';
import js from '@eslint/js';
import globals from 'globals';

const config = [
  ...nextConfig,
  {
    // This site is a static export (images.unoptimized) and every image is an
    // inline SVG, so next/image offers no optimization benefit — raw <img> is
    // the correct choice here.
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['public/js/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'error',
      'no-undef': 'error',
    },
  },
];
export default config;

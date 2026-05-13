module.exports = {
  root: true,
  env: {
    es2024: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
  },
  ignorePatterns: [
    'node_modules/',
    'backend/node_modules/',
    'frontend/node_modules/',
    'dist/',
    'build/',
    'coverage/',
    'public/',
  ],
  overrides: [
    {
      files: ['frontend/**/*.{js,jsx}'],
      env: {
        browser: true,
        es2024: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
      extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'prettier',
      ],
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'jsx-a11y/anchor-is-valid': 'off',
        'react/jsx-filename-extension': ['warn', { extensions: ['.jsx', '.js'] }],
      },
    },
    {
      files: ['backend/**/*.js'],
      env: {
        node: true,
        es2024: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
      },
      extends: [
        'eslint:recommended',
        'plugin:import/recommended',
        'prettier',
      ],
      rules: {
        'no-console': 'warn',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'import/no-unresolved': 'off',
      },
    },
    {
      files: ['*.js'],
      env: {
        node: true,
        es2024: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
      },
      extends: ['eslint:recommended', 'prettier'],
      rules: {
      },
    },
  ],
};

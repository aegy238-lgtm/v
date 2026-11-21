import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'public/**/*', 'src/**/*', 'tests/**/*', '*.ts', '*.js'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];

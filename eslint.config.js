import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            // `any` permitido: TypeScript ya bloquea los bugs reales (errores 'no compila').
            // Esta regla es estilística — los pocos `any` que quedan son legítimos
            // (payloads de realtime de Supabase, celdas de Excel, catch blocks).
            // Cuando convenga tipar, usamos `unknown` + narrowing.
            '@typescript-eslint/no-explicit-any': 'off',
            // Vars sin usar son error, pero permitimos prefijo `_` para intencionales.
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],
        },
    },
);

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
		...reactPlugin.configs.flat.recommended,
		...reactPlugin.configs.flat['jsx-runtime'],
		plugins: {
			'react-hooks': reactHooksPlugin,
		},
		languageOptions: {
			...reactPlugin.configs.flat.recommended.languageOptions,
			globals: {
				...globals.browser,
			},
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
		rules: {
			...reactHooksPlugin.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
			'no-case-declarations': 'off',
		},
	},
	{
		files: ['src/components/ui/command.tsx'],
		rules: {
			'react/no-unknown-property': 'off',
		},
	},
	{
		files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
		languageOptions: {
			globals: {
				...globals.vitest,
			},
		},
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
];

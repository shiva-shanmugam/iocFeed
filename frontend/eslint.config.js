import js from '@eslint/js'; import globals from 'globals'; import reactHooks from 'eslint-plugin-react-hooks';
export default [js.configs.recommended,{files:['**/*.{ts,tsx}'],languageOptions:{globals:globals.browser,parserOptions:{ecmaFeatures:{jsx:true}}},plugins:{'react-hooks':reactHooks},rules:{...reactHooks.configs.recommended.rules,'no-unused-vars':'off'}}}]


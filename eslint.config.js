import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      // Scripts clássicos de escopo global compartilhado (compatível com file://).
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Bibliotecas carregadas via CDN (escopo global no runtime)
        pdfjsLib: 'readonly',
        mammoth: 'readonly',
        Tesseract: 'readonly',
        html2canvas: 'readonly',
      },
    },
    rules: {
      // Com escopo global compartilhado entre arquivos, no-undef/no-unused geram
      // falsos positivos; ESLint atua aqui como verificador de sintaxe/parse.
      'no-unused-vars': 'off',
    },
  },
];

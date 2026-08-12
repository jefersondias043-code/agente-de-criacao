import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom fornece document para os módulos que dependem do browser
    environment: 'jsdom',
    /* TEMPO POR TESTE — 20 s, não os 5 s do padrão.
     *
     * Vários testes de cartaz varrem TODOS os modelos em TODOS os formatos,
     * montando HTML e passando cada um pelo parser do jsdom. É trabalho de
     * verdade, e eles rodam em torno de 5 s — exatamente o limite padrão. O
     * resultado é que reprovavam de vez em quando, por 100 ou 500 ms, sempre
     * que a máquina estava mais ocupada. Foi o que apareceu quando a suíte
     * ganhou test/media-transcode-fiacao.test.js: dois arquivos diferentes
     * piscando em rodadas diferentes, nenhum deles com defeito.
     *
     * Teste que reprova por atraso de meio segundo não reprova nada — ensina a
     * ignorar a suíte, que é o pior estrago possível. Um travamento de verdade
     * continua reprovando, só que 15 s depois. */
    testTimeout: 20000,
    setupFiles: ['test/setup.js'],
    include: ['test/**/*.test.js'],
  },
});

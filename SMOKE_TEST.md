# Smoke test (verificação manual rápida)

Após qualquer mudança, sirva o app e confirme estes pontos (~5 min).

```
npm install        # uma vez
node scripts/static-server.mjs   # serve em http://localhost:8080
npm run lint       # 0 errors (warnings de no-unused são tolerados)
npm test           # 7/7 testes das funções puras
```

No navegador (http://localhost:8080):

- [ ] Console mostra "Agente de Postagem … pronto." e **nenhum erro**.
- [ ] Sidebar lista as 9 seções; clicar em cada uma troca a view sem erro.
- [ ] **Gerar**: selects de Estilo (28) e Tom (22) preenchidos; contador do textarea atualiza ao digitar.
- [ ] **Extrair**: dropzone aparece; histórico vazio com empty-state.
- [ ] **Cartazes**: "Novo cartaz" cria e renderiza o preview; editar headline atualiza ao vivo.
- [ ] **VideoGrab**: iframe carrega `videograb.html` com tema claro; com o servidor de
      `videograb-server/` rodando (`npm start`, porta 3000) o card de status mostra
      "Servidor conectado"; desligado, mostra a instrução de iniciar.
- [ ] **Detector Flop**: iframe carrega `detector-flop.html` (3 abas) com tema claro aplicado.
- [ ] **AutoPost IA** e **Replicador**: iframes carregam com tema claro.
- [ ] **Configurações**: trocar provedor (Groq/OpenAI/Anthropic) atualiza a lista de modelos.

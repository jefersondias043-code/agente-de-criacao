# Smoke test (verificação manual rápida)

Após qualquer mudança, sirva o app e confirme estes pontos (~5 min).

```
npm install        # uma vez
node scripts/static-server.mjs   # serve em http://localhost:8080
npm run lint       # 0 errors (warnings de no-unused são tolerados)
npm test           # 9/9 testes das funções puras
```

No navegador (http://localhost:8080):

- [ ] Console mostra "Agente de Postagem … pronto." e **nenhum erro**.
- [ ] Sidebar lista as 8 seções; clicar em cada uma troca a view sem erro.
- [ ] **Gerar**: selects de Estilo (28) e Tom (22) preenchidos; contador do textarea atualiza ao digitar.
- [ ] **Extrair**: dropzone aparece; histórico vazio com empty-state.
- [ ] **Cartazes**: "Novo cartaz" cria e renderiza o preview 1080×1440; editar headline atualiza ao vivo.
- [ ] **Downloads**: colar link do TikTok/Instagram mostra os botões de serviço.
- [ ] **Histórico**: empty-state com botão "Ir para Gerar".
- [ ] **Detector Flop**: iframe carrega `detector-flop.html` (título "Detector Flop — Estúdio", 3 abas) com tema claro aplicado.
- [ ] **Configurações**: trocar provedor (Groq/OpenAI/Anthropic) atualiza a lista de modelos.
```
```

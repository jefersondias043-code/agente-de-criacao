// AUTOPOST — o pacote vende o vídeo, não o substitui
//
// Relato: título e legenda entregavam tanta informação que quem lia já sabia o
// que tinha acontecido — e perdia a razão de assistir. O pacote virava resumo.
//
// A regra não estava ausente: estava diluída. "Sem entregar o desfecho" era um
// item entre oito no título, e a legenda só dizia "não é resumo". Ao mesmo
// tempo, tudo o mais empurrava para informar — impacto, clareza, coerência com
// o conteúdo. Diante de um pedido vago de não contar e vários pedidos claros de
// informar, o modelo informa.
//
// Prompt, porém, é pedido. O que estes testes protegem de verdade é a
// CONFERÊNCIA no código (`auditarSpoiler`), que roda depois de cada geração e
// mede a única coisa mensurável aqui: o desfecho mora no fim do roteiro, e
// palavra que só existe no último terço é o pagamento da história. Se ela está
// no título, o fim vazou.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (f) => readFileSync(join(raiz, f), 'utf8');

let P;
beforeAll(() => {
  // Os módulos do AutoPost são scripts clássicos, como os da plataforma-mãe.
  const codigo = ['autopost-ia/js/core.js', 'autopost-ia/js/api.js', 'autopost-ia/js/package.js']
    .map(ler).join('\n;\n');
  (0, eval)(codigo + `\n;globalThis.__AP__ = {
    palavrasDoDesfecho, spoilersEm, auditarSpoiler, penalidadeSpoiler,
    palavrasDoConteudo, RUBRICA_PACOTE, REGRAS_SEM_SPOILER, SPOILER_MIN_PALAVRAS_ROTEIRO };`);
  P = globalThis.__AP__;
});

/* Um roteiro em que o desfecho está claramente no fim: a revenda por duzentos
 * e o nome do comprador só aparecem no último terço. */
const ROTEIRO = `O vizinho apareceu na porta de casa com um relógio na mão dizendo que estava
precisando de dinheiro naquele mesmo dia. Perguntei quanto ele queria pelo relógio e ele
respondeu que vendia por cinquenta se fosse na hora. Olhei a peça de perto, era pesada,
tinha risco no vidro mas o ponteiro andava certinho. Falei que não pagava cinquenta de jeito
nenhum e ofereci vinte, para pagar daqui a trinta dias. Ele aceitou na hora, apertou minha
mão e foi embora dizendo que confiava em mim. Guardei o relógio no bolso e fui trabalhar
normalmente naquela terça de manhã. No caminho encontrei o Sabido, que entende de peça
antiga e mexe com isso faz tempo. Ele pediu para ver, virou o relógio, olhou a marca por
dentro e disse que aquilo ali era banhado a ouro de verdade. Ofereceu duzentos reais na
hora, em dinheiro vivo, e eu vendi ali mesmo na calçada. O vizinho descobriu no dia seguinte
e ficou possesso, cobrando os vinte reais que eu ainda nem tinha pagado a ele.`;

const pacote = (titulo, legenda) => ({ titulo, legenda, hashtags: [], palavras_chave: [] });

describe('onde mora o desfecho', () => {
  it('só número e nome próprio que estreiam no fim contam como desfecho', () => {
    const d = P.palavrasDoDesfecho(ROTEIRO);
    expect(d, 'a quantia da revenda é o pagamento da história').toContain('duzentos');
    expect(d, '"relogio" aparece desde o começo').not.toContain('relogio');
    expect(d, '"vinte" já foi dito no meio do vídeo').not.toContain('vinte');
  });

  it('verbo comum que estreia no fim NÃO é desfecho', () => {
    /* A primeira versão desta conta olhava qualquer palavra de conteúdo, e
     * devolvia "pediu", "olhou", "ficou", "verdade" e "reais" como desfecho —
     * verbos que por acaso estreiam tarde. Um título honesto ("me vendeu por
     * vinte reais") era acusado de entregar o fim. Falso positivo aqui empurra
     * o pacote para o vago, que é pior do que o defeito original. */
    const d = P.palavrasDoDesfecho(ROTEIRO);
    ['pediu', 'olhou', 'virou', 'ficou', 'verdade', 'dentro', 'reais', 'marca']
      .forEach((w) => expect(d, `"${w}" não vaza desfecho nenhum`).not.toContain(w));
  });

  it('nome próprio que estreia no fim conta', () => {
    const roteiro = ROTEIRO.replace('encontrei o Sabido, que entende', 'encontrei um conhecido que entende')
      + ' No fim das contas quem levou o relógio foi o Firmino, da feira.';
    expect(P.palavrasDoDesfecho(roteiro)).toContain('firmino');
  });

  it('não inventa desfecho em texto curto demais para ter terços', () => {
    // Sem roteiro não há fim, e acusar spoiler no escuro seria pior do que não
    // conferir. A auditoria diz `conferido: false` em vez de dizer "ok".
    expect(P.palavrasDoDesfecho('um vídeo curto sobre um relógio')).toEqual([]);
    const a = P.auditarSpoiler(pacote('qualquer título aqui', 'qualquer legenda'), 'texto curto');
    expect(a.conferido).toBe(false);
    expect(a.problemas).toEqual([]);
  });
});

describe('a conferência do spoiler', () => {
  it('acusa o título que conta como termina', () => {
    const a = P.auditarSpoiler(
      pacote('Comprei por vinte e revendi por duzentos na mesma tarde',
        'O vizinho bateu na minha porta precisando de dinheiro. O que veio depois eu não esperava. Você faria o mesmo?'),
      ROTEIRO);
    expect(a.noTitulo).toContain('duzentos');
    expect(a.problemas.join(' ')).toMatch(/o título entrega o desfecho/);
    expect(a.ok).toBe(false);
  });

  it('aprova o título que dá a situação e retém a resposta', () => {
    const a = P.auditarSpoiler(
      pacote('O vizinho me vendeu um relógio por vinte reais para pagar em trinta dias',
        'Ele apareceu na porta precisando de dinheiro e aceitou vinte reais na hora. O que aconteceu meia hora depois mudou tudo. Você teria pagado quanto?'),
      ROTEIRO);
    expect(a.problemas).toEqual([]);
    expect(a.ok).toBe(true);
    expect(a.conferido, 'aprovou sem ter medido nada').toBe(true);
  });

  it('a legenda tolera uma coincidência, mas não duas', () => {
    // Ela tem espaço para contextualizar; uma palavra do fim pode cair ali sem
    // ser revelação. Duas já é contar. Este roteiro tem DOIS desfechos vazáveis
    // — a quantia e o nome de quem comprou —, que é o que permite medir a
    // diferença entre uma e duas.
    const roteiro = ROTEIRO + ' Quem levou o relógio no fim mesmo foi o Firmino, da feira velha.';
    expect(P.palavrasDoDesfecho(roteiro).length, 'o teste precisa de dois vazáveis').toBeGreaterThan(1);

    const uma = P.auditarSpoiler(pacote('Um relógio, vinte reais e trinta dias de prazo',
      'O vizinho precisava de dinheiro e eu ofereci vinte na hora. No fim quem levou foi o Firmino. E você?'), roteiro);
    expect(uma.naLegenda.length).toBe(1);
    expect(uma.problemas.join(' ')).not.toMatch(/a legenda entrega/);

    const duas = P.auditarSpoiler(pacote('Um relógio, vinte reais e trinta dias de prazo',
      'O Firmino ofereceu duzentos reais na hora e eu vendi ali mesmo. Você venderia?'), roteiro);
    expect(duas.naLegenda.length).toBeGreaterThan(1);
    expect(duas.problemas.join(' ')).toMatch(/a legenda entrega o desfecho/);
  });

  it('uma legenda que retém o desfecho passa, mesmo falando do vídeo todo', () => {
    /* Houve aqui uma segunda conferência, por abrangência: se a legenda
     * encostasse nos três terços do roteiro, seria resumo. Não sobreviveu à
     * medição — palavras comuns se repetem ao longo de qualquer roteiro, e a
     * conta reprovava justamente a legenda certa. Este teste guarda o caso que
     * a derrubou. */
    const a = P.auditarSpoiler(
      pacote('O vizinho me vendeu um relógio por vinte reais para pagar em trinta dias',
        'Ele apareceu na porta precisando de dinheiro e aceitou vinte reais na hora. O que aconteceu meia hora depois mudou tudo. Você teria pagado quanto?'),
      ROTEIRO);
    expect(a.problemas, 'a legenda retém o desfecho — não pode ser acusada').toEqual([]);
  });

  it('a penalidade cobra mais caro do título — é ele que decide o clique', () => {
    const comTitulo = P.auditarSpoiler(pacote('Revendi por duzentos', 'situação sem revelar nada demais aqui'), ROTEIRO);
    const comLegenda = P.auditarSpoiler(pacote('Um relógio na porta de casa',
      'O comprador pagou duzentos reais pelo relógio na calçada mesmo, sem pensar duas vezes. E você?'), ROTEIRO);
    expect(P.penalidadeSpoiler(comTitulo)).toBeGreaterThan(0);
    expect(P.penalidadeSpoiler(comTitulo)).toBeGreaterThan(P.penalidadeSpoiler(comLegenda) / 2);
    expect(P.penalidadeSpoiler(null)).toBe(0);
  });

  it('pacote limpo não paga penalidade nenhuma', () => {
    const a = P.auditarSpoiler(
      pacote('O vizinho me vendeu um relógio por vinte reais para pagar em trinta dias',
        'Ele apareceu na porta precisando de dinheiro e aceitou vinte na hora. O que veio depois eu não esperava. Você teria pagado quanto?'),
      ROTEIRO);
    expect(P.penalidadeSpoiler(a)).toBe(0);
  });
});

describe('o que a IA recebe', () => {
  it('a distinção situação × desfecho vem antes das regras dos dois campos', () => {
    const pkg = ler('autopost-ia/js/package.js');
    const iRegra = pkg.indexOf('${REGRAS_SEM_SPOILER}');
    const iTitulo = pkg.indexOf('==== REGRAS DO TÍTULO ====');
    expect(iRegra, 'a regra do spoiler não entrou no prompt do pacote').toBeGreaterThan(0);
    expect(iRegra, 'ela precisa ser lida ANTES das regras do título').toBeLessThan(iTitulo);
  });

  it('a regra dá o teste que o modelo consegue aplicar sozinho', () => {
    expect(P.REGRAS_SEM_SPOILER).toMatch(/SITUAÇÃO é o que está em jogo/);
    expect(P.REGRAS_SEM_SPOILER).toMatch(/DESFECHO é a resposta/);
    expect(P.REGRAS_SEM_SPOILER).toMatch(/ainda sobra uma pergunta cuja resposta só está no vídeo/);
    expect(P.REGRAS_SEM_SPOILER, 'o desfecho mora no fim do roteiro').toMatch(/últimos trechos do conteúdo/);
  });

  it('e avisa que reter a resposta não é ser vago', () => {
    // Sem isto, a correção do spoiler produz título genérico — que não desperta
    // curiosidade, desperta desconfiança.
    expect(P.REGRAS_SEM_SPOILER).toMatch(/NÃO é permissão para ser vago/);
    expect(P.REGRAS_SEM_SPOILER).toMatch(/detalhe CONCRETO da situação/);
  });

  it('regenerar só o título ou só a legenda mantém a regra', () => {
    // A regeneração por card tinha uma linha de regras. Sem a doutrina ali,
    // trocar o título desfazia a correção.
    const pkg = ler('autopost-ia/js/package.js');
    const trecho = pkg.slice(pkg.indexOf("if (campo === 'titulo')"), pkg.indexOf("if (campo === 'hashtags')"));
    expect((trecho.match(/\$\{REGRAS_SEM_SPOILER\}/g) || []).length,
      'título e legenda precisam dos dois').toBe(2);
  });

  it('a rubrica do juiz cobra a curiosidade, e trata spoiler como falha grave', () => {
    const c = P.RUBRICA_PACOTE.find((r) => r.id === 'curiosidade');
    expect(c, 'sem critério na rubrica, o juiz não olha isso').toBeTruthy();
    expect(c.desc).toMatch(/falha GRAVE/);
    expect(c.desc, 'ser vago não pode virar a saída fácil').toMatch(/Ser vago também não vale/);
  });

  it('a coerência deixa de empurrar para o resumo', () => {
    // O critério dizia que título e legenda devem falar do MESMO conteúdo — o
    // que, sozinho, premia quem conta mais. Agora ele diz onde isso para.
    const c = P.RUBRICA_PACOTE.find((r) => r.id === 'coerencia');
    expect(c.desc).toMatch(/Coerência é falar do mesmo vídeo — NÃO é contá-lo/);
  });

  it('o HTML publicado carrega a mesma regra que a fonte', () => {
    // `autopost-ia.html` é gerado de `autopost-ia/`; é ele que o usuário abre.
    expect(ler('autopost-ia.html')).toMatch(/REGRAS_SEM_SPOILER/);
  });
});

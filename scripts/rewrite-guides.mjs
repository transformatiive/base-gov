#!/usr/bin/env node
/**
 * Reescreve os guias públicos publicados via PUT /api/agent/guides/:slug.
 *
 * Não envia published_at — a data fica na BD.
 * Nunca usa o slug reservado o-que-e-o-base-gov.
 * Ação do leitor só no PrepBid (perfil, radar, carteira, alertas, «agir esta semana»).
 * Não mandar filtrar / pesquisar / acompanhar no BASE, Portal BASE, base.gov ou «BASE / radar».
 *
 * Uso:
 *   APP_API_KEY=… node scripts/rewrite-guides.mjs
 *   APP_API_KEY=… ORIGIN=https://prepbid.com AGENT=claude node scripts/rewrite-guides.mjs
 *   node scripts/rewrite-guides.mjs --dry-run
 *
 * A chave lê-se de APP_API_KEY (serviço Railway PrepBid) e nunca é impressa.
 */

export const GUIDES = [
  {
    slug: 'acordo-quadro-o-que-significa-para-a-proposta',
    title: 'Acordo-quadro: o que muda na sua proposta em duas fases',
    description:
      'Num acordo-quadro ganha-se primeiro o lugar entre os aderentes; as adjudicações seguintes correm nas segundas fases. Como o PrepBid sinaliza este canal no radar.',
    lede:
      'No acordo-quadro a empresa concorre duas vezes: primeiro para ficar no acordo, depois nas segundas fases só entre quem aderiu. Filtrar isto no PrepBid evita tratar um AQ como um concurso aberto normal.',
    intent: 'informativa',
    tags: ['acordo-quadro', 'ccp', 'radar'],
    markdown: `## O que é um acordo-quadro?

Um **acordo-quadro** fixa condições (preços, catálogo, prazos) com um ou vários operadores por um período. A adjudicação concreta — o trabalho ou o fornecimento — acontece depois, nas **segundas fases** (consultas internas, miniconcursos ou encomendas). Quem não ficou na adesão, em regra, não entra nessas fases.

No **PrepBid**, o tipo de procedimento e o CPV aparecem no radar já cortados pelo perfil. Aí se decide se age esta semana — adesão, segunda fase ou renovação.

## Porque importa na estratégia comercial?

Ignorar acordos-quadro é perder um canal de contratação centralizada (ESPAP, municípios, saúde, energia). Em obras e fornecimentos, o volume está muitas vezes nas segundas fases, não no anúncio de adesão.

- Na **adesão**, o critério e a habilitação definem se entra no clube.
- Nas **segundas fases**, o calendário é curto e a concorrência é só entre aderentes.
- No PrepBid os AQ aparecem com contexto de tipo de procedimento no radar; marque-os na **carteira** se a adesão for um «sim» e acompanhe as renovações do acordo.

## O que ler com atenção nas peças?

Confirme duração do acordo, número máximo de aderentes, regras das segundas fases, caução e se há obrigação de responder a consultas. Um «não» na adesão custa o canal durante anos; um «sim» mal preparado custa caução e capacidade.

## Como acompanhar oportunidades de acordos-quadro?

No **PrepBid**, filtre no radar por tipo de procedimento e CPV. Marque a adesão na **carteira**, use alertas e a lista «agir esta semana» para prazos curtos, e o radar de renovações para o fim do acordo. O trabalho diário é no PrepBid; as peças continuam na plataforma electrónica.

Confirme o CCP e as peças. Isto não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Posso concorrer a uma segunda fase sem ter aderido ao acordo-quadro?',
        answer:
          'Em regra não. As segundas fases correm entre os operadores que ficaram no acordo. Sem adesão, o canal está fechado até ao próximo procedimento de adesão.',
      },
      {
        question: 'O PrepBid trata um acordo-quadro como um concurso aberto?',
        answer:
          'Não. O tipo de procedimento vem do corpus público e aparece no radar. A decisão de aderir ou não fica na carteira da empresa, com o prazo da adesão.',
      },
      {
        question: 'Onde vejo os contratos já lançados ao abrigo de um acordo?',
        answer:
          'No PrepBid: ficha da entidade e contratos associados, já alinhados ao perfil. Não monte uma pesquisa à parte para acompanhar o acordo.',
      },
    ],
  },
  {
    slug: 'ajuste-direto-e-concurso-publico',
    title: 'Ajuste direto e concurso público: a diferença na prática',
    description:
      'Quando a entidade pode adjudicar sem concurso aberto e o que muda para quem quer apresentar proposta em Portugal: concurso público, consulta prévia e ajuste direto.',
    lede:
      'No concurso público qualquer interessado pode apresentar proposta. No ajuste direto a entidade convida um ou poucos operadores. No PrepBid o tipo de procedimento aparece no radar, com dados do corpus público.',
    intent: 'informativa',
    tags: ['ajuste-direto', 'concurso-publico', 'ccp'],
    markdown: `## O que distingue os dois?

O tipo de procedimento — publicado no Diário da República e no corpus do Portal BASE — determina se a sua empresa sequer pode concorrer. No **concurso público** (e equivalentes abertos) qualquer operador que cumpra o programa apresenta proposta. No **ajuste direto** a entidade escolhe um operador, sem abertura geral. Entre os dois existe a **consulta prévia**: convite a vários operadores, ainda sem anúncio aberto a todos.

No **PrepBid** esse campo vem no radar e na ficha — é aí que se vê se ainda está a tempo.

## Porque a entidade escolhe um tipo e não outro?

O Código dos Contratos Públicos fixa limiares de valor e regras de fundamentação. De forma simplificada, usada no dia a dia das mesas:

- **Concurso público:** qualquer operador que cumpra os requisitos. O anúncio é o convite; há prazo, peças e critérios publicados.
- **Consulta prévia:** só os convidados (em regra, pelo menos três). Se não foi convidado, não concorre a este procedimento.
- **Ajuste direto:** o operador escolhido pela entidade. Não há fase pública de propostas; o contrato aparece depois no corpus do BASE, com valor e fundamentação.

Há exceções (urgência, exclusividade técnica, contratos de muito baixo valor, acordos-quadro). A fundamentação do ajuste direto lê-se na ficha do contrato no PrepBid.

## O que muda na proposta?

- **Concurso público:** programa e caderno de encargos. Habilitação, caução, critérios e prazo estão nas peças. Uma falha formal exclui mesmo com bom preço.
- **Consulta prévia / ajuste direto:** o convite substitui o anúncio aberto. Os documentos pedem-se na mesma; o calendário é mais curto.

## Como usar o histórico para não chegar tarde?

Se uma câmara faz ajuste direto repetido no mesmo CPV, o próximo procedimento aberto vai provavelmente ao mesmo objeto. No PrepBid, o **radar de renovações** estima **quando** o contrato em curso acaba, para contactar a entidade **antes** de o anúncio sair. «Agir esta semana» é a lista do PrepBid, com prazo e renovação.

Confirme o CCP em vigor e o anúncio concreto. Isto explica a lógica; não substitui o jurista da proposta.`,
    faq: [
      {
        question: 'Posso concorrer a um ajuste direto sem convite?',
        answer: 'Não. Só o operador convidado apresenta proposta. O contrato aparece depois no corpus do Portal BASE, já adjudicado.',
      },
      {
        question: 'Qual é a diferença entre consulta prévia e concurso público?',
        answer:
          'No concurso público qualquer interessado que cumpra o programa pode propor. Na consulta prévia só os operadores convidados (em regra três ou mais) apresentam proposta.',
      },
      {
        question: 'Onde vejo o tipo de procedimento?',
        answer:
          'No PrepBid, na ficha do concurso e no radar. É esse campo que diz se ainda está a tempo de concorrer.',
      },
    ],
  },
  {
    slug: 'ajuste-direto-fundamentacao-no-base',
    title: 'Ajuste direto: como ler a fundamentação no histórico público',
    description:
      'A fundamentação dos contratos de ajuste direto explica porque a entidade não abriu concurso. No PrepBid lê-se na ficha do contrato e da entidade, a partir do corpus do Portal BASE.',
    lede:
      'A fundamentação do ajuste direto é a justificação publicada pela entidade. No PrepBid lê-se na ficha do contrato e da entidade, para o padrão do comprador.',
    intent: 'informativa',
    tags: ['ajuste-direto', 'entidades', 'historico'],
    markdown: `## O que é a fundamentação no ajuste direto?

Quando a entidade adjudica por **ajuste direto**, publica uma fundamentação (critério legal, urgência, exclusividade, valor, etc.). Esse texto não é marketing: é o rasto público de *porque* não abriu concurso. Vive no corpus do Portal BASE; no **PrepBid** aparece na ficha do contrato e no histórico da entidade.

## Porque interessa a quem concorre?

O padrão do comprador antecipa o próximo procedimento. Se a mesma câmara justifica sempre «urgência» no mesmo CPV, o próximo aberto — quando o valor ou a regra o obrigar — vai ao mesmo objeto. Isso alimenta o **radar de renovações** e a conversa comercial *antes* do anúncio.

Não use a fundamentação para acusar a entidade. Use-a para decidir se vale a pena estar presente quando o canal abrir.

## Como ler sem overclaim?

- Distinga fundamento legal (artigo do CCP) de narrativa operacional («só este fornecedor conhece o sistema»).
- Compare valores e prazos de execução com contratos semelhantes da mesma entidade.
- Uma amostra de um contrato não é um padrão; três ou quatro no mesmo CPV já são um sinal.

O PrepBid agrega o histórico da entidade. O sítio onde se lê o padrão e se marca a carteira é o PrepBid.

## O que fazer com o padrão?

Marque a entidade, ajuste o perfil (CPV, distritos) e deixe o radar avisar a janela de contacto. «Agir esta semana» é a lista do PrepBid com prazo e renovação.

Confirme o CCP e o contrato concreto. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'A fundamentação do ajuste direto está no Diário da República?',
        answer:
          'Em regra está no contrato. No PrepBid lê-se na ficha do contrato, ao lado de CPV, valor e prazos.',
      },
      {
        question: 'Posso usar a fundamentação para impugnar o contrato?',
        answer:
          'Este guia não é aconselhamento jurídico. A fundamentação ajuda a ler o padrão do comprador; qualquer impugnação é com o seu jurista e prazos próprios.',
      },
      {
        question: 'Como o PrepBid usa este campo?',
        answer:
          'Mostra-o no contexto da entidade e do contrato, ao lado de CPV, valor e prazos, para decidir go/no-go e contacto de renovação.',
      },
    ],
  },
  {
    slug: 'alvara-de-construcao-e-concursos-publicos',
    title: 'Alvará de construção: o filtro que mata a empreitada antes do caderno',
    description:
      'Classe e categorias do alvará de construção condicionam a habilitação em empreitadas públicas. No PrepBid o perfil corta concursos incompatíveis antes de gastar o mapa de quantidades.',
    lede:
      'Sem a classe e as categorias de alvará pedidas no programa, a proposta de empreitada corre risco de exclusão. No PrepBid esse corte começa no perfil.',
    intent: 'informativa',
    tags: ['alvara', 'habilitacao', 'empreitadas'],
    markdown: `## Porque o alvará decide o go/no-go?

Em empreitadas, o **alvará** (classe e categorias) é o primeiro filtro de habilitação. Se o programa pede classe 4 e a empresa tem classe 2, o concurso deixou de ser relevante, por muito que o título e o CPV batam certo. Orçamentar esse caderno é tempo perdido.

## O que olhar no anúncio e nas peças?

- Classe e categorias exigidas no programa do concurso.
- Possibilidade (ou não) de agrupamentos / subempreitada para completar categorias.
- Valor do contrato face à classe: um teto de alvará abaixo do preço base é um não, salvo regra expressa nas peças.

O anúncio no DR e as peças na plataforma trazem o requisito. O **PrepBid** já cortou geografia, CPV e valor no perfil; a leitura do alvará confirma o go.

## Como filtrar oportunidades com o alvará em mente?

Registe no perfil os distritos e o intervalo de valor alinhados com a classe. A lista «agir esta semana» deve ser só o que a empresa consegue habilitar. Marque na **carteira** os «sim» e ignore o resto.

## Que erros são frequentes?

Tratar o alvará como detalhe da pasta, não como filtro. Confiar só no título «reabilitação». Assumir que a subempreitada tapa qualquer categoria sem ler o programa.

Confirme o CCP, o alvará em vigor e as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'O alvará substitui o CPV no filtro?',
        answer:
          'Não. CPV diz o objeto; o alvará diz se pode executar empreitadas daquela classe e categorias. No PrepBid os dois entram no perfil e na decisão go/no-go.',
      },
      {
        question: 'Posso concorrer acima da minha classe com um agrupamento?',
        answer:
          'Só se as peças e o regime do alvará o permitirem. Confirme o programa; não assume. Este guia não substitui o jurista da proposta.',
      },
      {
        question: 'O PrepBid valida o meu alvará automaticamente?',
        answer:
          'O perfil e a triagem cruzam geografia, CPV e valor. A classe e as categorias confirmam-se na leitura do programa, na carteira.',
      },
    ],
  },
  {
    slug: 'caderno-de-encargos-o-que-ler-primeiro',
    title: 'Caderno de encargos: o que ler primeiro para não perder o prazo',
    description:
      'Ordem prática para ler o caderno de encargos sem perder o prazo: objeto, habilitação, critérios, prazos e caução — depois de o PrepBid já ter filtrado o concurso no radar.',
    lede:
      'Comece pelo objeto, habilitação, critérios e prazos; só depois aprofunde mapa de quantidades e memória descritiva. No PrepBid essa leitura só começa nos concursos que o perfil e o radar já deixaram passar.',
    intent: 'informativa',
    tags: ['caderno-de-encargos', 'prazos', 'habilitacao'],
    markdown: `## Porque não começar na página 1?

O caderno não está escrito pela ordem da decisão comercial. A página 1 raramente mata o concurso; a habilitação, o critério e o prazo sim. Ler tudo «desde o início» em cada anúncio nacional é o erro que o **PrepBid** evita: o perfil e o radar já cortaram CPV, distrito, valor e prazo. Só então se abre o PDF.

## Que secções ler primeiro?

1. Objeto e lotes — é mesmo a sua atividade?
2. Habilitação (alvará, ISO, volume de negócios, DEUCP).
3. Critérios de adjudicação e pesos.
4. Prazos de propostas, esclarecimentos e visitas.
5. Caução e modo de apresentação na plataforma.

Só depois: mapa de quantidades, memória descritiva, desenhos.

## O que costuma matar a proposta cedo?

Classe de alvará em falta, certificação fora de âmbito, prazo na plataforma já impossível, caução que a tesouraria não emite a tempo. Isto vê-se em 20–40 minutos se a triagem no PrepBid estiver feita.

## Como documentar a leitura na carteira?

Passe o concurso da lista «agir esta semana» para a **carteira** com uma linha go / condicional / no-go. O digest de segunda e os lembretes (Pro) só servem se a linha existir. Essa pasta é a carteira do PrepBid.

Confirme sempre as peças concretas. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Devo ler o caderno de todos os anúncios do dia?',
        answer:
          'Não. No PrepBid o perfil e o radar deixam uma lista curta. O caderno lê-se só nos que passaram CPV, geografia, valor e prazo.',
      },
      {
        question: 'Onde estão as peças do concurso?',
        answer:
          'Na plataforma eletrónica indicada no anúncio (Vortal, acinGov e outras). No PrepBid a ficha aponta o canal; a entrega é sempre na plataforma.',
      },
      {
        question: 'A análise de IA do PrepBid substitui esta leitura?',
        answer:
          'Não. A ficha go/no-go (Pro) resume critérios e red flags a partir das peças, mas a proposta continua a ser da empresa.',
      },
    ],
  },
  {
    slug: 'caucao-e-garantias-em-concursos-publicos',
    title: 'Caução e garantias em concursos públicos: o que verificar já',
    description:
      'Caução provisória e garantia de boa execução: montante, forma e prazo nas peças. No PrepBid entre na decisão go/no-go da carteira antes de pedir o documento à banca.',
    lede:
      'A caução e as garantias são condições de habilitação ou de contrato: confirme montante, forma e prazo nas peças antes de fechar o preço. No PrepBid isso entra no go/no-go da carteira.',
    intent: 'informativa',
    tags: ['caucao', 'habilitacao', 'prazos'],
    markdown: `## Caução e garantia — são a mesma coisa?

Não. A **caução provisória** (quando exigida) garante a proposta até à adjudicação. A **garantia de boa execução** garante o contrato depois. Formas típicas: depósito, garantia bancária, seguro-caução. O que vale é o que as peças pedem.

## O que ler primeiro nas peças?

Montante (percentagem ou valor), forma aceite, prazo de apresentação e se a falta é causa de exclusão ou de não celebração. Cruze com o prazo da proposta: um documento pedido na sexta para entregar segunda é um no-go operacional.

## Como planear com a tesouraria?

Peça o documento **depois** do go na **carteira** do PrepBid, não para todos os anúncios do radar. O perfil já cortou valor e prazo; a caução confirma se a tesouraria aguenta esta semana.

## Como a caução entra na decisão de concorrer?

Uma caução pesada num concurso de margem curta é um não comercial, mesmo com CPV certo. O sítio da decisão é o PrepBid, com as peças da plataforma.

Confirme CCP e peças. Não é aconselhamento jurídico nem financeiro.`,
    faq: [
      {
        question: 'Sem caução a proposta é excluída?',
        answer:
          'Se as peças a exigirem como condição, sim ou o contrato não se celebra. Leia o programa; não generalize a partir de outro concurso.',
      },
      {
        question: 'Quando peço a garantia à banca?',
        answer:
          'Depois do go na carteira do PrepBid, com margem para o prazo da plataforma. Não para todos os anúncios que passaram no radar.',
      },
      {
        question: 'O histórico público diz o valor da caução?',
        answer:
          'Raramente de forma fiável. O valor está nas peças do procedimento concreto. As regras desta proposta estão no caderno.',
      },
    ],
  },
  {
    slug: 'como-analisar-um-concorrente-no-portal-base',
    title: 'Como analisar um concorrente com o histórico público de adjudicações',
    description:
      'Estudar adjudicatários por CPV, valores e entidades no corpus do Portal BASE. No PrepBid isso está no módulo de concorrentes — sem dados privados.',
    lede:
      'O histórico público de adjudicações mostra onde o concorrente ganha, a que valores e com que entidades. No PrepBid essa leitura está no módulo de concorrentes, sobre o corpus do Portal BASE.',
    intent: 'comercial',
    tags: ['concorrentes', 'historico', 'cpv'],
    markdown: `## O que pode (e não pode) ver?

Pode ver o que já é público: adjudicatário (NIF), entidade, CPV, valores, datas, tipo de procedimento. Não vê custos internos, margens nem a proposta perdedora. O **PrepBid** consolida concorrentes por NIF a partir do corpus do Portal BASE; não inventa dados privados.

## Qual é o método prático?

1. Identifique o NIF (o nome comercial muda; o NIF não).
2. Veja CPV e distritos onde concentra quota.
3. Compare valores adjudicados com preços base quando existirem.
4. Liste as entidades onde é incumbente — são janelas de renovação.
5. Decida se ataca, evita ou acompanha.

Isto faz-se na ficha de concorrente do PrepBid.

## Como usar isto na decisão go/no-go?

Se o incumbente ganha sempre no mesmo hospital com desconto de 20 %, um preço «a meio» sem qualidade ponderada é um não. Se o incumbente está concentrado e o contrato acaba em quatro meses, o **radar de renovações** é o momento de contacto — na lista do PrepBid.

## Quais são as limitações?

Erros de CPV, agrupamentos e nomes mal normalizados partem o padrão. Amostra curta não é tendência. Confirme as peças do concurso concreto.

Conta grátis, sem cartão. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Onde analiso um concorrente no dia a dia?',
        answer:
          'No PrepBid, no módulo de concorrentes: NIF, quota e entidades já consolidados. Não monte uma pesquisa à parte.',
      },
      {
        question: 'O PrepBid mostra propostas perdedoras?',
        answer:
          'Não. Só o que o corpus público tornou visível: contratos adjudicados e anúncios. Não há dados privados de outras empresas.',
      },
      {
        question: 'Como ligo isto às renovações?',
        answer:
          'Onde o concorrente é incumbente, o radar estima o fim do contrato e a janela de contacto. Marque a entidade e acompanhe na carteira.',
      },
    ],
  },
  {
    slug: 'como-montar-uma-equipa-de-concursos',
    title: 'Como montar uma equipa de concursos públicos numa PME',
    description:
      'Papéis mínimos numa equipa de propostas: triagem no PrepBid, habilitação, preço e submissão na plataforma — mesmo com duas ou três pessoas.',
    lede:
      'Separe triagem, pasta de habilitação, orçamentação e submissão: um único «faz tudo» no prazo é a receita de exclusão formal. No PrepBid a triagem é o radar, o perfil e a carteira.',
    intent: 'comercial',
    tags: ['equipa', 'carteira', 'prazos'],
    markdown: `## Quais são os papéis mínimos (mesmo com 2–3 pessoas)?

- **Triagem:** perfil + radar + «agir esta semana» no **PrepBid**. Quem decide o go não é quem está a preencher a DEUCP à última hora.
- **Habilitação:** pasta permanente (certidões, alvará, ISO) alinhada com o que as peças pedem.
- **Preço / memória:** mapa de quantidades e texto técnico.
- **Submissão:** plataforma eletrónica (Vortal, acinGov, etc.), assinatura e recibo.

A mesa da semana é o PrepBid e a **carteira**.

## Que ritual semanal funciona?

Segunda: digest e lista «agir esta semana». Terça–quarta: cadernos dos «sim». Quinta: esclarecimentos e caução. Sexta: buffer da plataforma. Os lembretes Pro (7 e 2 dias) só ajudam se a linha estiver na carteira.

## Que ferramentas importam de facto?

Um perfil com CPV, distritos e valor; um radar que não mistura limpezas com empreitadas; uma carteira partilhada. Folhas soltas e uma lista nacional sem perfil não são um processo.

## Quais são os sinais de equipa subdimensionada?

Propostas submetidas a minutos do prazo, exclusões formais repetidas, zero tempo para renovações. Aí o problema não é «mais anúncios»; é menos ruído no perfil.

Conta grátis, sem cartão, sem reunião comercial. Teste Pro 7 dias nos planos.`,
    faq: [
      {
        question: 'Uma pessoa chega para concursos numa PME?',
        answer:
          'Chega para a triagem no PrepBid se o perfil estiver certo. Habilitação e preço no mesmo dia do prazo é o padrão que exclui. Separe no tempo, mesmo que seja a mesma pessoa.',
      },
      {
        question: 'A carteira substitui a pasta de habilitação?',
        answer:
          'Não. A carteira é o estado comercial (Nova → Em preparação → Submetida). A pasta de habilitação é o dossier documental da proposta.',
      },
      {
        question: 'Onde a equipa deve olhar de manhã?',
        answer:
          'Para o ecrã Hoje do PrepBid («agir esta semana»).'
      },
    ],
  },
  {
    slug: 'como-prever-o-valor-de-adjudicacao',
    title: 'Como prever o valor de adjudicação de um concurso público',
    description:
      'O preço base raramente é o valor adjudicado. No PrepBid o intervalo sai do histórico do mesmo CPV no corpus do Portal BASE, sem fingir uma percentagem de confiança de modelo.',
    lede:
      'O valor adjudicado costuma ficar abaixo do preço base; no PrepBid estima-se com rácios de concursos comparáveis do corpus público.',
    intent: 'comercial',
    tags: ['preco', 'historico', 'adjudicacao'],
    markdown: `## Porque o preço base engana?

O preço base é o teto do procedimento, não o preço de mercado. Em empreitadas e fornecimentos com concorrência real, o desconto de 10–30 % é comum; em procedimentos pouco concorridos, o adjudicado cola-se ao base. Sem o histórico daquele CPV e daquela entidade, qualquer número é palpite.

## Qual é o método?

A forma honesta é olhar para concursos comparáveis já publicados no corpus do Portal BASE — mesmo CPV, de preferência a mesma entidade — e ver o rácio adjudicado / preço base. No PrepBid (plano Business) essa estimativa aparece na ficha.

1. Recolhe contratos comparáveis dos últimos 24 meses no mesmo CPV, alargando 8→4→2 dígitos só se a amostra for curta.
2. Prefere o rácio *adjudicado / preço base histórico* quando o anúncio original ainda está no corpus; senão, escala o adjudicado contra o preço base atual, deitando fora rácios absurdos (fora de cerca de 0,2–1,15).
3. Se existirem pelo menos 5 contratos da mesma entidade, usa essa subamostra; caso contrário, usa o CPV.
4. Com menos de 5 pontos, **não mostra intervalo**.
5. A confiança é alta / média / baixa em função da amostra e da dispersão, não um score de um modelo treinado.

O PrepBid não apresenta uma «percentagem de confiança» de machine learning.

## O que isto não é?

Não é o preço a escrever na proposta. Não substitui o mapa de quantidades. Não usa dados privados: só o que o BASE já tornou público.

## Como usar o intervalo na decisão go / no-go?

Se o intervalo histórico fecha 18–24 % abaixo do base e a sua estrutura de custos só aguenta 8 %, o concurso pode ser relevante em CPV e mesmo assim um não comercial. Filtrar cedo, na ficha do PrepBid, antes de gastar a semana no caderno.

Estimativa estatística com dados públicos. Confirme as peças e a sua conta de custos. Não é aconselhamento financeiro nem jurídico.`,
    faq: [
      {
        question: 'Isto substitui a proposta?',
        answer: 'Não. É uma estimativa estatística com dados públicos do corpus do Portal BASE.',
      },
      {
        question: 'Porque o preço base do concurso não chega?',
        answer:
          'O preço base é o teto do procedimento. O valor adjudicado costuma ficar abaixo; o intervalo lê-se no histórico do mesmo CPV, de preferência da mesma entidade.',
      },
      {
        question: 'Quando é que não há previsão?',
        answer:
          'Quando há menos de cinco contratos comparáveis depois de alargar o CPV. Nesse caso o PrepBid não inventa um intervalo.',
      },
    ],
  },
  {
    slug: 'como-saber-quais-concursos-sao-relevantes',
    title: 'Como saber quais concursos públicos são relevantes para a sua empresa',
    description:
      'No PrepBid, filtrar concursos relevantes com CPV, distritos, valor e o histórico que se repete — no perfil e no radar.',
    lede:
      'Um concurso é relevante quando coincide com o que faz, onde executa, o valor em que consegue habilitar-se — e quando ainda há prazo. No PrepBid isso fica no perfil e no radar.',
    intent: 'comercial',
    tags: ['radar', 'perfil', 'cpv'],
    markdown: `## Porque as palavras no título não bastam?

Palavras como «obras» ou «serviços» misturam objectos diferentes. O **CPV**, o **distrito**, o **preço base** e o **histórico da entidade** filtram melhor do que texto livre. No **PrepBid** esses cortes ficam no perfil da empresa e aplicam-se ao radar. Isto aplica-se a empreitadas, energia e saúde, não a um dump nacional de limpezas e papelaria.

## Como começar pelo CPV?

O Vocabulário Comum para Contratos Públicos (CPV) é o código de oito dígitos do objeto. Uma reabilitação de cobertura e um fornecimento de lâmpadas podem ter títulos parecidos e CPV diferentes.

- Guarde os códigos em que já foi adjudicatário (estão nos contratos públicos, no seu NIF).
- Acrescente a divisão (2 dígitos) e a classe (4 dígitos) da atividade principal — muita entidade classifica mal o código de 8 dígitos.
- Não use só a palavra «construção»: especialidades, reabilitação municipal e espaços verdes misturam-se no texto e não na carteira.

## Como cortar geografia e valor antes de ler o caderno?

Uma construtora de classe média no Centro não precisa da lista nacional completa. Distritos onde tem alvará e logística, mais um intervalo de valor alinhado com a classe, eliminam o ruído **antes** de ler peças. No PrepBid isto fica no perfil e aplica-se às listas sem esperar por uma análise de IA.

## Porque olhar para o que se repete, não só para o que abriu hoje?

Grande parte do negócio público é o mesmo objeto, a mesma entidade, daqui a um, dois ou três anos. O contrato em curso tem data de assinatura e prazo de execução no corpus do BASE; a janela de contacto útil é cerca de quatro meses antes do fim estimado. Quando o anúncio sai no DR, o incumbente já está a trabalhar a proposta. O **radar de renovações** do PrepBid existe para isso.

## Quando a habilitação mata o concurso?

Alvará, ISO, certidões, volume de negócios mínimo: se o caderno pede classe 4 e a empresa tem classe 2, deixou de ser relevante. Filtrar não substitui ler as peças.

O ecrã útil é «agir esta semana» — prazo a menos de 30 dias, e as linhas da carteira já em preparação. Conta grátis, sem cartão e sem reunião comercial.`,
    faq: [
      {
        question: 'Como filtrar concursos públicos relevantes em Portugal?',
        answer:
          'No PrepBid: CPV da atividade, distritos e intervalo de valor no perfil, cruzados com o histórico da entidade. Palavras no título não bastam.',
      },
      {
        question: 'Onde filtro concursos relevantes no dia a dia?',
        answer:
          'No perfil e no radar do PrepBid: CPV, distritos, valor e histórico da entidade. Não num inbox nacional sem perfil.',
      },
      {
        question: 'Quando um concurso deixa de ser relevante?',
        answer:
          'Quando o prazo já passou, quando a habilitação não chega, ou quando o valor está fora do que a empresa consegue executar.',
      },
    ],
  },
  {
    slug: 'concursos-publicos-de-empreitadas-guia-pratico',
    title: 'Concursos públicos de empreitadas: do filtro no PrepBid ao go/no-go',
    description:
      'Empreitadas de obras públicas em Portugal: alvará, mapa de quantidades e critérios. No PrepBid filtre CPV, distrito e valor no perfil antes de abrir o caderno.',
    lede:
      'Em empreitadas, filtre primeiro por alvará, CPV e distrito no perfil do PrepBid; só depois invista no mapa de quantidades. A lista de trabalho da manhã é o radar do PrepBid.',
    intent: 'comercial',
    tags: ['empreitadas', 'alvara', 'radar'],
    markdown: `## Por onde começar numa empreitada pública?

Pelo que exclui: classe e categorias de **alvará**, **CPV** de especialidade vs. empreitada geral, **distrito** onde consegue supervisionar, e **valor** alinhado com a classe. No **PrepBid** isto é o perfil. Só o que passa vai a «agir esta semana».

## Que sinais ler no histórico público?

Quem ganha naquela câmara, a que rácio sobre o preço base, se há ajuste direto repetido no mesmo objeto, quando acaba o contrato em curso. Esses dados vêm do corpus do Portal BASE e aparecem nas fichas de entidade e concorrente do PrepBid.

## Quais são os riscos específicos de empreitadas?

Mapa de quantidades incompleto, critérios de qualidade mal evidenciados, visitas ao local que o prazo já não permite, caução pesada. A ficha de IA (Pro) ajuda a listar red flags; não substitui o orçamentista.

## Como fazer um go/no-go em 30 minutos?

Radar → ficha (tipo de procedimento, prazo, valor) → três páginas do programa (habilitação, critério, caução) → linha na **carteira**. Se for no-go, pare. Se for go, aí sim o mapa de quantidades.

Conta grátis, sem cartão. Teste Pro 7 dias nos planos.`,
    faq: [
      {
        question: 'O PrepBid substitui o mapa de quantidades?',
        answer:
          'Não. Filtra e prioriza. O preço da empreitada continua a sair do mapa, da memória descritiva e da sua estrutura de custos.',
      },
      {
        question: 'Devo olhar para todas as empreitadas publicadas no país?',
        answer:
          'Não. A sua lista é o radar do PrepBid com o perfil da empresa (CPV, distritos, valor, alvará na triagem).',
      },
      {
        question: 'Quando contacto a câmara numa renovação de obras?',
        answer:
          'Na janela estimada pelo radar de renovações (cerca de quatro meses antes do fim do contrato em curso), não no dia do anúncio no DR.',
      },
    ],
  },
  {
    slug: 'concursos-publicos-energia-e-eficiencia',
    title: 'Concursos públicos de energia e eficiência: o que filtrar no PrepBid',
    description:
      'Fotovoltaico, eficiência energética, iluminação e manutenção: CPV, critérios e histórico no radar do PrepBid, com o Portal BASE só como corpus público.',
    lede:
      'Em energia e eficiência, o CPV certo e o histórico da entidade importam tanto quanto o título do anúncio. No PrepBid isso fica no perfil e no radar, antes de orçamentar.',
    intent: 'comercial',
    tags: ['energia', 'cpv', 'radar'],
    markdown: `## Que objetos entram neste radar?

Fotovoltaico, eficiência em edifícios, iluminação pública, manutenção de AVAC, gestão de energia. Títulos como «fornecimento e instalação» misturam objectos; o **CPV** no perfil do **PrepBid** separa-os. O filtro do dia é o radar do PrepBid.

## O que verificar além do preço?

Critérios de qualidade (garantias, produção estimada, manutenção), certificações, prazos de execução e se há financiamento (ex. PRR) que aperta o calendário sem aliviar o CCP. A ficha go/no-go (Pro) lê as peças; o perfil já cortou distrito e valor.

## O que aprender no histórico da entidade?

Quem é o incumbente da manutenção, a que valores fechou o último fotovoltaico, se a câmara compra por acordo-quadro. Esses contratos estão no corpus do BASE e nas fichas do PrepBid.

## Como decidir o go/no-go rápido?

CPV + distrito + valor no perfil → prazo em «agir esta semana» → habilitação e critério no programa → carteira. Não comece pelo PDF de 200 páginas de um anúncio que o perfil já deveria ter excluído.

Conta grátis, sem cartão. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Como filtro concursos de energia sem ler todos os títulos?',
        answer:
          'Com CPV da atividade no perfil do PrepBid, mais distritos e intervalo de valor. O radar aplica o corte ao corpus público.',
      },
      {
        question: 'O PRR muda as regras de habilitação?',
        answer:
          'O financiamento não elimina o CCP. Leia peças e prazos. O PrepBid trata o anúncio como qualquer outro procedimento, com o perfil por cima.',
      },
      {
        question: 'Onde vejo o incumbente da manutenção?',
        answer:
          'No histórico da entidade no PrepBid, na ficha — não numa ronda avulsa todas as manhãs.',
      },
    ],
  },
  {
    slug: 'concursos-publicos-para-pme-por-onde-comecar',
    title: 'Concursos públicos para PME: por onde começar no PrepBid',
    description:
      'PME que entram em contratação pública em Portugal: primeiros filtros no perfil do PrepBid (CPV, geografia, valor), habilitação e erros a evitar.',
    lede:
      'Comece por poucos CPV, distritos onde executa e valores compatíveis com a habilitação, no perfil do PrepBid — não por uma lista nacional sem recorte.',
    intent: 'comercial',
    tags: ['pme', 'perfil', 'radar'],
    markdown: `## Qual é o erro clássico da primeira PME?

Abrir a pesquisa nacional e tentar «não perder nada». Isso mistura objectos, distritos e valores que a empresa não executa. O **PrepBid** existe para o contrário: um **perfil** estreito e um radar útil. O inbox da manhã é «agir esta semana».

## Que habilitação mínima pôr em ordem?

Alvará (se obras), certidões, DEUCP / declarações, eventualmente ISO. Sem pasta permanente, o primeiro prazo da plataforma exclui. A triagem no PrepBid não substitui a pasta; evita gastar a pasta em concursos errados.

## Onde estão as oportunidades à escala?

Valores alinhados com a capacidade, lotes, consultas em que já é conhecido, renovações de contratos pequenos que se repetem. O radar de renovações e a carteira são o sítio. Concursos europeus (TED) no PrepBid (Pro) são outro canal, não o primeiro passo.

## Preciso de um consultor eternamente?

Não. Precisa de um processo: perfil, lista «agir esta semana», carteira, submissão na plataforma. Conta grátis, sem cartão e sem reunião comercial. O teste Pro de 7 dias activa-se nos planos.

Confirme CCP e peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Por onde começa uma PME em concursos públicos?',
        answer:
          'Pelo perfil no PrepBid (CPV, distritos, valor) e pela pasta de habilitação.'
      },
      {
        question: 'O plano grátis chega para começar?',
        answer:
          'Sim para ver concursos da área, mapa e carteira. Score/fit, TED e análise de IA entram no Pro; rascunho de proposta e previsão de fecho no Business.',
      },
      {
        question: 'Devo candidatar-me a tudo para «entrar no sistema»?',
        answer:
          'Não. Propostas fracas e exclusões formais não criam histórico útil. Poucos gos bem feitos batem dezenas de no-gos caros.',
      },
    ],
  },
  {
    slug: 'concursos-publicos-saude-e-dispositivos-medicos',
    title: 'Concursos públicos de saúde e dispositivos médicos: o filtro certo',
    description:
      'Hospitais, ARS e entidades de saúde: filtrar dispositivos médicos, consumíveis e manutenção no perfil do PrepBid, sem se perder em anúncios genéricos do corpus público.',
    lede:
      'Em saúde, CPV, lotes e requisitos regulatórios definem se o concurso é para si — o título «fornecimento hospitalar» não chega. No PrepBid isso corta-se no perfil e no radar.',
    intent: 'comercial',
    tags: ['saude', 'cpv', 'lotes'],
    markdown: `## Porque a saúde pública é um mundo à parte?

Lotes, catálogos, requisitos de marcado CE / infarmed, prazos de entrega e acordos-quadro da SPMS ou de centrais de compras. Um título genérico esconde um lote que não é o seu produto. O **CPV** e a leitura dos lotes no **PrepBid** (depois do perfil) evitam orçamentar o concurso errado.

## O que ler primeiro?

Objeto e lotes, requisitos regulatórios, critério (preço vs. qualidade), prazo e se é adesão a acordo-quadro. A habilitação documental aqui exclui tanto como nas obras.

## Que sinais há no histórico da entidade?

Quem é o incumbente daquele dispositivo, a que preço, se o hospital compra por AQ ou por concurso aberto. Na ficha da entidade no PrepBid, a partir do histórico público — não numa ronda manual à parte.

## Que erros evitar?

Filtrar só por «saúde» no texto. Ignorar lotes. Chegar ao anúncio sem olhar a renovação do contrato em curso. O radar de renovações existe para o consumo contínuo do SNS.

Conta grátis, sem cartão. Não é aconselhamento jurídico nem regulatório.`,
    faq: [
      {
        question: 'Como filtro dispositivos médicos sem ler todos os anúncios de saúde?',
        answer:
          'CPV específicos no perfil do PrepBid, mais entidades e valor. O radar aplica o corte; os lotes confirmam-se nas peças dos «sim».',
      },
      {
        question: 'Os acordos-quadro de saúde substituem o concurso aberto?',
        answer:
          'Quando a entidade compra ao abrigo do AQ, a segunda fase é entre aderentes. Sem adesão, esse canal está fechado. O tipo de procedimento vê-se no radar.',
      },
      {
        question: 'O PrepBid valida o marcado CE?',
        answer:
          'Não. Mostra o concurso e ajuda na triagem. A conformidade do produto é da empresa e das peças.',
      },
    ],
  },
  {
    slug: 'consulta-previa-como-funciona',
    title: 'Consulta prévia: quem pode propor e o que fazer sem convite',
    description:
      'Na consulta prévia só os operadores convidados apresentam proposta. No PrepBid o tipo de procedimento aparece no radar; o histórico da entidade mostra quando o canal costuma abrir.',
    lede:
      'Na consulta prévia a entidade convida um conjunto de operadores; sem convite, em regra não há proposta neste procedimento. No PrepBid vê o tipo no radar e prepara o próximo convite pelo histórico da entidade.',
    intent: 'informativa',
    tags: ['consulta-previa', 'ccp', 'entidades'],
    markdown: `## O que é a consulta prévia?

É um procedimento em que a entidade **convida** operadores (em regra três ou mais) a apresentar proposta, sem anúncio aberto a todos. Não é concurso público nem ajuste direto. O convite e as peças correm na plataforma eletrónica indicada.

No **PrepBid** o tipo aparece no radar: se não foi convidado, este anúncio não é um go — é inteligência sobre o comprador.

## Quem pode apresentar proposta?

Só os convidados, salvo regra especial nas peças. Ver a consulta no radar sem convite não cria direito a propor. Serve para marcar a entidade e o CPV no perfil.

## O que muda na prática da proposta?

Calendário mais curto, relação com a entidade mais pesada, os mesmos riscos formais (DEUCP, caução, formato). Trate a pasta como num concurso aberto, com menos dias.

## Como preparar a empresa para ser convidada?

Histórico no mesmo objeto, execução irrepreensível, presença comercial **antes** do convite. O radar de renovações e a ficha da entidade no PrepBid mostram o padrão de consultas e ajustes. O plano de contacto é no PrepBid.

Confirme o CCP e o convite concreto. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Posso apresentar proposta numa consulta prévia sem convite?',
        answer:
          'Em regra não. Só os operadores convidados. O anúncio no radar serve para ler o comprador, não para submeter.',
      },
      {
        question: 'Como sei que um procedimento é consulta prévia?',
        answer:
          'No PrepBid esse campo vem na ficha do concurso, no radar.'
      },
      {
        question: 'O que faço se a entidade só usa consulta prévia no meu CPV?',
        answer:
          'Trabalhe a relação e as referências antes do convite. O histórico da entidade no PrepBid mostra o ritmo; a carteira guarda o follow-up.',
      },
    ],
  },
  {
    slug: 'criterios-de-adjudicacao-preco-e-qualidade',
    title: 'Critérios de adjudicação: preço só ou qualidade com pesos?',
    description:
      'Preço mais baixo ou proposta economicamente mais vantajosa: como ler pesos e fatores de qualidade. No PrepBid a ficha do concurso e a análise de IA destacam o critério antes da carteira.',
    lede:
      'O critério de adjudicação define se ganha só quem for mais barato ou quem equilibrar preço e qualidade conforme os pesos do programa. No PrepBid lê-se na ficha, não à sorte no título do anúncio.',
    intent: 'informativa',
    tags: ['criterios', 'preco', 'proposta'],
    markdown: `## Quais são os critérios mais comuns?

**Preço mais baixo** e **proposta economicamente mais vantajosa** (preço + fatores de qualidade com pesos). Há variantes e fórmulas nas peças. O que manda é o programa do concurso, não o hábito da empresa.

## O que verificar nos fatores de qualidade?

O que é pontuável, o que é requisito mínimo, prazos de evidência e se a empresa consegue documentos (ISO, equipa, metodologia, prazo de garantia). Um peso de 40 % em qualidade que não consegue evidenciar é um no-go, mesmo com CPV certo.

No **PrepBid**, a análise de IA (Pro) extrai critérios e red flags das peças. A triagem inicial (perfil, prazo, valor) já aconteceu no radar.

## Como decidir a estratégia?

Se o preço vale 90 %, a memória bonita não salva. Se a qualidade vale 40 %, um desconto agressivo pode perder. Use o histórico da entidade (na ficha PrepBid) só como contexto — o critério deste procedimento está nas peças.

## Onde poupar tempo na triagem?

Não leia a memória descritiva antes de saber o critério. «Agir esta semana» no PrepBid é prazo + fit; o critério confirma o go na carteira.

Confirme as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'O preço mais baixo é sempre o critério?',
        answer:
          'Não. Muitos procedimentos ponderam qualidade. O programa do concurso é a fonte; no PrepBid a ficha e a análise de IA destacam o critério.',
      },
      {
        question: 'O histórico de adjudicações revela o critério futuro?',
        answer:
          'Dá um hábito da entidade, não a regra deste anúncio. Leia sempre as peças do procedimento concreto.',
      },
      {
        question: 'Posso ignorar um fator de qualidade com peso baixo?',
        answer:
          'Só depois de fazer as contas. Um fator de 10 % decide empates e perde propostas «quase».',
      },
    ],
  },
  {
    slug: 'diario-da-republica-e-anuncios-de-concursos',
    title: 'Diário da República e anúncios: o marco oficial, o trabalho no PrepBid',
    description:
      'O anúncio no Diário da República dá publicidade oficial ao procedimento. O PrepBid vigia esses anúncios no radar já cortados pelo perfil. As plataformas electrónicas são o canal de peças e de entrega.',
    lede:
      'O anúncio no Diário da República é o marco oficial de muitos procedimentos. No PrepBid os anúncios entram no radar já filtrados pelo perfil; a plataforma electrónica é o canal de peças e de entrega.',
    intent: 'informativa',
    tags: ['diario-da-republica', 'anuncios', 'radar'],
    markdown: `## Qual é o papel do Diário da República?

O **DR** dá publicidade oficial a muitos anúncios de procedimento: objeto, prazos, tipo, plataforma. Não é o sítio onde a empresa gere a semana. É uma **fonte**. O **PrepBid** recolhe anúncios e cruza-os com o perfil (CPV, distritos, valor) no radar.

## Como se articula o anúncio com o radar do PrepBid?

O DR dá publicidade oficial. O PrepBid recolhe o anúncio, aplica o perfil e põe o que interessa no radar e em «agir esta semana». A plataforma electrónica (Vortal, acinGov, etc.) é o canal de peças e de submissão.

## Que campos do anúncio ler de imediato?

Tipo de procedimento, prazo de propostas, CPV, preço base, distrito, plataforma. No PrepBid estes campos já estão na ficha do concurso quando o anúncio entra no radar.

## Como reduzir a dependência de «abrir o DR todos os dias»?

Deixe o radar trabalhar. Segunda-feira o digest (grátis) resume o que entrou na janela. A carteira guarda os gos. Abrir o DR à mão é exceção (peça em falta), não o processo.

Confirme o anúncio concreto. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'O PrepBid substitui o Diário da República?',
        answer:
          'Não. O DR é a fonte oficial do anúncio. O PrepBid organiza esses anúncios no radar, já cortados pelo perfil da empresa.',
      },
      {
        question: 'O PrepBid substitui o Diário da República?',
        answer:
          'Não. O DR é a fonte oficial do anúncio. O PrepBid organiza esses anúncios no radar, já cortados pelo perfil da empresa.',
      },
      {
        question: 'Onde vejo o prazo de propostas?',
        answer:
          'No anúncio e na ficha do concurso no PrepBid. «Agir esta semana» lista prazos a menos de 30 dias.',
      },
    ],
  },
  {
    slug: 'distritos-e-geografia-na-escolha-de-concursos',
    title: 'Distritos e geografia: como o perfil do PrepBid corta concursos inviáveis',
    description:
      'Filtrar concursos por distrito e logística no perfil do PrepBid: evitar propostas em que o deslocamento e a supervisão destroem a margem, sem uma lista nacional sem recorte geográfico.',
    lede:
      'Geografia importa: distritos onde tem equipa, alvará e logística batem títulos nacionais apelativos mas inexecutáveis. No PrepBid esse corte é um campo do perfil, aplicado ao radar.',
    intent: 'comercial',
    tags: ['distritos', 'perfil', 'radar'],
    markdown: `## Porque filtrar por distrito?

Uma empreitada ou uma manutenção a 400 km come margem em deslocação, estaleiro e supervisão. O título pode ser perfeito e o concurso um não. O **perfil** do **PrepBid** corta distritos; o radar deixa de os mostrar como urgentes.

## Como definir a sua área?

Onde tem gente, alvará, fornecedores e histórico de execução. Acrescente um distrito vizinho só se a logística aguentar. Não copie a lista nacional «para não perder nada» — perde tempo.

O mapa por distrito no PrepBid mostra onde está o dinheiro e as renovações, já recortados pelo perfil.

## Como cruzar com o histórico?

Se nunca executou nos Açores e o caderno pede presença local, é no-go. Se a câmara do distrito vizinho já o conhece, a renovação pesa mais. Fichas de entidade e carteira no PrepBid, não uma pesquisa nacional à mão.

## Que erros evitar?

Filtrar só por palavra «Lisboa» no título. Ignorar o local de execução nas peças. Deixar o perfil em branco e queixar-se do ruído.

Conta grátis, sem cartão. Ajuste o perfil e volte ao radar.`,
    faq: [
      {
        question: 'Como filtro concursos por distrito em Portugal?',
        answer:
          'No perfil do PrepBid, com os distritos onde executa. O radar aplica o corte ao corpus de anúncios e contratos.',
      },
      {
        question: 'O PrepBid filtra pelos meus distritos automaticamente?',
        answer:
          'Sim, se os distritos estiverem no perfil. Esse recorte aplica-se ao radar e a «agir esta semana».',
      },
      {
        question: 'E os concursos com vários distritos de execução?',
        answer:
          'Leia as peças. O perfil é um primeiro corte; se a execução inclui um distrito que não aguenta, a carteira leva um no-go.',
      },
    ],
  },
  {
    slug: 'erros-formais-que-excluem-propostas',
    title: 'Erros formais que excluem propostas (mesmo com bom preço)',
    description:
      'Falhas de habilitação, declarações, formatos e prazos: os erros formais mais comuns. No PrepBid a carteira e os lembretes reduzem a corrida da plataforma; as peças continuam a mandar.',
    lede:
      'Um erro formal pode excluir a proposta antes da análise do preço: listas de documentos, assinaturas e formatos não são detalhe. No PrepBid a carteira e os prazos existem para não chegar à plataforma em pânico.',
    intent: 'informativa',
    tags: ['erros-formais', 'habilitacao', 'prazos'],
    markdown: `## O que é um erro formal na prática?

Falta de DEUCP ou declaração, ficheiro no formato errado, assinatura em falta, caução fora do prazo, proposta na plataforma errada ou depois da hora. O júri nem chega ao preço. Isto não se corrige com «mas o valor era bom».

## Como reduzir o risco?

Pasta de habilitação permanente, checklist no dia 1 do go, submissão com margem. No **PrepBid**, passe o concurso à **carteira** assim que for go; os lembretes Pro (7 e 2 dias) avisam. O radar não monta a pasta — evita gastar a pasta em concursos que o perfil já deveria ter morto.

## Porque é que um preço bom não cura formalidade má?

Porque as regras de exclusão são formais. O corpus do Portal BASE está cheio de contratos ganhos por segundo classificado depois de exclusão do primeiro. Leia o programa deste procedimento, não o hábito do último.

A plataforma electrónica entrega a proposta. O PrepBid é a mesa da triagem e dos prazos.

Confirme as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Qual é o erro formal mais comum?',
        answer:
          'Documentos de habilitação em falta ou em formato não pedido, e a submissão fora de hora na plataforma. A pressa no prazo é o contexto típico.',
      },
      {
        question: 'O PrepBid valida a minha DEUCP?',
        answer:
          'Não. Ajuda a não viver todos os concursos em urgência: perfil, radar, carteira e lembretes. A conferência documental é da equipa.',
      },
      {
        question: 'Posso corrigir um erro formal depois do prazo?',
        answer:
          'Só nos termos das peças e do CCP. Não assuma. Fale com o jurista da proposta. Este guia não substitui esse aconselhamento.',
      },
    ],
  },
  {
    slug: 'habilitacao-documental-deu-cp-e-declaracoes',
    title: 'Habilitação documental: DEUCP e declarações sem exclusão formal',
    description:
      'DEUCP, declarações de honra e documentos de habilitação: organize a pasta cedo. No PrepBid filtre o concurso no radar antes de montar o dossier de cada anúncio.',
    lede:
      'A habilitação documental exclui propostas válidas no preço: prepare DEUCP, declarações e certidões no formato e prazo que as peças pedem. No PrepBid a pasta só se monta para os gos da carteira.',
    intent: 'informativa',
    tags: ['habilitacao', 'deu-cp', 'proposta'],
    markdown: `## Porque a pasta de habilitação manda na proposta?

Porque é a primeira porta. Sem os documentos no formato pedido, o preço não é avaliado. A pasta permanente (certidões, alvará, ISO, minutas) reduz o pânico; o programa de cada concurso diz o que muda.

## O que costuma aparecer nas peças?

DEUCP ou declaração de honra, documentos de habilitação jurídica, económica e técnica, comprovativos de alvará ou ISO, caução. A lista é a das peças, não a do concurso anterior.

## Como organizar a equipa?

Triagem no **PrepBid** (perfil + radar + «agir esta semana») → go na **carteira** → pasta. Montar DEUCP para anúncios que o perfil já excluía é o desperdício clássico. Essa fila é o radar e a carteira do PrepBid.

## Que erros clássicos evitar?

Versões caducadas, nomes que não batem com o NIF, PDF ilegível, declaração em vez de DEUCP quando o programa pedia DEUCP (ou o inverso). Filtrar o concurso errado é o erro anterior a todos estes.

Confirme as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'A DEUCP substitui todos os documentos de habilitação?',
        answer:
          'Só nos termos do programa do concurso. Muitas peças pedem DEUCP e, mais tarde, os documentos. Leia o procedimento concreto.',
      },
      {
        question: 'Quando começo a pasta?',
        answer:
          'Tenha uma pasta permanente. A pasta *deste* concurso começa depois do go na carteira do PrepBid, com o prazo da plataforma à vista.',
      },
      {
        question: 'O PrepBid valida a habilitação da minha empresa?',
        answer:
          'A triagem no radar não substitui a pasta. A habilitação desta proposta está nas peças e nos seus documentos.',
      },
    ],
  },
  {
    slug: 'historico-de-adjudicacoes-da-sua-empresa-no-base',
    title: 'Histórico de adjudicações da sua empresa: como usar no PrepBid',
    description:
      'Ler os contratos em que a sua empresa foi adjudicatária (CPV, entidades, valores) no corpus do Portal BASE. No PrepBid o NIF consolida esse histórico para o perfil e a proposta.',
    lede:
      'O histórico público da sua empresa valida CPV, referências e entidades onde já executou. No PrepBid usa-se na triagem, no perfil e na proposta.',
    intent: 'comercial',
    tags: ['historico', 'nif', 'perfil'],
    markdown: `## O que diz o histórico público sobre si?

Contratos adjudicados ao seu **NIF**: objetos (CPV), entidades, valores, datas, distritos. É a narrativa comercial que o mercado já vê. Nomes comerciais mudam; o NIF não. O **PrepBid** consolida-o; o corpus é o Portal BASE.

## Como extrair valor em 20 minutos?

Abra a sua ficha de concorrente/empresa no PrepBid. Anote CPV reais vs. os que tem no perfil (muita gente filtra pelo título e esquece códigos em que já ganhou). Marque entidades incumbentes para o radar de renovações. Tire referências para a memória descritiva — sem inventar o que o contrato não mostra.

## Como usar na proposta?

Referências verificáveis, CPV alinhados, experiência no distritos. O júri pode cruzar o que escreve com o que é público. Melhor um histórico honesto do que uma lista inflacionada.

## Quais são as limitações?

Contratos em agrupamento, subempreitada não visível, CPV mal classificados pela entidade. Confirme as peças e os seus arquivos. Não é um certificado de qualidade.

Conta grátis, sem cartão. Ajuste o perfil com os CPV reais.`,
    faq: [
      {
        question: 'Como vejo os contratos da minha empresa?',
        answer:
          'No PrepBid, pelo NIF. A ficha já consolida o histórico — não monte uma pesquisa à parte todas as vezes.',
      },
      {
        question: 'Devo copiar esses CPV para o perfil?',
        answer:
          'Sim, os que ainda são a sua atividade, mais a divisão/classe. O radar fica mais honesto do que com palavras soltas.',
      },
      {
        question: 'O histórico garante que vou ganhar o próximo?',
        answer:
          'Não. Ajuda a filtrar e a escrever referências. A proposta deste concurso decide-se nas peças e no preço/qualidade.',
      },
    ],
  },
  {
    slug: 'iso-e-certificacoes-em-cadernos-de-encargos',
    title: 'ISO e certificações no caderno: go ou no-go antes de orçamentar',
    description:
      'Quando o programa pede ISO 9001, 14001 ou outras certificações: âmbito, validade e impacto no go/no-go. No PrepBid essa exclusão acontece na triagem da carteira, depois do radar.',
    lede:
      'Se o programa exige certificações que a empresa não tem (ou fora de âmbito), o concurso deixa de ser elegível. Confirme antes de orçamentar; no PrepBid esse no-go fica na carteira, não depois de uma semana no mapa.',
    intent: 'informativa',
    tags: ['iso', 'habilitacao', 'caderno-de-encargos'],
    markdown: `## Porque as ISO aparecem nas peças?

Como requisito de habilitação ou como fator de qualidade. **9001**, **14001**, **45001** e outras específicas do setor (saúde, energia) são as mais frequentes. O que manda é o âmbito, a validade e se o programa aceita equivalente.

## O que verificar na exigência?

Se é requisito mínimo (exclusão) ou pontuação; se o âmbito do certificado cobre o objeto do concurso; se o agrupamento pode completar. Isto lê-se no programa, depois de o **radar do PrepBid** ter dito que o CPV, o distrito e o prazo até fazem sentido.

## Como decidir o go/no-go sem drama?

Não tem o certificado mínimo → no-go, carteira fechada. Tem mas o âmbito é outro → no-go ou condicional com jurista. Tem e o critério pontua → go com evidência na pasta. A conferência do certificado é na triagem e na pasta, depois do radar.

## Que erros são frequentes?

Enviar um PDF caducado, um âmbito de «comércio» a um concurso de empreitada, assumir que «estamos a certificar» chega. Não chega se o programa exige certificado válido à data.

Confirme as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'A ISO 9001 chega para todos os concursos?',
        answer:
          'Não. Muitos não a pedem; outros pedem 14001 ou certificações de setor. O programa deste concurso é a fonte.',
      },
      {
        question: 'Posso concorrer se o certificado está em renovação?',
        answer:
          'Só se as peças o permitirem. Não assuma. Trate como condicional e confirme com o seu apoio jurídico.',
      },
      {
        question: 'O PrepBid sabe quais ISO a minha empresa tem?',
        answer:
          'Só se as incluir no perfil / contexto da análise. O filtro automático do radar é CPV, geografia, valor e prazo; a ISO confirma-se na triagem.',
      },
    ],
  },
  {
    slug: 'lotes-em-concursos-publicos-vantagens-e-riscos',
    title: 'Lotes em concursos públicos: quando concorrer a um e não a todos',
    description:
      'Concursos divididos em lotes: regras de acumulação, caução e critérios. No PrepBid trate cada lote na carteira depois do radar ter filtrado o procedimento pelo perfil.',
    lede:
      'Lotes permitem entrar só na fatia executável — mas regras de acumulação, caução e critérios mudam por procedimento. No PrepBid o go é por lote, na carteira, depois da triagem do radar.',
    intent: 'informativa',
    tags: ['lotes', 'proposta', 'carteira'],
    markdown: `## Porque existem lotes?

Para permitir PME e especialidades sem obrigar a propor o concurso inteiro. Em saúde e energia é o padrão; em obras também. O objeto de cada lote pode ter CPV diferente — o **perfil** do **PrepBid** pode fazer passar o procedimento e mesmo assim um lote ser no-go.

## Quais são as vantagens?

Menos caução, objeto alinhado com a capacidade, menos mapa de quantidades. Um lote bem escolhido bate um concurso inteiro mal habilitado.

## Quais são os riscos?

Regras de adjudicação cruzada, limite de lotes por concorrente, preço anormalmente baixo num lote a contaminar a estratégia, prazo único para todos. Leia o programa.

## Que checklist usar antes de decidir?

1. O lote passa no perfil (CPV, distrito, valor)?
2. Habilitação específica deste lote?
3. Caução por lote ou global?
4. Posso executar vários ao mesmo tempo?

Marque na **carteira** o lote, não só o anúncio. A decisão operacional (por lote) é no PrepBid, na carteira.

Confirme as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Posso concorrer só a um lote?',
        answer:
          'Em regra sim, se o programa o permitir. Confirme limites de acumulação e caução. O go no PrepBid deve ser por lote.',
      },
      {
        question: 'O radar do PrepBid filtra por lote?',
        answer:
          'Filtra o procedimento (CPV, distrito, valor, prazo). A escolha do lote é a triagem seguinte, na ficha e na carteira.',
      },
      {
        question: 'Um no-go num lote mata os outros?',
        answer:
          'Só se as peças ligarem a adjudicação. Senão, trate cada lote como decisão própria.',
      },
    ],
  },
  {
    slug: 'mapa-de-quantidades-e-memoria-descritiva',
    title: 'Mapa de quantidades e memória descritiva: ordem de leitura',
    description:
      'No concurso de empreitada, mapa de quantidades e memória descritiva definem preço e risco. No PrepBid só depois do go no radar e na carteira se justifica este trabalho.',
    lede:
      'O mapa de quantidades estrutura o preço; a memória descritiva e os desenhos definem o que está incluído. Cruze os três antes de propor — e só nos concursos que o PrepBid já deixou passar no perfil.',
    intent: 'informativa',
    tags: ['empreitadas', 'preco', 'caderno-de-encargos'],
    markdown: `## Qual é a diferença prática?

O **mapa de quantidades** é a grelha de preço. A **memória descritiva** (e peças desenhadas) diz o que cada linha inclui. Orçamentar o mapa sem a memória é o erro que come margem ou ganha um contrato inexequível.

## Qual é a ordem de trabalho recomendada?

1. Go no **PrepBid**: perfil, prazo, alvará, critério.
2. Programa: habilitação e caução.
3. Memória + desenhos: âmbito.
4. Mapa: preço.
5. Esclarecimentos na plataforma se houver contradição.

Não inverta 4 e 1. Essa ordem é o fluxo PrepBid: radar → carteira → peças.

## Quando pedir esclarecimentos?

Quantidades absurdas, omissões, conflito mapa vs. desenho, prazo de visita incompatível. Peça na plataforma, dentro do prazo. A carteira do PrepBid deve ter a data.

## Como se liga ao critério de adjudicação?

Se o critério é preço, um erro no mapa mata. Se há qualidade, a memória da *sua* proposta não substitui o mapa certo. A análise de IA (Pro) aponta red flags; o orçamento é vosso.

Confirme as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Devo orçamentar o mapa antes de filtrar o concurso?',
        answer:
          'Não. No PrepBid o perfil e o radar vêm primeiro. O mapa é caro; só depois do go na carteira.',
      },
      {
        question: 'O PrepBid gera o mapa de quantidades?',
        answer:
          'Não. No Business há rascunho de proposta (.docx) com placeholders. O mapa e o preço são da empresa.',
      },
      {
        question: 'O que faço se o mapa e a memória se contradizem?',
        answer:
          'Pedido de esclarecimento na plataforma, dentro do prazo. Não assuma o que dá mais jeito no preço.',
      },
    ],
  },
  {
    slug: 'o-que-e-o-cpv-em-concursos-publicos',
    title: 'O que é o CPV em concursos públicos e como usá-lo no PrepBid',
    description:
      'O CPV classifica o objeto do contrato em oito dígitos. No PrepBid é o filtro principal do perfil e do radar — melhor do que palavras no título, a partir do histórico público já no PrepBid.',
    lede:
      'O CPV é o código de oito dígitos que classifica o objeto do contrato; filtra melhor do que palavras no título. No PrepBid os seus códigos ficam no perfil e aplicam-se ao radar.',
    intent: 'informativa',
    tags: ['cpv', 'perfil', 'radar'],
    markdown: `## O que é o CPV?

O **Vocabulário Comum para Contratos Públicos** é um código hierárquico (divisão, grupo, classe, categoria). Uma reabilitação de cobertura e um fornecimento de lâmpadas podem ter títulos parecidos e CPV diferentes. Entidades classificam mal com frequência: por isso o perfil no **PrepBid** deve incluir 8 dígitos *e* a classe (4 dígitos) da atividade.

## Porque o título do concurso não chega?

Porque o título é prosa. «Intervenção no edifício escolar» pode ser empreitada, avac, mobiliário ou inspeção. O CPV, o distrito e o valor no perfil cortam isto no radar. O código vem no anúncio e no contrato; o perfil do PrepBid é que o aplica ao radar.

## Como montar a sua lista de CPV?

1. Códigos em que já foi adjudicatário (histórico do seu NIF no PrepBid).
2. Códigos da atividade principal, um nível acima (4 dígitos) para apanhar erros de classificação.
3. Exclusões explícitas no perfil (termos e entidades a excluir).

## Que erros evitar?

Só a palavra «construção». Dezenas de CPV «por se acaso». Ignorar o CPV do lote. Não rever o perfil depois das primeiras semanas de radar.

## Como o PrepBid usa o CPV?

É o eixo do perfil, do radar, das renovações e dos concorrentes. Sem CPV honesto, «agir esta semana» enche-se de ruído. Conta grátis, sem cartão.

Confirme as peças: o objeto real manda sobre um CPV mal posto. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'O que é o CPV num concurso público?',
        answer:
          'O código que classifica o objeto do contrato. No PrepBid é o filtro principal do perfil, aplicado ao corpus público de anúncios e contratos.',
      },
      {
        question: 'Devo usar só os 8 dígitos?',
        answer:
          'Use os 8 em que já ganhou e acrescente a classe (4 dígitos). Muita entidade classifica mal o detalhe.',
      },
      {
        question: 'Onde encontro os CPV da minha empresa?',
        answer:
          'No histórico de adjudicações do seu NIF no PrepBid (corpus do Portal BASE) e nas peças dos concursos que executa.',
      },
    ],
  },
  {
    slug: 'o-que-e-o-portal-base',
    title: 'O que é o Portal BASE: fonte pública, não o radar da empresa',
    description:
      'O Portal BASE é o sistema público de contratos e procedimentos em Portugal — um corpus. O PrepBid é onde a empresa filtra, vê o radar, o perfil e age esta semana sobre esses dados.',
    lede:
      'O Portal BASE é a fonte pública de procedimentos, contratos e adjudicações em Portugal. Não é o sítio onde a empresa gere o radar, o perfil ou a lista «agir esta semana» — isso é o PrepBid.',
    intent: 'informativa',
    tags: ['portal-base', 'fontes-de-dados', 'prepbid'],
    markdown: `## O que é o Portal BASE?

O **Portal BASE** (base.gov.pt) é o sistema de informação dos contratos públicos em Portugal: procedimentos, contratos, entidades, valores, CPV, fundamentações. É um **corpus de transparência**, não um assistente comercial. O Diário da República publica anúncios oficiais; as plataformas eletrónicas (Vortal, acinGov e outras) são o canal de peças e de submissão. Três papéis. Nenhum é o **PrepBid**.

## Para que serve a uma empresa que concorre?

Como fonte: saber o que foi publicado, quem ganhou, a que preço, com que fundamento. Esses dados alimentam o perfil, o radar, os concorrentes e as renovações **no PrepBid**. O anti-padrão é tratar a fonte pública como inbox; o filtro do dia é o radar.

## O que o Portal BASE não faz?

- Não aplica o seu alvará, distritos, CPV de perfil nem intervalo de valor.
- Não monta a lista «agir esta semana» nem a carteira da equipa.
- Não estima a janela de contacto das renovações à medida da empresa.
- Não substitui o DR nem a plataforma de entrega da proposta.

## Como entra esta fonte no fluxo PrepBid?

Como origem do corpus que o PrepBid já indexa. O trabalho diário: **perfil → radar → Hoje → carteira**. Conta grátis, sem cartão, sem reunião comercial.

Confirme sempre o CCP e as peças do procedimento concreto. Este guia explica o papel da fonte; não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'O Portal BASE é obrigatório para apresentar proposta?',
        answer:
          'Não. A proposta entrega-se na plataforma eletrónica indicada no anúncio. O Portal BASE é a fonte pública de transparência; o radar e a carteira são no PrepBid.',
      },
      {
        question: 'Onde filtro concursos todas as manhãs?',
        answer:
          'No perfil e no radar do PrepBid (CPV, distritos, valor, prazo). A lista útil é «agir esta semana», não um inbox nacional.',
      },
      {
        question: 'O PrepBid substitui o Portal BASE?',
        answer:
          'Não substitui a fonte pública. Organiza o mesmo universo para a sua empresa: radar, renovações, concorrentes e carteira.',
      },
    ],
  },
  {
    slug: 'plataformas-eletronicas-vortal-acingov',
    title: 'Plataformas eletrónicas: Vortal, acinGov e a entrega da proposta',
    description:
      'A proposta entrega-se na plataforma indicada no anúncio (Vortal, acinGov e outras). Checklist de acesso e submissão; o PrepBid gere prazos na carteira, não substitui o portal de entrega.',
    lede:
      'A plataforma eletrónica indicada no anúncio é o canal de peças e de submissão: sem acesso validado a tempo, o prazo perde-se. O PrepBid avisa o prazo; a entrega continua a ser na plataforma.',
    intent: 'informativa',
    tags: ['plataformas', 'prazos', 'proposta'],
    markdown: `## Que papel tem a plataforma?

Vortal, acinGov, Saphety, ESPAP e outras: **peças**, esclarecimentos, visitas, **submissão** e recibo. Não é o Portal BASE e não é o PrepBid. O anúncio (DR) indica qual usar. No **PrepBid** a ficha do concurso aponta o canal; a carteira guarda o prazo.

## O que validar dias antes do prazo?

Credenciais, certificados de assinatura, perfil da empresa na plataforma, espaço para ficheiros, fuso e hora de fecho. Um go na carteira sem login testado é um no-go disfarçado.

## Que erros excluem ou impedem a entrega?

Plataforma errada, submissão depois da hora, ficheiro rejeitado, assinatura inválida, caução não carregada. Os lembretes Pro do PrepBid (7 e 2 dias) existem para esta margem — se a linha estiver na carteira.

## Qual é a relação com o PrepBid?

A plataforma é o balcão de *este* procedimento (peças e submissão). O PrepBid é a mesa de triagem (radar, prazos, carteira). Não misture os dois.

Confirme as instruções da plataforma e as peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Posso entregar a proposta no PrepBid?',
        answer:
          'Não. A entrega é na plataforma eletrónica indicada no anúncio. O PrepBid não submete por si.',
      },
      {
        question: 'O PrepBid submete a proposta na Vortal?',
        answer:
          'Não. A submissão é sempre manual na plataforma. O PrepBid ajuda a escolher o concurso, o prazo e, no Business, um rascunho .docx.',
      },
      {
        question: 'Onde vejo qual plataforma usar?',
        answer:
          'No anúncio e na ficha do concurso no PrepBid. Confirme sempre o texto oficial: a plataforma errada perde o prazo.',
      },
    ],
  },
  {
    slug: 'prazos-em-concursos-publicos-como-nao-perder',
    title: 'Prazos em concursos públicos: como não perder a proposta',
    description:
      'Prazos de propostas, esclarecimentos e visitas: trabalhe para trás a partir da data limite. No PrepBid «agir esta semana» e a carteira existem para não viver todos os anúncios em urgência.',
    lede:
      'O prazo da proposta é inegociável na plataforma: trabalhe para trás com margem para esclarecimentos e caução. No PrepBid a lista «agir esta semana» mostra o que fecha a menos de 30 dias.',
    intent: 'comercial',
    tags: ['prazos', 'carteira', 'radar'],
    markdown: `## Porque se perdem propostas «boas»?

Porque o prazo da **plataforma** não negocia. Esclarecimentos, visitas, caução e assinatura comem dias. Quem só vê o anúncio na véspera já perdeu. O **PrepBid** põe o prazo na lista **«agir esta semana»** e, na carteira, lembretes a 7 e 2 dias (Pro).

## Que prazos mapear no dia 1 do go?

Propostas, esclarecimentos, visitas ao local, caução, validade da proposta. Escreva na linha da carteira. A data vem no anúncio; o processo (carteira, lembretes, «agir esta semana») é no PrepBid.

## Qual é a checklist operacional?

Perfil a cortar o que não é para si → radar → Hoje → go na carteira → pasta e preço → submissão com margem. Sem o primeiro corte, todos os prazos parecem iguais e a equipa afoga-se.

## Como não viver em urgência permanente?

Estreite o perfil (CPV, distritos, valor). Use o radar de renovações para trabalhar *antes* do anúncio. Esse calendário à medida da empresa é o radar e a carteira do PrepBid.

Conta grátis, sem cartão. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'O que é a lista «agir esta semana» no PrepBid?',
        answer:
          'Oportunidades com prazo a menos de 30 dias, já cortadas pelo perfil. É o ecrã de manhã no PrepBid.',
      },
      {
        question: 'Os lembretes de prazo são automáticos?',
        answer:
          'No Pro, a 7 e 2 dias, para itens na carteira em Interessa / Em preparação. Sem linha na carteira, não há lembrete.',
      },
      {
        question: 'O prazo no anúncio e na plataforma podem diferir?',
        answer:
          'Trabalhe com a hora da plataforma indicada no anúncio. Em dúvida, a plataforma manda para a entrega.',
      },
    ],
  },
  {
    slug: 'preco-anormalmente-baixo-o-que-significa',
    title: 'Preço anormalmente baixo: o que significa na prática',
    description:
      'Propostas com preço anormalmente baixo podem ir a justificação ou exclusão. Verifique as peças; no PrepBid o histórico de rácio adjudicado/base dá contexto, não a regra deste concurso.',
    lede:
      'Um preço muito abaixo do referencial pode desencadear pedido de justificação ou exclusão se não for fundamentado. A regra está nas peças; o histórico público no PrepBid só dá contexto.',
    intent: 'informativa',
    tags: ['preco', 'criterios', 'proposta'],
    markdown: `## O que está em jogo?

O CCP e o programa do concurso podem tratar **preço anormalmente baixo**: pedido de justificação, exclusão se a justificação não colher. Não há um desconto mágico universal. O que manda é este procedimento.

## Como se preparar na proposta?

Conheça a sua conta de custos. Se o preço está agressivo, tenha memória de custos, subempreitadas e produtividades para justificar. Não copie um desconto «porque no histórico o PrepBid mostrou 22 % abaixo do base» — isso é estatística de mercado, não a sua estrutura.

## Para quem analisa o mercado?

O rácio adjudicado/preço base no corpus do Portal BASE (ficha PrepBid, previsão de fecho no Business) explica o que o mercado tem fechado. Não substitui o critério nem a análise do júri.

## O que este guia não faz?

Não define o limiar legal do seu concurso. Não aconselha a baixar o preço. Confirme peças e jurista.

O radar do PrepBid continua a servir para não orçamentar concursos irrelevantes. Preço anormalmente baixo é um problema *depois* do go.`,
    faq: [
      {
        question: 'Qual é a percentagem que torna o preço anormalmente baixo?',
        answer:
          'Não há um número único para todos os procedimentos. Leia o programa e o CCP aplicável. O histórico no PrepBid é contexto, não o limiar.',
      },
      {
        question: 'O PrepBid avisa se o meu preço é anormalmente baixo?',
        answer:
          'Não avalia a sua proposta. Mostra intervalos históricos de adjudicação (Business) para a decisão comercial go/no-go.',
      },
      {
        question: 'Uma justificação salva sempre o preço?',
        answer:
          'Não. Se a entidade considerar a justificação insuficiente, pode excluir. Trabalhe com o seu apoio jurídico.',
      },
    ],
  },
  {
    slug: 'prr-e-concursos-publicos-o-que-muda-na-pratica',
    title: 'PRR e concursos públicos: o que muda (e o que o CCP não dispensa)',
    description:
      'Procedimentos ligados ao PRR continuam a ser CCP: peças, prazos e habilitação. No PrepBid trate-os no radar como os outros, com o perfil a cortar energia e infraestruturas relevantes.',
    lede:
      'Concursos associados ao PRR continuam a ser procedimentos CCP: leia peças, prazos e habilitação. O financiamento não elimina formalidades. No PrepBid entram no radar pelo perfil, como qualquer outro anúncio.',
    intent: 'comercial',
    tags: ['prr', 'prazos', 'energia'],
    markdown: `## O que muda — e o que não muda?

Pode mudar o calendário político, o volume em energia e infraestruturas, e a pressão de executar. **Não muda** a lógica do CCP: tipo de procedimento, habilitação, critérios, plataforma, exclusões formais. Tratar «é PRR» como atalho é o erro.

## O que verificar nas peças?

Fonte de financiamento, prazos de execução curtos, certificações, lotes, caução. O mesmo guião de sempre, com menos folga. No **PrepBid**, primeiro o perfil (CPV, distrito, valor); depois a ficha e a carteira.

## Como priorizar no radar?

Deixe o radar aplicar o perfil. Se a empresa é de eficiência energética, os CPV certos já apanham o volume. Marque prazos curtos em «agir esta semana».

## Qual é o risco comercial?

Executar tarde, caução pesada, critérios de qualidade que a PME não evidencia. A análise de IA (Pro) lista red flags. O financiamento europeu não paga a exclusão formal.

Conta grátis, sem cartão. Não é aconselhamento jurídico nem sobre fundos.`,
    faq: [
      {
        question: 'Os concursos PRR têm regras próprias de habilitação?',
        answer:
          'Podem ter exigências extra nas peças, mas não dispensam o CCP. Leia o procedimento concreto.',
      },
      {
        question: 'Como filtro concursos PRR no PrepBid?',
        answer:
          'Não há um interruptor mágico «só PRR». Há perfil (CPV, distritos, valor) e o radar sobre o corpus de anúncios. O objeto manda.',
      },
      {
        question: 'O PrepBid identifica automaticamente os procedimentos PRR?',
        answer:
          'Não há um interruptor «só PRR». Há perfil (CPV, distritos, valor) e o radar. Confirme o texto oficial na ficha e nas peças.',
      },
    ],
  },
  {
    slug: 'radar-de-oportunidades-vs-abrir-o-base-todos-os-dias',
    title: 'Radar PrepBid vs varrer a lista nacional todos os dias',
    description:
      'Tratar a lista nacional como inbox gasta horas. O radar do PrepBid aplica CPV, distritos e valor e devolve o que agir esta semana.',
    lede:
      'Uma lista nacional sem perfil gasta horas. O radar do PrepBid aplica CPV, geografia e valor ao que interessa à empresa — o PrepBid é a ferramenta de trabalho.',
    intent: 'comercial',
    tags: ['radar', 'perfil', 'prepbid'],
    markdown: `## Qual é o custo real de uma lista nacional sem perfil?

Sem perfil, a lista nacional mistura limpezas, papelaria, obras pesadas e dispositivos médicos. A equipa lê títulos, abre PDFs e descobre tarde que o alvará ou o distrito não batem certo. Isso não é diligência — é **ruído**. O inbox da empresa é o radar do PrepBid.

## O que o radar do PrepBid faz?

- Aplica o **perfil**: CPV, distritos, intervalo de valor, termos e entidades a excluir.
- Destaca **prazos** curtos na lista **«agir esta semana»**.
- Mostra **renovações** estimadas a partir dos contratos em curso — não só o anúncio do dia.
- Liga **concorrentes**, entidades e carteira no mesmo corpus.

Não substitui ler o caderno. Substitui a primeira hora perdida a caçar o que não é para si.

## Quando ainda vale ir às peças oficiais à mão?

Uma peça em falta na plataforma, uma dúvida pontual no caderno. Exceção, não rotina. O radar e a ficha já estão no PrepBid.

## Qual é o modelo híbrido que funciona?

Perfil → radar → triagem 15–30 min no Hoje → go/no-go na **carteira** → peças só nos «sim» → plataforma. Digest de segunda (grátis) no email. Conta sem cartão; teste Pro 7 dias nos planos.

Confirme CCP e peças. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Onde filtro concursos todos os dias?',
        answer:
          'No radar do PrepBid, com o perfil da empresa (CPV, distritos, valor). A lista «agir esta semana» é o inbox.',
      },
      {
        question: 'Preciso de IA para filtrar concursos?',
        answer:
          'Não. Os filtros do perfil (CPV, distrito, valor) já cortam a maior parte do ruído. A análise de IA (Pro) é para o caderno dos «sim».',
      },
      {
        question: 'Quanto tempo se poupa?',
        answer:
          'O ganho está nas horas não gastas em cadernos errados e na janela de renovação antes do anúncio. A lista «agir esta semana» é o teste diário.',
      },
    ],
  },
  {
    slug: 'renovacao-de-contratos-publicos-quando-contactar',
    title: 'Renovação de contratos públicos: quando contactar (radar PrepBid)',
    description:
      'Contratos a terminar: o PrepBid estima a janela de contacto a partir das datas do corpus do Portal BASE, para agir meses antes do anúncio — não no dia em que o DR sai.',
    lede:
      'A janela útil de contacto é antes do anúncio. No PrepBid o radar de renovações estima o fim do contrato a partir das datas públicas e sugere quando contactar a entidade.',
    intent: 'comercial',
    tags: ['renovacoes', 'radar', 'entidades'],
    markdown: `## Porque o anúncio chega tarde demais?

Quando o concurso sai no Diário da República, o incumbente já está a trabalhar a proposta. Em obras, energia e saúde o objeto **repete-se**. Quem espera pelo anúncio joga o jogo do prazo curto. O **radar de renovações** do **PrepBid** existe para inverter isto.

## Que dados alimentam a janela?

Data de celebração e prazo de execução no corpus do Portal BASE. O PrepBid estima o fim e uma **data sugerida de contacto** (cerca de quatro meses antes). Não adivinha o tipo de procedimento futuro (aberto, consulta, ajuste). Estima **quando**.

Não monte esta conta à mão todas as semanas. Está no radar e na ficha da entidade, no PrepBid.

## O que dizer no contacto (sem prometer o ilegal)?

Que executa aquele objeto naquela geografia, que quer ser tido em conta quando o procedimento abrir, que tem referências públicas no mesmo CPV. Não peça um ajuste direto ilegal. Não é argumento jurídico; é presença comercial.

## Quais são as limitações honestas?

Contratos prorrogados, adendas, prazos mal preenchidos no corpus, CPV errados. Trate a data como hipótese de trabalho e confirme na ficha. Marque o follow-up na **carteira**.

Conta grátis, sem cartão. Não é aconselhamento jurídico.`,
    faq: [
      {
        question: 'Como sei quando contactar a entidade antes do próximo concurso?',
        answer:
          'Pelo radar de renovações do PrepBid, que estima o fim do contrato em curso e sugere uma janela (~4 meses antes).'
      },
      {
        question: 'O radar garante que vai haver concurso aberto?',
        answer:
          'Não. Estima o timing. O procedimento pode ser aberto, consulta prévia ou ajuste direto. O histórico da entidade dá o padrão.',
      },
      {
        question: 'Devo esperar pelo anúncio no DR para agir?',
        answer:
          'Não, se o objeto se repete. Esperar pelo DR é chegar tarde. «Agir esta semana» no PrepBid inclui concursos com prazo curto *e* o trabalho de renovação.',
      },
    ],
  },
  {
    slug: 'volume-de-negocios-minimo-em-concursos',
    title: 'Volume de negócios mínimo: como ler e quando é um no-go',
    description:
      'Requisitos de volume de negócios ou capacidade financeira no programa: evidência e decisão de concorrer. No PrepBid trate-o na triagem da carteira, depois do radar ter filtrado CPV e valor.',
    lede:
      'O volume de negócios mínimo é um filtro de capacidade financeira: se o programa o exige e não o evidencia, a proposta corre risco de exclusão. No PrepBid confirme-o no go da carteira, não no fim da semana de orçamento.',
    intent: 'informativa',
    tags: ['habilitacao', 'volume-negocios', 'go-no-go'],
    markdown: `## O que é este requisito?

Muitos programas pedem um **volume de negócios** mínimo (global ou na área do concurso) num certo número de anos. É habilitação económica, não um critério de qualidade. Sem evidência nos termos das peças, a proposta cai.

## Como evidenciar?

Contas, certidões, declarações — o que o programa listar, no formato pedido. Agrupamentos podem somar se as peças o permitirem. Não invente números; o júri cruza.

## Como usar no filtro semanal?

O **radar do PrepBid** já cortou CPV, distrito, valor e prazo. Na triagem de 20 minutos, o volume de negócios é um sim/não. No-go → carteira fechada. Não peça à contabilista a pasta para concursos que o perfil já deveria ter excluído pelo valor.

O PrepBid não calcula o seu volume de negócios. O histórico do NIF ajuda à narrativa; o requisito está nas peças deste concurso.

## A que deve prestar atenção?

Média vs. um único ano, IVA, volume «na área do objeto» vs. global, datas de encerramento de contas. Leia a frase do programa, não o hábito.

Confirme peças e ROC/contabilista. Não é aconselhamento jurídico nem financeiro.`,
    faq: [
      {
        question: 'O preço base do concurso é o volume de negócios exigido?',
        answer:
          'Não. O preço base é o teto do procedimento. O volume mínimo, quando existe, está no programa como requisito de habilitação.',
      },
      {
        question: 'O PrepBid sabe o meu volume de negócios?',
        answer:
          'Não automaticamente. O radar filtra valor do concurso; a conferência do requisito é na triagem e na pasta. Pode constar no contexto da análise de IA se o perfil o disser.',
      },
      {
        question: 'Posso somar o volume de empresas do grupo?',
        answer:
          'Só nos termos das peças e do regime aplicável. Não assuma. Confirme com o seu apoio jurídico.',
      },
    ],
  },
];

const RESERVED = 'o-que-e-o-base-gov';

function assertPayloads() {
  const slugs = new Set();
  for (const g of GUIDES) {
    if (g.slug === RESERVED) throw new Error(`slug reservado: ${g.slug}`);
    if (slugs.has(g.slug)) throw new Error(`slug duplicado: ${g.slug}`);
    slugs.add(g.slug);
    if (!g.title || g.title.length < 12) throw new Error(`título curto: ${g.slug}`);
    if (!g.description || g.description.length < 80) throw new Error(`descrição curta: ${g.slug}`);
    if (!g.lede || g.lede.length < 20) throw new Error(`lede curto: ${g.slug}`);
    const h2 = g.markdown.split('\n').filter((l) => l.startsWith('## ')).length;
    if (h2 < 2) throw new Error(`H2 insuficientes: ${g.slug}`);
    if (!Array.isArray(g.tags) || g.tags.length > 5) throw new Error(`tags: ${g.slug}`);
    if (g.markdown.includes(RESERVED)) throw new Error(`reserva no markdown: ${g.slug}`);
  }
  return slugs.size;
}

export async function putGuides(opts = {}) {
  const origin = String(opts.origin || process.env.ORIGIN || 'https://prepbid.com').replace(/\/$/, '');
  const key = opts.apiKey ?? process.env.APP_API_KEY ?? '';
  const agent = opts.agent || process.env.AGENT || 'claude';
  if (!key) {
    throw new Error('APP_API_KEY em falta. Exporte a chave do serviço Railway PrepBid e volte a correr.');
  }
  const results = [];
  for (const g of GUIDES) {
    const body = {
      title: g.title,
      description: g.description,
      lede: g.lede,
      intent: g.intent,
      markdown: g.markdown,
      faq: g.faq,
      tags: g.tags,
      status: 'published',
      agent,
    };
    const res = await fetch(`${origin}/api/agent/guides/${encodeURIComponent(g.slug)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
        'X-Agent': agent,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || text.slice(0, 200);
      throw new Error(`PUT ${g.slug} → ${res.status}: ${msg}`);
    }
    results.push({ slug: g.slug, status: res.status, published_at: json?.guide?.published_at ?? null });
    console.log(`ok ${g.slug}`);
  }
  return results;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const dry = process.argv.includes('--dry-run');
  const n = assertPayloads();
  console.log(`${n} guias válidos (slugs únicos, sem ${RESERVED}).`);
  if (dry) process.exit(0);
  putGuides().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Reescreve os guias públicos publicados via PUT /api/agent/guides/:slug.
 *
 * Não envia published_at — a data fica na BD.
 * Nunca usa o slug reservado o-que-e-o-base-gov.
 * Tom editorial (não telegráfico): artigos que endereçam dúvidas de quem concorre.
 * Ação do leitor só no PrepBid (perfil, radar, carteira, alertas, «agir esta semana»).
 * Copy do leitor: zero instruções para filtrar noutro portal público.
 * A chave lê-se de APP_API_KEY (serviço Railway PrepBid) e nunca é impressa.
 *
 * Uso:
 *   APP_API_KEY=… ORIGIN=https://prepbid.com AGENT=claude node scripts/rewrite-guides.mjs
 *   node scripts/rewrite-guides.mjs --dry-run
 */

export const GUIDES = [
  {
    slug: "acordo-quadro-o-que-significa-para-a-proposta",
    title: "Acordo-quadro: o que muda na sua proposta em duas fases",
    description:
      "Num acordo-quadro não se ganha o trabalho no primeiro concurso: ganha-se o lugar entre os aderentes. Depois as adjudicações correm em segundas fases. Como decidir se a adesão vale a pena e como o PrepBid acompanha esse canal no radar e na carteira.",
    lede:
      "No acordo-quadro a empresa concorre duas vezes: primeiro para ficar no acordo, depois só entre quem aderiu. Tratar a adesão como «mais um concurso aberto» é o erro que custa o canal durante anos.",
    intent: "informativa",
    tags: ["acordo-quadro", "ccp", "radar"],
    markdown: "## O que é um acordo-quadro, na prática de quem concorre?\n\nUm **acordo-quadro** não é o contrato de execução. É um enquadramento: a entidade (ou uma central de compras) escolhe um ou vários operadores, fixa condições — catálogo, preços máximos, prazos, regras de encomenda — e, durante um período, as **adjudicações concretas** saem das **segundas fases**. Quem não ficou na adesão, em regra, não é chamado a essas fases. Pode haver excepções nas peças; a presunção útil é: sem adesão, o canal está fechado.\n\nIsto muda a economia da proposta. Na adesão, o «prémio» não é uma empreitada ou um fornecimento imediato: é o direito a ser consultado. Nas segundas fases o calendário é curto, a concorrência é só entre aderentes e a capacidade de responder a picos importa tanto como o preço. Uma PME que ganha a adesão sem modelar essa capacidade fica refém de consultas que não consegue cumprir.\n\n## Porque é que isto gera tanta dúvida nas equipas?\n\nPorque o anúncio de adesão *parece* um concurso normal. Há CPV, preço base, habilitação, caução, plataforma. A tentação é orçamentar como se o volume viesse todo nesse procedimento. Não vem. O volume — em ESPAP, municípios, saúde, energia — está muitas vezes nas encomendas seguintes. A outra dúvida clássica: «se eu não aderir agora, ainda posso concorrer à obra daqui a um ano?» Em regra, não, até haver novo procedimento de adesão.\n\nHá também o medo inverso: aderir «para não ficar de fora» e depois não ter margem, caução ou pessoas para as consultas. Um «sim» mal preparado custa dinheiro e reputação. Um «não» consciente, com o canal marcado para a renovação do acordo, é uma decisão comercial — não uma falha.\n\n## O que ler nas peças antes de dizer sim à adesão?\n\nDuração do acordo e se há prorrogação. Número máximo de aderentes. Critério da fase inicial (preço, qualidade, ambos). Regras das segundas fases: consulta a todos, reabertura, miniconcurso, encomenda directa ao catálogo. Obrigações de responder, actualizar preços, stocks ou capacidade. Lotes: às vezes interessa aderir só ao lote que a empresa executa.\n\nConfirme caução, habilitação e se o acordo admite agrupamento. Um alvará ou ISO que chega à adesão pode não chegar a uma segunda fase com objecto mais exigente — leia os dois níveis. Isto não substitui o jurista da proposta; explica o sítio onde as equipas se perdem.\n\n## Como o PrepBid ajuda sem substituir as peças?\n\nNo **PrepBid** o tipo de procedimento e o CPV já vêm no **radar**, cortados pelo **perfil** (distritos, valor, actividade). A decisão de aderir não se improvisa no título do anúncio: marca-se na **carteira**, com o prazo da adesão à vista. As **alertas** e a lista **«agir esta semana»** servem os prazos curtos da adesão *e* das consultas seguintes, quando o acordo já está no histórico da entidade.\n\nO **radar de renovações** estima o fim do acordo a partir das datas públicas, para o contacto *antes* do próximo concurso de adesão — não no dia em que o anúncio sai. As peças e a submissão continuam na plataforma electrónica indicada no anúncio.\n\n## Que erros são frequentes — e como evitá-los?\n\nTratar o acordo como concurso único. Não reservar margem para preços máximos apertados nas segundas fases. Falhar uma formalidade na adesão e perder quatro anos de canal. Orçamentar todos os lotes «porque sim». Ignorar que, sem linha na carteira, a equipa não vê o prazo da consulta interna.\n\nO antídoto é processar: perfil estreito → radar → go/no-go na carteira → pasta só nos «sim». Conta grátis, sem cartão. Confirme o CCP e as peças. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Posso concorrer a uma segunda fase sem ter aderido ao acordo-quadro?",
        answer: "Em regra não. As segundas fases correm entre os operadores que ficaram no acordo. Sem adesão, o canal está fechado até ao próximo procedimento de adesão — confirme sempre as peças deste acordo.",
      },
      {
        question: "O PrepBid trata um acordo-quadro como um concurso aberto?",
        answer: "Não. O tipo de procedimento aparece no radar. A decisão de aderir ou não fica na carteira, com o prazo da adesão e, mais tarde, as consultas associadas à entidade.",
      },
      {
        question: "Onde acompanho os contratos já lançados ao abrigo de um acordo?",
        answer: "No PrepBid: ficha da entidade e contratos associados, alinhados ao perfil. Não monte uma pesquisa à parte para seguir o acordo.",
      }
    ],
  },
  {
    slug: "ajuste-direto-e-concurso-publico",
    title: "Ajuste direto e concurso público: a diferença na prática",
    description:
      "Quando a entidade pode adjudicar sem concurso aberto e o que muda para quem quer apresentar proposta em Portugal: concurso público, consulta prévia e ajuste direto — e como o tipo de procedimento aparece no radar do PrepBid.",
    lede:
      "No concurso público qualquer interessado que cumpra o programa pode apresentar proposta. No ajuste direto a entidade convida um ou poucos operadores. Essa diferença decide se ainda está a tempo de concorrer — ou se o contrato já nasceu fechado.",
    intent: "informativa",
    tags: ["ajuste-direto", "concurso-publico", "ccp"],
    markdown: "## O que distingue concurso público, consulta prévia e ajuste direto?\n\nO **tipo de procedimento** diz quem pode concorrer. No **concurso público** (e equivalentes abertos) o anúncio é o convite: qualquer operador que cumpra o programa apresenta proposta, com prazo, peças e critérios publicados. Na **consulta prévia** só os convidados (em regra três ou mais) entram; se não foi convidado, este procedimento não é para si. No **ajuste direto** a entidade escolhe um operador, sem fase pública de propostas. O contrato aparece depois, já adjudicado, com valor e fundamentação.\n\nHá limiares de valor e regras de fundamentação no Código dos Contratos Públicos. As mesas usam atalhos («abaixo de X é ajuste») que nem sempre coincidem com o anúncio concreto. A pergunta útil não é o slogan legal: é *este* procedimento, *estas* peças, *este* prazo.\n\n## Porque a entidade escolhe um tipo e não outro?\n\nValor, urgência, exclusividade técnica, acordo-quadro, contratos de muito baixo valor. A entidade não está a «fazer um favor»: está a enquadrar-se (bem ou mal) nas regras. Para quem vende, o padrão do comprador importa: uma câmara que faz ajuste direto repetido no mesmo CPV vai, mais tarde, abrir quando o valor ou a regra o obrigar — muitas vezes ao mesmo objecto.\n\nA dúvida clássica da PME: «se eu for excelente, convido-me a um ajuste?» Não. Sem convite não há proposta. O trabalho útil é estar visível *antes* — referências, presença comercial, janela de renovação — não insistir num procedimento já fechado.\n\n## O que muda na proposta em cada via?\n\nNo concurso público, habilitação, caução, critérios e prazo estão nas peças. Uma falha formal exclui mesmo com bom preço. Na consulta e no ajuste o convite substitui o anúncio aberto; os documentos pedem-se na mesma, o calendário é mais curto e a relação com a entidade pesa mais. Os **acordos-quadro** são um caso à parte: adesão aberta (ou restrita) e depois segundas fases só entre aderentes.\n\nSe o tipo de procedimento no radar diz ajuste direto e o contrato já está publicado, não há «ainda vou a tempo». Se diz concurso público, o relógio é o da plataforma.\n\n## Como o PrepBid mostra isto no dia a dia?\n\nNo **PrepBid** o tipo de procedimento vem no **radar** e na ficha, já cortado pelo **perfil**. É o campo que responde «ainda posso concorrer?». A lista **«agir esta semana»** junta prazos curtos de procedimentos abertos; o **radar de renovações** estima *quando* o contrato em curso acaba, para contactar a entidade **antes** do próximo anúncio — sem adivinhar se virá aberto, consulta ou ajuste.\n\nMarque o go na **carteira**. As **alertas** (Pro) avisam a 7 e 2 dias se a linha existir. O anúncio oficial e a entrega continuam nos canais próprios (Diário da República quando há anúncio; plataforma electrónica para peças e submissão).\n\n## Como usar o histórico para não chegar tarde?\n\nSe a mesma entidade ajusta o mesmo objecto todos os anos, a janela de contacto é meses antes do fim estimado — não na véspera. No PrepBid isso está na ficha da entidade e no radar de renovações. Confirme o CCP em vigor e o anúncio concreto. Isto explica a lógica; não substitui o jurista da proposta.",
    faq: [
      {
        question: "Posso concorrer a um ajuste direto sem convite?",
        answer: "Não. Só o operador convidado apresenta proposta. O contrato aparece depois na ficha do PrepBid, já adjudicado.",
      },
      {
        question: "Qual é a diferença entre consulta prévia e concurso público?",
        answer: "No concurso público qualquer interessado que cumpra o programa pode propor. Na consulta prévia só os operadores convidados (em regra três ou mais) apresentam proposta.",
      },
      {
        question: "Onde vejo o tipo de procedimento?",
        answer: "No PrepBid, na ficha do concurso e no radar. É esse campo que diz se ainda está a tempo de concorrer.",
      }
    ],
  },
  {
    slug: "ajuste-direto-fundamentacao-no-base",
    title: "Ajuste direto: como ler a fundamentação no histórico do comprador",
    description:
      "A fundamentação do ajuste direto explica porque a entidade não abriu concurso. No PrepBid lê-se na ficha do contrato e da entidade, para perceber o padrão do comprador — não para montar uma ficha noutro portal.",
    lede:
      "Quando a entidade adjudica por ajuste direto, publica uma justificação. Esse texto não é marketing: é o rasto de *porque* não abriu concurso. Serve para ler o padrão do comprador e decidir se vale a pena estar presente na próxima janela.",
    intent: "informativa",
    tags: ["ajuste-direto", "entidades", "historico"],
    markdown: "## O que é a fundamentação no ajuste direto?\n\nÉ o texto em que a entidade enquadra o critério legal — urgência, exclusividade, valor, acordo-quadro, etc. Não é um anúncio a convite público. Quem concorre não «responde» a este contrato: já foi adjudicado. O valor está em perceber se aquele comprador *repete* o mesmo objecto, a mesma urgência, o mesmo fornecedor.\n\nA dúvida honesta: «isto serve para impugnar?» Este guia não é aconselhamento jurídico. Prazos e vias de impugnação são com o seu jurista. Comercialmente, a fundamentação alimenta outra pergunta: o próximo procedimento aberto — quando o valor ou a regra o obrigar — vai ao mesmo CPV, na mesma geografia?\n\n## Porque interessa a quem ainda não foi convidado?\n\nPorque o mercado público é repetitivo. Manutenção, limpeza, energia, consumíveis de saúde, empreitadas de reabilitação: o objecto volta. Quem só reage ao anúncio aberto chega depois do incumbente. Quem lê o padrão (três ou quatro ajustes no mesmo CPV, na mesma câmara) sabe *quando* falar — meses antes do fim estimado do contrato em curso.\n\nNão use a fundamentação para acusar a entidade. Use-a para decidir presença comercial. «Só este fornecedor conhece o sistema» é um sinal de incumbência; não é um veredicto legal.\n\n## Como ler sem overclaim?\n\nDistinga fundamento legal (artigo do CCP) de narrativa operacional. Compare valores e prazos com contratos semelhantes da mesma entidade. Uma amostra de um contrato não é um padrão. CPV mal classificados partem a leitura. O PrepBid agrega o histórico na ficha da entidade e do contrato; a interpretação continua a ser da equipa.\n\n## Como o PrepBid encaixa neste trabalho?\n\nNo **PrepBid** a fundamentação aparece no contexto da **ficha** — CPV, valor, prazos, entidade — não como lista de campos para ir preencher noutro sítio. Ajuste o **perfil** (CPV, distritos), deixe o **radar** e o **radar de renovações** avisarem a janela de contacto, e marque o follow-up na **carteira**. **«Agir esta semana»** junta o que fecha a curto prazo; as **alertas** lembram o que já está em preparação.\n\nNão precisa de um ritual semanal de «ir buscar fundamentações». O corpus público já está nas fichas. O trabalho é decidir go/no-go e presença.\n\n## O que fazer com o padrão, na prática?\n\nMarque a entidade. Se o objecto é o seu, a geografia é executável e o histórico mostra repetição, o contacto institucional (sem pedir um ajuste ilegal) faz-se na janela estimada. Confirme o CCP e o contrato concreto. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "A fundamentação do ajuste direto está no Diário da República?",
        answer: "Em regra está no contrato. No PrepBid lê-se na ficha do contrato, ao lado de CPV, valor e prazos.",
      },
      {
        question: "Posso usar a fundamentação para impugnar o contrato?",
        answer: "Este guia não é aconselhamento jurídico. A fundamentação ajuda a ler o padrão do comprador; qualquer impugnação é com o seu jurista e prazos próprios.",
      },
      {
        question: "Como o PrepBid usa este campo?",
        answer: "Mostra-o no contexto da entidade e do contrato, para decidir go/no-go e o contacto de renovação — não como um formulário para preencher noutro portal.",
      }
    ],
  },
  {
    slug: "alvara-de-construcao-e-concursos-publicos",
    title: "Alvará de construção: o filtro que mata a empreitada antes do caderno",
    description:
      "Classe e categorias do alvará de construção condicionam a habilitação em empreitadas públicas. Como decidir go/no-go cedo e como o perfil do PrepBid corta concursos incompatíveis antes de gastar o mapa de quantidades.",
    lede:
      "Sem a classe e as categorias de alvará pedidas no programa, a proposta de empreitada corre risco de exclusão — por muito que o título e o CPV batam certo. O corte começa no perfil, não no fim da semana de orçamento.",
    intent: "informativa",
    tags: ["alvara", "habilitacao", "empreitadas"],
    markdown: "## Porque o alvará decide o go/no-go antes do preço?\n\nEm empreitadas, o **alvará** (classe e categorias) é habilitação, não um detalhe da pasta. Se o programa pede classe 4 e a empresa tem classe 2, o concurso deixou de ser relevante. Orçamentar esse caderno é tempo perdido: o júri nem chega ao mapa de quantidades. A dúvida típica («a subempreitada tapa?») só se responde nas peças — e muitas vezes a resposta é não, ou só em categorias acessórias.\n\nHá também o teto de valor da classe face ao preço base. Um alvará abaixo do valor do contrato, salvo regra expressa, é um não. Equipas que «vão ver o caderno na mesma» acumulam no-gos disfarçados de diligência.\n\n## O que olhar no anúncio e nas peças?\n\nClasse e categorias exigidas no programa. Possibilidade (ou não) de agrupamentos e de subempreitada para completar categorias. Valor do contrato face à classe. Se o objecto mistura especialidades (estruturas, AVAC, electricidade), confirme se o alvará da empresa cobre o lote a que vai, não o título genérico «reabilitação».\n\nO anúncio e as peças trazem o requisito. O trabalho da manhã não é reler o regulamento do alvará: é não meter na fila de orçamento o que a classe já exclui.\n\n## Como filtrar oportunidades com o alvará em mente?\n\nRegiste no **perfil** do **PrepBid** os distritos e o intervalo de valor alinhados com a classe. O **radar** aplica esse corte. A lista **«agir esta semana»** deve ser só o que a empresa consegue habilitar. Marque na **carteira** os «sim»; ignore o resto. As **alertas** (Pro) só fazem sentido para linhas em preparação — não para um universo nacional de obras.\n\nIsto não substitui ler o programa do concurso concreto. Substitui gastar segunda-feira em cadernos que a classe já matava.\n\n## Que erros são frequentes?\n\nTratar o alvará como detalhe da pasta. Confiar só no título «reabilitação». Assumir que a subempreitada tapa qualquer categoria. Filtrar por palavra «obras» em vez de CPV e valor. Deixar o perfil em branco e queixar-se do ruído.\n\n## O que o PrepBid não faz — e o que faz?\n\nNão emite alvará, não valida a sua classe junto do Instituto, não garante que o agrupamento é aceite. Mostra o concurso no radar com valor, distrito e prazo, para a triagem humana ser curta. Conta grátis, sem cartão. Confirme o CCP, o alvará em vigor e as peças. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Posso concorrer com classe abaixo da pedida se subempreitar?",
        answer: "Só se as peças o permitirem, e muitas vezes não cobrem a categoria principal. Leia o programa. Não assuma.",
      },
      {
        question: "O PrepBid sabe a classe do meu alvará?",
        answer: "O perfil corta por valor, CPV e distritos. A conferência da classe é sua, na triagem e nas peças. Use o intervalo de valor para não ver empreitadas fora da classe.",
      },
      {
        question: "O preço base acima do teto da classe é sempre no-go?",
        answer: "Em regra o teto da classe limita o valor do contrato. Confirme a redacção do programa e o seu alvará em vigor.",
      }
    ],
  },
  {
    slug: "caderno-de-encargos-o-que-ler-primeiro",
    title: "Caderno de encargos: o que ler primeiro sem perder o prazo",
    description:
      "Ordem prática para ler o caderno de encargos sem gastar a semana no sítio errado: objecto, habilitação, critérios, prazos e caução — e como o PrepBid decide quais cadernos sequer merecem essa leitura.",
    lede:
      "O caderno de encargos é o contrato que está a ser proposto. Não se lê de fio a pavio no primeiro dia. Lê-se pela ordem que mata o concurso cedo — ou confirma o go — antes de a memória descritiva comer o prazo.",
    intent: "informativa",
    tags: ["caderno", "prazos", "proposta"],
    markdown: "## Porque não se começa pela memória descritiva?\n\nPorque a memória e o mapa de quantidades são o trabalho *depois* do go. Antes, o caderno (com o programa) responde: ainda estamos a tempo? Podemos habilitar-nos? O critério é só preço ou também qualidade que não evidenciamos? A caução é suportável? A plataforma e o prazo são estes? Equipas que abrem o PDF na página 80 descobrem na quinta-feira que a classe de alvará não chega.\n\nA dúvida «mas e se houver um truque técnico no meio?» é válida. O truque técnico só importa nos concursos que passaram o filtro formal. Caso contrário está a orçamentar um não.\n\n## Qual é a ordem de leitura no dia 1 do go?\n\nObjecto e lotes (é mesmo o nosso CPV?). Habilitação (alvará, ISO, volume, DEUCP). Critério de adjudicação e pesos. Prazos: propostas, esclarecimentos, visitas. Caução e garantia. Plataforma e hora de fecho. Só depois especificações, mapa e memória. Escreva as datas na linha da **carteira**.\n\nPeça esclarecimentos cedo se uma cláusula for ambígua. Esclarecimento na véspera é teatro, não processo.\n\n## Como o PrepBid evita ler todos os cadernos da semana?\n\nO **perfil** (CPV, distritos, valor) e o **radar** já cortaram o ruído. **«Agir esta semana»** mostra o que fecha a menos de 30 dias. O go/no-go na **carteira** é a porta: sem go, não há pasta. As **alertas** Pro (7 e 2 dias) existem para a margem da plataforma, não para substituir a leitura.\n\nA ficha do concurso no PrepBid traz tipo de procedimento, prazo e valor. Três páginas do programa batem com isso. Se for no-go, pare.\n\n## Que sinais no caderno são red flags típicos?\n\nPrazos de visita que já não cabem. Critérios de qualidade sem grelha. Marcas nominativas sem equivalente. Caução desproporcionada. Lotes que obrigam a especialidades que não tem. Financiamento PRR com calendário de execução impossível para a sua estrutura.\n\n## O que este guia não substitui?\n\nNão substitui o jurista, o orçamentista nem as peças oficiais na plataforma. Confirme o caderno deste procedimento. Não é aconselhamento jurídico. Conta PrepBid grátis, sem cartão.",
    faq: [
      {
        question: "Devo ler o caderno inteiro antes de decidir go/no-go?",
        answer: "Não. Habilitação, critério, prazos e caução matam a maior parte dos não. O resto é para os sim da carteira.",
      },
      {
        question: "O PrepBid resume o caderno automaticamente?",
        answer: "No Pro, a análise de IA lista red flags a partir das peças quando estão disponíveis. Não substitui a leitura do programa nem a conferência documental.",
      },
      {
        question: "E se o caderno só estiver na plataforma?",
        answer: "A entrega e as peças oficiais são na plataforma indicada no anúncio. O PrepBid aponta o prazo e a ficha; não substitui o download na Vortal, acinGov ou equivalente.",
      }
    ],
  },
  {
    slug: "caucao-e-garantias-em-concursos-publicos",
    title: "Caução e garantias em concursos públicos: o essencial para não falhar o prazo",
    description:
      "Caução provisória e garantia de boa execução: o que verificar nas peças, quando pedir à banca ou ao seguro, e como a carteira do PrepBid evita descobrir a caução na véspera da plataforma.",
    lede:
      "A caução não é um detalhe financeiro para o fim: é um prazo, um montante e um formato que excluem propostas válidas no preço. Trata-se no dia do go, não na tarde da submissão.",
    intent: "informativa",
    tags: ["caucao", "prazos", "proposta"],
    markdown: "## Porque é que a caução mata propostas «boas»?\n\nPorque é formal. O programa diz se há caução provisória, em que percentagem, até quando e em que instrumento (garantia bancária, seguro-caução, depósito). Falta o documento, o valor está curto, o beneficiário está errado ou o ficheiro chega depois da hora: o júri nem discute o mapa. Equipas que deixam «a banca para sexta» descobrem que a banca não emite em quatro horas.\n\nA garantia de boa execução, depois da adjudicação, é outro calendário. Confundi-la com a caução da proposta é um erro clássico.\n\n## O que verificar nas peças no dia 1?\n\nSe existe caução provisória. Base de cálculo (preço base, proposta). Prazo de validade. Forma aceite. Quem é o beneficiário. Se há isenções. Se a garantia de execução tem percentagem e prazo próprios. Escreva a data na **carteira** ao lado do prazo da plataforma.\n\nNão copie a caução do concurso anterior. Este programa manda.\n\n## Quando peço à banca ou ao seguro?\n\nDepois do **go** na carteira do **PrepBid**, com margem. Não para todos os anúncios que passaram no **radar**. O **perfil** já deveria ter cortado valor e geografia; **«agir esta semana»** mostra o que fecha. As **alertas** Pro (7 e 2 dias) servem este buffer — se a linha existir.\n\nPedir garantia «por se vir a concorrer» a dezenas de procedimentos é custo e ruído. Pedir na véspera é exclusão.\n\n## O histórico público diz o valor da caução?\n\nRaramente de forma fiável. O valor está nas peças deste procedimento. O PrepBid não substitui o caderno; ajuda a não viver todos os concursos em urgência.\n\n## Quais são as limitações honestas?\n\nO PrepBid não emite cauções, não fala com o seu banco e não valida o PDF da garantia. Confirme peças e o seu intermediário financeiro. Não é aconselhamento jurídico nem financeiro. Conta grátis, sem cartão.",
    faq: [
      {
        question: "Quando peço a garantia à banca?",
        answer: "Depois do go na carteira do PrepBid, com margem para o prazo da plataforma. Não para todos os anúncios do radar.",
      },
      {
        question: "O histórico público diz o valor da caução?",
        answer: "Raramente de forma fiável. O valor está nas peças do procedimento concreto.",
      },
      {
        question: "Caução provisória e garantia de boa execução são a mesma coisa?",
        answer: "Não. Uma garante a proposta até à adjudicação; a outra garante a execução do contrato. Os prazos e percentagens estão nas peças.",
      }
    ],
  },
  {
    slug: "como-analisar-um-concorrente-no-portal-base",
    title: "Como analisar um concorrente com o histórico público de adjudicações",
    description:
      "Estudar adjudicatários por CPV, valores e entidades no histórico público. No PrepBid isso está no módulo de concorrentes: quota, incumbências e janelas de renovação — sem dados privados e sem montar uma pesquisa à parte.",
    lede:
      "O histórico público de adjudicações mostra onde o concorrente ganha, a que valores e com que entidades. Não mostra custos internos nem a proposta perdedora. Serve para decidir se ataca, evita ou acompanha — na ficha do PrepBid, não numa caça manual.",
    intent: "comercial",
    tags: ["concorrentes", "historico", "cpv"],
    markdown: "## O que pode (e não pode) ver sobre um concorrente?\n\nPode ver o que já é público: NIF, entidade adjudicante, CPV, valores, datas, tipo de procedimento. Não vê margens, subempreitadas reais, nem a proposta que perdeu. Nomes comerciais mudam; o NIF não. Quem analisa «pela firma» e não pelo NIF mistura empresas do grupo e perde o padrão.\n\nA dúvida «isto é legal / ético?» — estamos a falar de contratos publicados, não de dados privados. Não invente o que o contrato não mostra. Não use o histórico para difamar. Use-o para go/no-go e para a janela de renovação.\n\n## Qual é o método prático, sem teatro de Excel?\n\nIdentifique o NIF. Veja CPV e distritos onde concentra quota. Compare valores adjudicados com preços base quando existirem. Liste entidades onde é incumbente: são janelas de contacto. Decida se ataca (preço/qualidade que faz sentido), evita (desconto estrutural que não aguenta) ou acompanha (renovação daqui a meses).\n\nIsto faz-se na ficha de concorrente do **PrepBid**. Montar a amostra à mão todas as semanas é o anti-padrão.\n\n## Como usar isto na decisão go/no-go?\n\nSe o incumbente ganha sempre no mesmo hospital com desconto de 20 % e o critério é só preço, um «preço a meio» é um não. Se o contrato acaba em quatro meses e o objecto é o seu, o **radar de renovações** é o momento — na lista do PrepBid, com follow-up na **carteira**. O **perfil** garante que está a olhar para o seu CPV, não para o país inteiro.\n\n## Quais são as limitações?\n\nErros de CPV, agrupamentos, nomes mal normalizados. Amostra curta não é tendência. Confirme as peças do concurso concreto. O PrepBid consolida o público; não inventa o privado.\n\n## Como o PrepBid evita a «pesquisa nacional» de concorrentes?\n\nMódulo de concorrentes, fichas de entidade, radar e **«agir esta semana»**. **Alertas** para prazos dos concursos em que decidiu atacar. Conta grátis, sem cartão. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Onde analiso um concorrente no dia a dia?",
        answer: "No PrepBid, no módulo de concorrentes: NIF, quota e entidades já consolidados. Não monte uma pesquisa à parte.",
      },
      {
        question: "O PrepBid mostra propostas perdedoras?",
        answer: "Não. Só o que o corpus público tornou visível: contratos adjudicados e anúncios. Não há dados privados de outras empresas.",
      },
      {
        question: "Como ligo isto às renovações?",
        answer: "Onde o concorrente é incumbente, o radar estima o fim do contrato e a janela de contacto. Marque a entidade e acompanhe na carteira.",
      }
    ],
  },
  {
    slug: "como-montar-uma-equipa-de-concursos",
    title: "Como montar uma equipa de concursos públicos numa PME",
    description:
      "Papéis mínimos numa equipa de propostas: triagem no PrepBid, habilitação, preço e submissão na plataforma — mesmo com duas ou três pessoas. Como o radar e a carteira substituem o «faz tudo no prazo».",
    lede:
      "Separe triagem, pasta de habilitação, orçamentação e submissão: um único «faz tudo» no dia do prazo é a receita de exclusão formal. Mesmo com duas pessoas, o tempo tem de estar partido — e a mesa da semana é o PrepBid.",
    intent: "comercial",
    tags: ["equipa", "carteira", "prazos"],
    markdown: "## Quais são os papéis mínimos (mesmo com 2–3 pessoas)?\n\n**Triagem:** perfil, radar e «agir esta semana» no **PrepBid**. Quem decide o go não deveria estar a preencher a DEUCP à última hora. **Habilitação:** pasta permanente (certidões, alvará, ISO) alinhada com o que as peças pedem. **Preço / memória:** mapa de quantidades e texto técnico. **Submissão:** plataforma electrónica, assinatura e recibo.\n\nA mesma pessoa pode vestir dois papéis *em dias diferentes*. O que não funciona é vestir os quatro na sexta às 16h.\n\n## Que ritual semanal funciona de facto?\n\nSegunda: digest e lista **«agir esta semana»**. Terça–quarta: cadernos dos «sim» na **carteira**. Quinta: esclarecimentos e caução. Sexta: buffer da plataforma. As **alertas** Pro (7 e 2 dias) só ajudam se a linha estiver na carteira. Sem carteira, não há lembrete — e a equipa volta ao caos do email.\n\nO **perfil** estreito (CPV, distritos, valor) é o que impede a lista de ter 80 anúncios. Sem perfil, nenhum ritual aguenta.\n\n## Que ferramentas importam — e quais são teatro?\n\nUm perfil, um radar, uma carteira partilhada. Folhas soltas, um grupo de WhatsApp e «vamos vendo o que sai» não são um processo. A plataforma de entrega não é a mesa de triagem: é o balcão daquele concurso.\n\n## Quais são os sinais de equipa subdimensionada?\n\nPropostas submetidas a minutos do prazo. Exclusões formais repetidas. Zero tempo para renovações. Aí o problema não é «mais anúncios»; é menos ruído no perfil e mais no-gos cedo.\n\n## Como o PrepBid se senta à mesa?\n\nÉ a mesa: **radar**, **carteira**, **Hoje**, **alertas**. Conta grátis, sem cartão, sem reunião comercial. Teste Pro 7 dias nos planos. Não submete a proposta por si.",
    faq: [
      {
        question: "Uma pessoa chega para concursos numa PME?",
        answer: "Chega para a triagem no PrepBid se o perfil estiver certo. Habilitação e preço no mesmo dia do prazo é o padrão que exclui. Separe no tempo, mesmo que seja a mesma pessoa.",
      },
      {
        question: "A carteira substitui a pasta de habilitação?",
        answer: "Não. A carteira é o estado comercial (Nova → Em preparação → Submetida). A pasta de habilitação é o dossier documental da proposta.",
      },
      {
        question: "Onde a equipa deve olhar de manhã?",
        answer: "Para o ecrã Hoje do PrepBid («agir esta semana»).",
      }
    ],
  },
  {
    slug: "como-prever-o-valor-de-adjudicacao",
    title: "Como prever o valor de adjudicação de um concurso público",
    description:
      "O preço base raramente é o valor adjudicado. No PrepBid o intervalo sai do histórico do mesmo CPV — sem fingir uma percentagem de confiança de modelo — para a decisão go/no-go antes de gastar a semana no caderno.",
    lede:
      "O valor adjudicado costuma ficar abaixo do preço base. Estimar o fecho com rácios de concursos comparáveis não substitui a sua conta de custos — evita orçamentar um concurso que só fecha com um desconto que a empresa não aguenta.",
    intent: "comercial",
    tags: ["preco", "historico", "adjudicacao"],
    markdown: "## Porque o preço base engana quem está a decidir concorrer?\n\nO preço base é o teto do procedimento, não o preço de mercado. Em empreitadas e fornecimentos com concorrência real, descontos de 10–30 % são comuns; em procedimentos pouco concorridos, o adjudicado cola-se ao base. Sem o histórico daquele CPV e daquela entidade, qualquer número é palpite — e o palpite mais caro é «vamos na mesma, depois ajustamos».\n\nA dúvida da PME: «se eu for 5 % abaixo do base, ganho?» Ninguém sabe. O que se sabe é o que o mercado *tem fechado* em objectos semelhantes. Isso é estatística, não a regra deste júri.\n\n## Qual é o método honesto?\n\nOlhar para concursos comparáveis já publicados — mesmo CPV, de preferência a mesma entidade — e o rácio adjudicado / preço base. No **PrepBid** (plano Business) essa estimativa aparece na ficha: amostra dos últimos 24 meses, alargando 8→4→2 dígitos só se for preciso; subamostra da entidade quando há pelo menos cinco contratos; sem intervalo quando a amostra é curta. A confiança é alta/média/baixa em função da dispersão, não um score de um modelo treinado.\n\nO PrepBid não apresenta uma «percentagem de confiança» de machine learning. Não usa dados privados: só o que já é público.\n\n## Como usar o intervalo na decisão go / no-go?\n\nSe o intervalo histórico fecha 18–24 % abaixo do base e a sua estrutura de custos só aguenta 8 %, o concurso pode ser relevante em CPV e mesmo assim um não comercial. Filtrar cedo, na ficha, antes de gastar a semana no caderno. O **radar** e o **perfil** já deveriam ter cortado objecto e geografia; isto é o filtro de margem.\n\n## O que isto não é?\n\nNão é o preço a escrever na proposta. Não substitui o mapa de quantidades. Não prevê critérios de qualidade. Erros de CPV partem o padrão. Confirme peças e a sua conta de custos.\n\n## Onde isto vive no PrepBid?\n\nNa ficha do concurso (Business), depois do **radar** ter trazido o anúncio ao perfil. Marque o no-go na **carteira** se a margem não existir; use **«agir esta semana»** só para os que passam. Não é aconselhamento financeiro nem jurídico.",
    faq: [
      {
        question: "Isto substitui a proposta?",
        answer: "Não. É uma estimativa estatística com dados públicos, para a decisão comercial go/no-go.",
      },
      {
        question: "Porque o preço base do concurso não chega?",
        answer: "O preço base é o teto do procedimento. O valor adjudicado costuma ficar abaixo; o intervalo lê-se no histórico do mesmo CPV, de preferência da mesma entidade.",
      },
      {
        question: "Quando é que não há previsão?",
        answer: "Quando há menos de cinco contratos comparáveis depois de alargar o CPV. Nesse caso o PrepBid não inventa um intervalo.",
      }
    ],
  },
  {
    slug: "como-saber-quais-concursos-sao-relevantes",
    title: "Como saber quais concursos públicos são relevantes para a sua empresa",
    description:
      "Relevância não é «apareceu um título com obras». É CPV, distrito, valor, habilitação e prazo — no perfil e no radar do PrepBid. Como deixar de varrer a lista nacional todas as manhãs.",
    lede:
      "Um concurso é relevante quando coincide com o que faz, onde executa, o valor em que se habilita — e quando ainda há prazo. Palavras no título não bastam. No PrepBid isso fica no perfil e aplica-se ao radar todos os dias.",
    intent: "comercial",
    tags: ["radar", "perfil", "cpv"],
    markdown: "## Porque as palavras no título não bastam?\n\n«Obras», «serviços», «fornecimento» misturam objectos diferentes. Uma reabilitação de cobertura e um fornecimento de lâmpadas podem ter títulos parecidos e CPV diferentes. O **CPV**, o **distrito**, o **preço base** e o **histórico da entidade** filtram melhor do que texto livre. Quem pesquisa por palavra passa a manhã a abrir PDFs que o alvará já excluiria.\n\nA dúvida «e se perder um concurso bom porque filtrei demais?» é o medo que deixa o perfil em branco. O custo real é o contrário: 40 cadernos irrelevantes e zero tempo para o que fecha esta semana.\n\n## Como começar pelo CPV e pela geografia?\n\nGuarde os códigos em que já foi adjudicatário (estão nos contratos públicos do seu NIF). Acrescente a divisão (2 dígitos) e a classe (4 dígitos) — muita entidade classifica mal o 8. Corte distritos onde tem logística e alvará, e um intervalo de valor alinhado com a classe. No **PrepBid** isto é o **perfil**; aplica-se ao **radar** sem esperar por uma análise de IA.\n\n## Porque olhar para o que se repete, não só para o que abriu hoje?\n\nGrande parte do negócio público é o mesmo objecto, a mesma entidade, daqui a um, dois ou três anos. O contrato em curso tem datas na ficha do PrepBid; a janela de contacto útil é cerca de quatro meses antes do fim estimado. Quando o anúncio sai, o incumbente já está a trabalhar a proposta. O **radar de renovações** existe para isso.\n\n## Quando a habilitação mata o concurso?\n\nAlvará, ISO, certidões, volume de negócios: se o caderno pede classe 4 e tem classe 2, deixou de ser relevante. Filtrar não substitui ler as peças dos «sim». O ecrã útil de manhã é **«agir esta semana»** — prazo a menos de 30 dias — e as linhas da **carteira** já em preparação.\n\n## Como o PrepBid transforma isto em rotina?\n\nPerfil → radar → Hoje → carteira. **Alertas** nos gos. Conta grátis, sem cartão, sem reunião comercial. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Como filtrar concursos públicos relevantes em Portugal?",
        answer: "No PrepBid: CPV da actividade, distritos e intervalo de valor no perfil, cruzados com o histórico da entidade. Palavras no título não bastam.",
      },
      {
        question: "Onde filtro concursos relevantes no dia a dia?",
        answer: "No perfil e no radar do PrepBid. A lista útil é «agir esta semana», não um inbox nacional sem perfil.",
      },
      {
        question: "Quando um concurso deixa de ser relevante?",
        answer: "Quando o prazo já passou, quando a habilitação não chega, ou quando o valor está fora do que a empresa consegue executar.",
      }
    ],
  },
  {
    slug: "concursos-publicos-de-empreitadas-guia-pratico",
    title: "Concursos públicos de empreitadas: do filtro no PrepBid ao go/no-go",
    description:
      "Empreitadas de obras públicas em Portugal: alvará, mapa de quantidades, critérios e histórico da entidade. Como o PrepBid corta CPV, distrito e valor no perfil antes de abrir o caderno.",
    lede:
      "Em empreitadas, o primeiro filtro é habilitação e logística — alvará, CPV, distrito — não o título «reabilitação». Só o que passa esse corte merece o mapa de quantidades. A lista de trabalho da manhã é o radar do PrepBid.",
    intent: "comercial",
    tags: ["empreitadas", "alvara", "radar"],
    markdown: "## Por onde começar numa empreitada pública?\n\nPelo que exclui: classe e categorias de **alvará**, **CPV** de especialidade vs. empreitada geral, **distrito** onde consegue supervisionar, **valor** alinhado com a classe. No **PrepBid** isto é o **perfil**. Só o que passa vai a **«agir esta semana»**. Abrir o caderno de uma obra a 400 km, fora da classe, é o desperdício clássico da construtora que «não quer perder nada».\n\nA visita ao local, quando existe, come dias. Se o prazo já não a permite, o go é mentira.\n\n## Que sinais ler no histórico da entidade?\n\nQuem ganha naquela câmara, a que rácio sobre o preço base, se há ajuste direto repetido no mesmo objecto, quando acaba o contrato em curso. Esses dados aparecem nas fichas de entidade e concorrente do PrepBid. Servem a decisão comercial e a janela de renovação — não uma lista de campos para copiar para outro sítio.\n\n## Quais são os riscos específicos de empreitadas?\n\nMapa de quantidades incompleto, critérios de qualidade mal evidenciados, visitas que o prazo já não permite, caução pesada, especialidades em falta no alvará. A ficha de IA (Pro) ajuda a listar red flags; não substitui o orçamentista.\n\n## Como fazer um go/no-go em 30 minutos?\n\nRadar → ficha (tipo de procedimento, prazo, valor) → três páginas do programa (habilitação, critério, caução) → linha na **carteira**. Se for no-go, pare. Se for go, aí sim o mapa. **Alertas** a 7 e 2 dias se a linha existir.\n\n## O PrepBid substitui o mapa de quantidades?\n\nNão. Filtra e prioriza. O preço da empreitada continua a sair do mapa, da memória e da sua estrutura de custos. Conta grátis, sem cartão. Teste Pro 7 dias. Confirme peças. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "O PrepBid substitui o mapa de quantidades?",
        answer: "Não. Filtra e prioriza. O preço da empreitada continua a sair do mapa, da memória descritiva e da sua estrutura de custos.",
      },
      {
        question: "Devo olhar para todas as empreitadas publicadas no país?",
        answer: "Não. A sua lista é o radar do PrepBid com o perfil da empresa (CPV, distritos, valor, alvará na triagem).",
      },
      {
        question: "Quando contacto a câmara numa renovação de obras?",
        answer: "Na janela estimada pelo radar de renovações (cerca de quatro meses antes do fim do contrato em curso), não no dia do anúncio.",
      }
    ],
  },
  {
    slug: "concursos-publicos-energia-e-eficiencia",
    title: "Concursos públicos de energia e eficiência: o que filtrar no PrepBid",
    description:
      "Fotovoltaico, eficiência energética, iluminação e manutenção: CPV, critérios e histórico no radar do PrepBid. Como não orçamentar o título «fornecimento e instalação» sem ver objecto, distrito e incumbente.",
    lede:
      "Em energia e eficiência, o CPV certo e o histórico da entidade importam tanto quanto o título do anúncio. Títulos genéricos misturam objectos; o perfil do PrepBid separa-os antes de orçamentar.",
    intent: "comercial",
    tags: ["energia", "cpv", "radar"],
    markdown: "## Que objectos entram neste radar — e quais só parecem entrar?\n\nFotovoltaico, eficiência em edifícios, iluminação pública, manutenção de AVAC, gestão de energia. Títulos como «fornecimento e instalação» misturam tudo. O **CPV** no **perfil** do **PrepBid** separa-os. Quem filtra por palavra «energia» apanha também combustíveis, consultoria e obras que não executa.\n\nA dúvida «PRR muda as regras?» — o financiamento pode apertar o calendário; não dispensa o CCP. Peças, habilitação e plataforma continuam a mandar.\n\n## O que verificar além do preço?\n\nCritérios de qualidade (garantias, produção estimada, manutenção), certificações, prazos de execução, se há obrigação de resposta em acordo-quadro. A ficha go/no-go (Pro) lê red flags; o perfil já cortou distrito e valor. **«Agir esta semana»** mostra o que fecha; a **carteira** guarda o go.\n\n## O que aprender no histórico da entidade?\n\nQuem é o incumbente da manutenção, a que valores fechou o último fotovoltaico, se a câmara compra por acordo-quadro. Esses contratos estão nas fichas do PrepBid. Servem a renovação e o preço — não uma checklist de campos noutro sítio.\n\n## Como o PrepBid organiza a semana?\n\nPerfil (CPV de energia, distritos, valor) → **radar** → Hoje → **carteira**. **Alertas** nos prazos. Radar de renovações para o fim dos contratos de manutenção. Conta grátis, sem cartão.\n\n## Qual é o risco comercial típico?\n\nExecutar tarde, garantia de produção que não evidencia, caução pesada, lote eléctrico sem alvará. Confirme peças. Não é aconselhamento jurídico nem sobre fundos.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Como filtro concursos de energia no PrepBid?",
        answer: "Pelos CPV da actividade no perfil, mais distritos e valor. Não há um interruptor mágico «só fotovoltaico»: o código e o objecto mandam.",
      },
      {
        question: "O PRR dispensa habilitação?",
        answer: "Não. Pode haver exigências extra nas peças, mas o CCP não desaparece. Leia o procedimento concreto.",
      },
      {
        question: "Como vejo o incumbente da manutenção?",
        answer: "Na ficha da entidade e dos contratos associados, no PrepBid. Marque a renovação na carteira.",
      }
    ],
  },
  {
    slug: "concursos-publicos-para-pme-por-onde-comecar",
    title: "Concursos públicos para PME: por onde começar sem se afogar",
    description:
      "PME que querem entrar em contratação pública em Portugal: primeiros filtros (CPV, geografia, valor), habilitação e erros a evitar. Como o PrepBid transforma a lista nacional num radar da empresa.",
    lede:
      "Começar por «não perder nenhum anúncio» é o caminho mais rápido para não concorrer a nenhum com qualidade. Uma PME começa por um perfil estreito — o que faz, onde executa, o valor que habilita — e só depois monta pasta e preço.",
    intent: "comercial",
    tags: ["pme", "perfil", "radar"],
    markdown: "## Qual é o erro número um de quem começa?\n\nAbrir a pesquisa nacional e tentar «não perder nada». Isso mistura objectos, distritos e valores que a empresa não executa. A equipa lê títulos, abre PDFs e descobre tarde que o alvará ou o distrito não batem. O **PrepBid** existe para o contrário: um **perfil** estreito e um **radar** útil. O inbox da manhã é **«agir esta semana»**.\n\nA dúvida «e se o primeiro concurso bom estiver fora do perfil?» Ajuste o perfil com dados (CPV em que já ganhou, distritos reais). Não o desligue por medo.\n\n## O que precisa de ter na pasta permanente?\n\nAlvará (se empreitadas), certidões, DEUCP ou minutas de declaração, ISO se for o caso, contas para volume de negócios. A pasta *deste* concurso só depois do go na **carteira**. Submissão na plataforma indicada no anúncio — o PrepBid não entrega por si.\n\n## Como cabe o PrepBid nos primeiros 30 dias?\n\nCrie conta (grátis, sem cartão). Preencha CPV, distritos, valor. Veja o radar. Marque dois ou três gos. Use o digest de segunda. Teste Pro 7 dias nos planos se quiser análise de peças e alertas. Sem reunião comercial.\n\n## Que erros evitar no início?\n\nConcorrer a tudo «para treinar» e ser excluído por formalidade. Ignorar prazos de esclarecimentos. Copiar a memória do concurso anterior. Não olhar para renovações — o volume está no que se repete.\n\n## Quando é que ainda não está pronta?\n\nQuando não tem habilitação mínima para o objecto. Quando não há ninguém com calendário para a plataforma. Aí o radar ajuda a ver o mercado; a proposta ainda não. Confirme peças. Não é aconselhamento jurídico.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Preciso de pagar para começar a filtrar concursos?",
        answer: "Não. A conta PrepBid é grátis, sem cartão. O perfil e o radar cortam o ruído. O teste Pro de 7 dias activa-se nos planos.",
      },
      {
        question: "Por onde começo se nunca concorri?",
        answer: "Pelo perfil (CPV, distritos, valor), depois a lista «agir esta semana». Um go bem escolhido ensina mais do que dez cadernos irrelevantes.",
      },
      {
        question: "O PrepBid submete a proposta?",
        answer: "Não. A entrega é na plataforma electrónica do anúncio. O PrepBid é a triagem e os prazos.",
      }
    ],
  },
  {
    slug: "concursos-publicos-saude-e-dispositivos-medicos",
    title: "Concursos públicos de saúde e dispositivos médicos: como filtrar sem ruído",
    description:
      "Hospitais, ARS e entidades de saúde: dispositivos médicos, consumíveis e manutenção no perfil do PrepBid. Como não se perder em anúncios genéricos nem tratar o CPV 331 como «saúde em geral».",
    lede:
      "Em saúde, o objecto é estreito: um CPV de dispositivos não é um concurso de limpeza hospitalar. O perfil do PrepBid existe para essa distinção — antes de a equipa gastar o caderno de especificações técnicas.",
    intent: "comercial",
    tags: ["saude", "cpv", "radar"],
    markdown: "## Porque «saúde» no título não chega?\n\nPorque o universo mistura dispositivos médicos, consumíveis, medicamentos, manutenção de equipamentos, empreitadas em hospitais e serviços. Uma PME de dispositivos que filtra por palavra apanha obras e refeições. O **CPV** (muitas vezes a família 331) no **perfil** do **PrepBid** é o primeiro corte; o distrito e o valor são o segundo.\n\nA dúvida «e os acordos-quadro da saúde?» São um canal próprio: adesão e depois segundas fases. Trate-os como tal no radar, não como concurso aberto genérico.\n\n## O que verificar nas peças além do CPV?\n\nMarcas e equivalentes, certificações, prazos de entrega, lotes, stocks. Critérios de qualidade que a PME não evidencia. Incumbente e valores no histórico da entidade — nas fichas do PrepBid. **Carteira** para o go; **«agir esta semana»** para o prazo; **alertas** se estiver em preparação.\n\n## Como o PrepBid evita o dump nacional?\n\nPerfil estreito → radar → Hoje. Renovações de contratos de fornecimento contínuo (consumíveis, manutenção) são tão importantes como o anúncio do dia. Conta grátis, sem cartão.\n\n## Quais são os red flags típicos?\n\nEspecificações fechadas a uma marca sem equivalente real. Prazo de entrega incompatível com importação. Caução e volume de negócios desproporcionados. Lotes que obrigam a tudo-em-um.\n\n## O que este guia não faz?\n\nNão aconselha marcação CE nem substitui o regulatório. Confirme peças e o seu compliance. Não é aconselhamento jurídico.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Como filtro dispositivos médicos no PrepBid?",
        answer: "CPV da actividade no perfil (muitas vezes 331 e classes relacionadas), distritos e valor. Confirme o objecto na ficha: «saúde» no título não basta.",
      },
      {
        question: "Os hospitais compram só por acordo-quadro?",
        answer: "Depende da entidade e do objecto. O tipo de procedimento vem no radar. Adesões e concursos abertos misturam-se: trate cada um na carteira.",
      },
      {
        question: "O PrepBid valida se o meu dispositivo é equivalente?",
        answer: "Não. Mostra o concurso e o histórico. A equivalência está nas peças e na sua evidência técnica.",
      }
    ],
  },
  {
    slug: "consulta-previa-como-funciona",
    title: "Consulta prévia: como funciona e quem pode apresentar proposta",
    description:
      "Na consulta prévia só os operadores convidados apresentam proposta. Diferença face ao concurso público e ao ajuste direto, e como o PrepBid mostra o tipo de procedimento no radar — para não orçamentar um convite que não é seu.",
    lede:
      "Na consulta prévia o convite substitui o anúncio aberto: se não foi convidado, este procedimento não é para si. Confundir com concurso público gasta um caderno inteiro em vão.",
    intent: "informativa",
    tags: ["consulta-previa", "ccp", "radar"],
    markdown: "## O que é a consulta prévia, em linguagem de quem vende?\n\nA entidade convida um número mínimo de operadores (em regra três) a apresentar proposta. Não há fase aberta a qualquer interessado. Os documentos, critérios e prazos estão no convite e nas peças; o calendário costuma ser mais curto do que num concurso público. Sem convite, não há proposta.\n\nA dúvida «posso pedir para ser convidado a meio?» Em regra o procedimento já está lançado. O trabalho útil é estar visível *antes* — histórico, presença, renovação.\n\n## Em que é que isto não é um ajuste direto?\n\nNo ajuste a entidade escolhe um. Na consulta há concorrência entre convidados. No concurso público a concorrência é aberta. Os três tipos aparecem no **radar** do **PrepBid** como tipo de procedimento. É o campo que responde se ainda está a tempo.\n\n## O que muda na proposta se foi convidado?\n\nTudo o que é formal continua a mandar: habilitação, caução, formato, plataforma. O prazo curto é o risco. Passe o go à **carteira** no dia do convite; use **«agir esta semana»** e **alertas**. O **perfil** não o convoca — o convite sim — mas evita misturar isto com dezenas de concursos abertos irrelevantes.\n\n## Como o PrepBid ajuda quem *não* foi convidado?\n\nNão inventa um convite. Mostra o contrato depois, na ficha da entidade, e a janela de renovação para o próximo ciclo. Presença comercial sem pedir um ajuste ilegal.\n\n## O que confirmar sempre?\n\nO texto do convite e as peças. Confirme o CCP. Não é aconselhamento jurídico. Conta PrepBid grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Posso concorrer a uma consulta prévia sem convite?",
        answer: "Em regra não. Só os operadores convidados apresentam proposta. Confirme o convite e as peças.",
      },
      {
        question: "A consulta prévia tem anúncio no Diário da República?",
        answer: "O regime de publicidade depende do procedimento concreto. No PrepBid o tipo aparece na ficha; o que manda para concorrer é ter sido convidado.",
      },
      {
        question: "Como vejo se ainda estou a tempo?",
        answer: "No radar e na ficha do PrepBid: tipo de procedimento e prazo. Sem convite, não há prazo que chegue.",
      }
    ],
  },
  {
    slug: "criterios-de-adjudicacao-preco-e-qualidade",
    title: "Critérios de adjudicação: preço e qualidade na estratégia da proposta",
    description:
      "Preço mais baixo ou proposta economicamente mais vantajosa: como ler pesos, factores de qualidade e o impacto no go/no-go. O PrepBid prioriza o concurso; as peças dizem se a PME consegue evidenciar qualidade.",
    lede:
      "O critério de adjudicação decide se um bom preço chega ou se precisa de evidência de qualidade que a empresa não tem. Ler os pesos no dia 1 do go evita uma semana de mapa para um concurso que só se ganha com grelha que não preenche.",
    intent: "informativa",
    tags: ["criterios", "preco", "proposta"],
    markdown: "## Preço mais baixo ou proposta economicamente mais vantajosa?\n\nNo preço mais baixo, a equação é habilitação + preço + formalidades. Na proposta economicamente mais vantajosa (preço e qualidade), os pesos e os factores (prazo, garantia, metodologia, amostras) mudam o que é um «bom» número. Uma PME que só compete em preço num concurso a 40/60 qualidade está a jogar o jogo errado.\n\nA dúvida «a qualidade é subjectiva?» Pode ser, se a grelha for vaga. Peça esclarecimentos cedo. Não assuma que o júri «percebe» a sua excelência sem evidência no formato pedido.\n\n## O que ler nas peças no primeiro quarto de hora?\n\nFórmula, pesos, factores, documentos de evidência, se há negoceio. Se um factor pede certificação ou amostra que não tem tempo de produzir, é no-go — mesmo com CPV certo. Escreva o critério na linha da **carteira**.\n\n## Como o PrepBid entra aqui?\n\nO **radar** não escolhe o critério por si: traz o concurso já cortado pelo **perfil**. A análise de IA (Pro) lista red flags do caderno quando as peças estão disponíveis. **«Agir esta semana»** e **alertas** protegem o prazo. A decisão «conseguimos evidenciar os 40 % de qualidade?» é humana.\n\n## Que erros clássicos?\n\nIgnorar os pesos e orçamentar só o mapa. Copiar a memória do concurso anterior. Prometer prazos de execução que o factor premia e a obra não aguenta. Não ligar o intervalo histórico de adjudicação (Business) à realidade: um desconto agressivo em critério misto pode nem pontuar o suficiente.\n\n## O que este guia não faz?\n\nNão redige a memória. Confirme as peças. Não é aconselhamento jurídico. Conta PrepBid grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Se o critério é 100 % preço, a qualidade não conta?",
        answer: "Conta como habilitação e conformidade com o caderno. Não pontua, mas uma especificação incumprida exclui.",
      },
      {
        question: "O PrepBid calcula a minha pontuação?",
        answer: "Não. Mostra o concurso, o prazo e, no Pro, red flags. A grelha é das peças e da sua evidência.",
      },
      {
        question: "Quando é no-go por causa do critério?",
        answer: "Quando os factores de qualidade pedem evidência que não tem (certificação, amostras, metodologia) e o peso é material. Decida no dia 1, na carteira.",
      }
    ],
  },
  {
    slug: "diario-da-republica-e-anuncios-de-concursos",
    title: "Diário da República e anúncios de concursos: o marco oficial, não o inbox",
    description:
      "O anúncio no Diário da República é o marco oficial de muitos procedimentos. Como cruzar anúncio, peças na plataforma e o radar do PrepBid sem viver a abrir o DR todas as manhãs.",
    lede:
      "O anúncio oficial marca o procedimento e o prazo. Não é a lista de trabalho da empresa. Quem trata o Diário da República como inbox lê o país inteiro; quem trata o PrepBid como mesa vê o que o perfil já cortou.",
    intent: "informativa",
    tags: ["anuncios", "prazos", "radar"],
    markdown: "## Que papel tem o anúncio no Diário da República?\n\nÉ a publicidade oficial de muitos procedimentos: tipo, entidade, objecto, prazo, plataforma. Confirme sempre o texto oficial. Perder o anúncio não é o mesmo que perder o concurso — perder o prazo na plataforma, sim. Ajuste direto e alguns convites não passam por um anúncio aberto; o tipo de procedimento na ficha do **PrepBid** esclarece.\n\nA dúvida «tenho de abrir o DR todos os dias?» Não, se o radar estiver a aplicar o perfil. Abrir o DR à mão é excepção (peça em falta, dúvida pontual), não o processo.\n\n## Onde está o trabalho diário, então?\n\nNo **PrepBid**: **perfil → radar → «agir esta semana» → carteira**. O anúncio alimenta o corpus; a lista útil é a da empresa. **Alertas** nos gos. Plataforma electrónica para peças e submissão.\n\n## Como reduzir a dependência de «abrir o DR todos os dias»?\n\nDeixe o radar trabalhar. Segunda-feira o digest (grátis) resume o que entrou na janela. A carteira guarda os gos. Tipo de procedimento, prazo, CPV, preço base, distrito, plataforma: na ficha do concurso quando o anúncio entra no radar.\n\n## Que erros evitar?\n\nTratar o DR como motor de busca da empresa. Ignorar a hora da plataforma. Confundir publicação do anúncio com data de adjudicação. Não cruzar o tipo de procedimento com «ainda posso concorrer?».\n\n## O que o PrepBid não substitui?\n\nO texto oficial nem a plataforma de entrega. Confirme o anúncio e as peças. Não é aconselhamento jurídico. Conta grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "O PrepBid substitui o Diário da República?",
        answer: "Não. Organiza o universo para a sua empresa. O anúncio oficial continua a ser o marco; a entrega é na plataforma.",
      },
      {
        question: "Todos os concursos vêm no DR?",
        answer: "Muitos procedimentos abertos sim; ajustes e alguns convites não. O tipo de procedimento na ficha do PrepBid é o que diz se há fase pública.",
      },
      {
        question: "Onde vejo o prazo depois do anúncio?",
        answer: "Na ficha do concurso no PrepBid e, para a entrega, na plataforma indicada. «Agir esta semana» junta o que fecha a menos de 30 dias.",
      }
    ],
  },
  {
    slug: "distritos-e-geografia-na-escolha-de-concursos",
    title: "Distritos e geografia na escolha de concursos públicos",
    description:
      "Filtrar concursos por distrito e logística: como evitar propostas em que o deslocamento e a supervisão destroem a margem. No PrepBid os distritos do perfil aplicam-se ao radar automaticamente.",
    lede:
      "Um CPV certo num distrito onde não supervisiona é um não comercial. Geografia não é pormenor: é custo, alvará, conhecimento da entidade e capacidade de visitar o local a tempo.",
    intent: "comercial",
    tags: ["distritos", "perfil", "radar"],
    markdown: "## Porque filtrar por distrito?\n\nPorque executar em Bragança a partir de Faro, ou o inverso, come margem, visitas e fiscalização. Em empreitadas a visita ao local pode ser obrigatória. Em fornecimentos, a logística e o prazo de entrega pesam. Quem deixa o **perfil** do **PrepBid** sem distritos vê o país e «escolhe depois» — depois nunca chega.\n\nA dúvida «e os concursos com vários distritos de execução?» Leia as peças. O perfil é o primeiro corte; se a execução inclui um distrito que não aguenta, a **carteira** leva um no-go.\n\n## Como cortar sem perder o vizinho útil?\n\nInclua distritos onde já executou e os limítrofes com logística real. Não use só a palavra «Lisboa» no título — o local de execução está nas peças. O **radar** aplica o corte ao corpus de anúncios e contratos. **«Agir esta semana»** fica legível.\n\n## Que relação tem a geografia com o histórico da entidade?\n\nSe nunca executou nos Açores e o caderno pede presença local, é no-go. Se a câmara do distrito vizinho já o conhece, a renovação pesa mais. Fichas de entidade e carteira no PrepBid, não uma pesquisa nacional à mão.\n\n## Como o PrepBid aplica isto?\n\nDistritos no perfil → radar e Hoje. **Alertas** nos gos. Não adivinha o local exacto da obra se o anúncio vier genérico: confirme as peças.\n\n## Que erros evitar?\n\nFiltrar só por palavra no título. Ignorar o local de execução. Deixar o perfil em branco. Conta grátis, sem cartão. Confirme peças. Não é aconselhamento jurídico.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Como filtro concursos por distrito em Portugal?",
        answer: "No perfil do PrepBid, com os distritos onde executa. O radar aplica o corte.",
      },
      {
        question: "O PrepBid filtra pelos meus distritos automaticamente?",
        answer: "Sim, se os distritos estiverem no perfil. Esse recorte aplica-se ao radar e a «agir esta semana».",
      },
      {
        question: "E os concursos com vários distritos de execução?",
        answer: "Leia as peças. O perfil é um primeiro corte; se a execução inclui um distrito que não aguenta, a carteira leva um no-go.",
      }
    ],
  },
  {
    slug: "erros-formais-que-excluem-propostas",
    title: "Erros formais que excluem propostas (mesmo com bom preço)",
    description:
      "Falhas de habilitação, declarações, formatos e prazos: os erros formais mais comuns. No PrepBid a carteira e os lembretes reduzem a corrida da plataforma; as peças continuam a mandar.",
    lede:
      "Um erro formal pode excluir a proposta antes da análise do preço: listas de documentos, assinaturas e formatos não são detalhe. A pressa no prazo é o contexto típico — e é o que o PrepBid tenta tirar do caminho.",
    intent: "informativa",
    tags: ["erros-formais", "habilitacao", "prazos"],
    markdown: "## O que é um erro formal na prática?\n\nFalta de DEUCP ou declaração, ficheiro no formato errado, assinatura em falta, caução fora do prazo, proposta na plataforma errada ou depois da hora. O júri nem chega ao preço. Isto não se corrige com «mas o valor era bom». A dúvida «posso corrigir depois do prazo?» Só nos termos das peças e do CCP. Não assuma. Fale com o jurista.\n\n## Como reduzir o risco sem viver em pânico?\n\nPasta de habilitação permanente. Checklist no dia 1 do go. Submissão com margem. No **PrepBid**, passe o concurso à **carteira** assim que for go; as **alertas** Pro (7 e 2 dias) avisam. O **radar** não monta a pasta — evita gastar a pasta em concursos que o **perfil** já deveria ter morto. **«Agir esta semana»** torna o prazo visível.\n\n## Porque é que um preço bom não cura formalidade má?\n\nPorque as regras de exclusão são formais. Há contratos ganhos por segundo classificado depois de exclusão do primeiro. Leia o programa deste procedimento, não o hábito do último. A plataforma electrónica entrega a proposta; o PrepBid é a mesa da triagem e dos prazos.\n\n## Quais são os erros mais comuns?\n\nDocumentos em falta ou em formato não pedido. Submissão fora de hora. Nomes que não batem com o NIF. DEUCP quando pedia declaração (ou o inverso). Plataforma errada.\n\n## O que o PrepBid não valida?\n\nNão valida a sua DEUCP nem o PDF da assinatura. Ajuda a não viver todos os concursos em urgência. Confirme as peças. Não é aconselhamento jurídico. Conta grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Qual é o erro formal mais comum?",
        answer: "Documentos de habilitação em falta ou em formato não pedido, e a submissão fora de hora na plataforma. A pressa no prazo é o contexto típico.",
      },
      {
        question: "O PrepBid valida a minha DEUCP?",
        answer: "Não. Ajuda a não viver todos os concursos em urgência: perfil, radar, carteira e lembretes. A conferência documental é da equipa.",
      },
      {
        question: "Posso corrigir um erro formal depois do prazo?",
        answer: "Só nos termos das peças e do CCP. Não assuma. Fale com o jurista da proposta. Este guia não substitui esse aconselhamento.",
      }
    ],
  },
  {
    slug: "habilitacao-documental-deu-cp-e-declaracoes",
    title: "Habilitação documental: DEUCP e declarações sem exclusão formal",
    description:
      "DEUCP, declarações de honra e documentos de habilitação: organize a pasta cedo. No PrepBid filtre o concurso no radar antes de montar o dossier de cada anúncio — a pressa no prazo é o que exclui.",
    lede:
      "A habilitação documental exclui propostas válidas no preço: prepare DEUCP, declarações e certidões no formato e prazo que as peças pedem. A pasta deste concurso começa depois do go na carteira, não para todos os anúncios do radar.",
    intent: "informativa",
    tags: ["habilitacao", "deu-cp", "proposta"],
    markdown: "## Porque a pasta de habilitação manda na proposta?\n\nPorque é a primeira porta. Sem os documentos no formato pedido, o preço não é avaliado. A pasta permanente (certidões, alvará, ISO, minutas) reduz o pânico; o programa de cada concurso diz o que muda. A dúvida «a DEUCP substitui tudo?» Só nos termos do programa. Muitas peças pedem DEUCP e, mais tarde, os documentos.\n\n## O que costuma aparecer nas peças?\n\nDEUCP ou declaração de honra, habilitação jurídica, económica e técnica, comprovativos de alvará ou ISO, caução. A lista é a das peças, não a do concurso anterior. Versões caducadas, nomes que não batem com o NIF e PDF ilegível são clássicos.\n\n## Como organizar a equipa no PrepBid?\n\nTriagem no **PrepBid** (**perfil** + **radar** + **«agir esta semana»**) → go na **carteira** → pasta. Montar DEUCP para anúncios que o perfil já excluía é o desperdício clássico. As **alertas** Pro (7 e 2 dias) existem para a margem da plataforma se a linha estiver na carteira.\n\n## Que erros clássicos evitar?\n\nDEUCP quando pedia declaração (ou o inverso). Assinatura em falta. Ficheiro rejeitado. Começar a pasta na véspera. Filtrar o concurso errado — o erro anterior a todos estes.\n\n## O que o PrepBid não faz?\n\nNão valida a habilitação da sua empresa. A triagem no radar não substitui a pasta. Confirme as peças. Não é aconselhamento jurídico. Conta grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "A DEUCP substitui todos os documentos de habilitação?",
        answer: "Só nos termos do programa do concurso. Muitas peças pedem DEUCP e, mais tarde, os documentos. Leia o procedimento concreto.",
      },
      {
        question: "Quando começo a pasta?",
        answer: "Tenha uma pasta permanente. A pasta deste concurso começa depois do go na carteira do PrepBid, com o prazo da plataforma à vista.",
      },
      {
        question: "O PrepBid valida a habilitação da minha empresa?",
        answer: "A triagem no radar não substitui a pasta. A habilitação desta proposta está nas peças e nos seus documentos.",
      }
    ],
  },
  {
    slug: "historico-de-adjudicacoes-da-sua-empresa-no-base",
    title: "Histórico de adjudicações da sua empresa: como usar no PrepBid",
    description:
      "Os contratos em que a sua empresa foi adjudicatária (CPV, entidades, valores) validam o perfil e as referências da proposta. No PrepBid o NIF consolida esse histórico — sem montar uma pesquisa à parte todas as vezes.",
    lede:
      "O histórico público da sua empresa é a narrativa que o mercado já vê: objectos, entidades, valores, distritos. Nomes comerciais mudam; o NIF não. No PrepBid usa-se na triagem, no perfil e na memória — com honestidade, sem inflacionar o que o contrato não mostra.",
    intent: "comercial",
    tags: ["historico", "nif", "perfil"],
    markdown: "## O que diz o histórico público sobre si?\n\nContratos adjudicados ao seu **NIF**: CPV, entidades, valores, datas, distritos. É o que um júri ou um concorrente já pode cruzar. A dúvida «devo esconder um contrato mau?» O público já lá está. Melhor um histórico honesto do que uma lista inflacionada na memória descritiva.\n\nAgrupamentos e subempreitadas nem sempre se vêem bem. CPV mal classificados pela entidade partem o padrão. Confirme os seus arquivos.\n\n## Como extrair valor em 20 minutos no PrepBid?\n\nAbra a ficha da empresa no **PrepBid**. Anote CPV reais vs. os que tem no **perfil** (muita gente filtra pelo título e esquece códigos em que já ganhou). Marque entidades incumbentes para o **radar de renovações**. Tire referências para a memória — sem inventar. A **carteira** e **«agir esta semana»** usam o perfil já corrigido.\n\n## Como usar na proposta?\n\nReferências verificáveis, CPV alinhados, experiência nos distritos. O júri pode cruzar o que escreve com o que é público. O PrepBid ajuda a filtrar e a escrever referências; a proposta deste concurso decide-se nas peças e no preço/qualidade.\n\n## Quais são as limitações?\n\nContratos em agrupamento, subempreitada não visível, CPV errados. Não é um certificado de qualidade. Não monte uma pesquisa à parte todas as vezes: a ficha já consolida.\n\n## O que o PrepBid não garante?\n\nQue vai ganhar o próximo. Ajusta o perfil com os CPV reais. Conta grátis, sem cartão. Não é aconselhamento jurídico.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Como vejo os contratos da minha empresa?",
        answer: "No PrepBid, pelo NIF. A ficha já consolida o histórico — não monte uma pesquisa à parte todas as vezes.",
      },
      {
        question: "Devo copiar esses CPV para o perfil?",
        answer: "Sim, os que ainda são a sua actividade, mais a divisão/classe. O radar fica mais honesto do que com palavras soltas.",
      },
      {
        question: "O histórico garante que vou ganhar o próximo?",
        answer: "Não. Ajuda a filtrar e a escrever referências. A proposta deste concurso decide-se nas peças e no preço/qualidade.",
      }
    ],
  },
  {
    slug: "iso-e-certificacoes-em-cadernos-de-encargos",
    title: "ISO e certificações em cadernos de encargos: go ou no-go",
    description:
      "Quando o caderno pede ISO 9001, 14001 ou outras certificações: âmbito, validade e impacto no go/no-go. No PrepBid a triagem do radar vem primeiro; a conferência da certificação é nas peças do concurso concreto.",
    lede:
      "Uma ISO pedida no programa não é um detalhe da pasta: se o âmbito ou a validade não batem, a proposta corre risco de exclusão. Confirme no dia do go, não no fim da memória descritiva.",
    intent: "informativa",
    tags: ["iso", "habilitacao", "proposta"],
    markdown: "## Quando a certificação mata o concurso?\n\nQuando o programa exige ISO 9001, 14001, 45001 ou outra, com âmbito e entidade certificadora, e a empresa não a tem — ou tem-na noutro âmbito. «Estamos a tirar a ISO» não é evidência. A dúvida «o agrupamento tapa?» Só se as peças o permitirem e o membro certificado for o que executa o objecto relevante.\n\n## O que ler nas peças?\n\nNorma, âmbito, validade na data da proposta, se aceitam equivalente, se pedem o certificado na habilitação ou como factor de qualidade. Escreva o sim/não na **carteira** no dia 1.\n\n## Como o PrepBid encaixa?\n\nO **radar** não sabe o número do seu certificado. O **perfil** corta CPV, distritos e valor para não ver concursos que já nasciam impossíveis. **«Agir esta semana»** e **alertas** protegem o prazo dos que passam. A conferência ISO é humana, nas peças.\n\n## Que erros evitar?\n\nEnviar um certificado caducado. Âmbito de «comércio» num concurso de empreitada. Prometer certificação futura como se fosse actual. Ignorar que a ISO é factor de qualidade com peso e não só habilitação.\n\n## O que este guia não faz?\n\nNão certifica a empresa. Confirme peças e o organismo certificador. Não é aconselhamento jurídico. Conta PrepBid grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Posso concorrer sem ISO se estiver em processo de certificação?",
        answer: "Só se as peças aceitarem. Muitas vezes não. Não assuma. Leia o programa.",
      },
      {
        question: "O PrepBid filtra concursos que pedem ISO?",
        answer: "Não há um interruptor «só com ISO». Há perfil (objecto, geografia, valor) e a leitura das peças no go da carteira.",
      },
      {
        question: "ISO como critério de qualidade é o mesmo que habilitação?",
        answer: "Não. Habilitação exclui; qualidade pontua. Confirme se está nos requisitos mínimos ou na grelha de factores.",
      }
    ],
  },
  {
    slug: "lotes-em-concursos-publicos-vantagens-e-riscos",
    title: "Lotes em concursos públicos: quando concorrer a um, a vários ou a todos",
    description:
      "Concursos divididos em lotes: regras de adjudicação, capacidade e caução. No PrepBid trate cada lote na carteira — um «sim» a todos os lotes sem capacidade é um não disfarçado.",
    lede:
      "Um concurso com lotes não é um único go. É vários objectos, habilitação e prazos que podem não ser os mesmos. Concorrer a tudo «para não perder quota» é o erro que exclui ou executa mal.",
    intent: "informativa",
    tags: ["lotes", "proposta", "carteira"],
    markdown: "## Porque os lotes mudam a decisão comercial?\n\nPorque cada lote pode ter CPV, valor, alvará e critério próprios. Pode haver limite ao número de lotes por concorrente. A caução pode somar. A visita pode ser a um lote e não a outro. A dúvida «se eu for ao lote pequeno, fico de fora do grande?» Está nas peças — não no hábito.\n\n## O que ler antes de marcar a carteira?\n\nMapa de lotes, regras de adjudicação (um vencedor por lote vs. combinações), incompatibilidades, capacidade máxima. No **PrepBid** o anúncio entra no **radar** como procedimento; a decisão por lote é sua, na **carteira**. Não trate o título único como um único trabalho.\n\n## Como o PrepBid ajuda?\n\n**Perfil** corta geografia e valor globais. **«Agir esta semana»** mostra o prazo do procedimento. **Alertas** se o go existir. Não explode automaticamente um anúncio em N linhas por lote: a equipa decide quais lotes são sim.\n\n## Que riscos são típicos?\n\nAdjudicar mais lotes do que a produção aguenta. Habilitação que cobre o lote A e não o B. Preço agressivo no lote âncora para «levar» os outros, se as peças o permitirem — ou exclusão se não permitirem.\n\n## O que confirmar?\n\nPeças e CCP. Não é aconselhamento jurídico. Conta PrepBid grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Posso concorrer só a um lote?",
        answer: "Em regra sim, salvo se as peças obrigarem a todos. Leia o programa.",
      },
      {
        question: "O PrepBid cria uma linha na carteira por lote?",
        answer: "A carteira segue o concurso que marcou. Se tratar lotes como gos distintos, anote-os na linha ou separe o acompanhamento na equipa.",
      },
      {
        question: "A caução soma todos os lotes?",
        answer: "Depende das peças. Não copie o concurso anterior. Confirme a base de cálculo deste procedimento.",
      }
    ],
  },
  {
    slug: "mapa-de-quantidades-e-memoria-descritiva",
    title: "Mapa de quantidades e memória descritiva: quando investir (e quando não)",
    description:
      "No concurso de empreitada, mapa de quantidades e memória descritiva definem o preço e o risco. Ordem de leitura, esclarecimentos — e como o PrepBid garante que só os gos da carteira chegam a este trabalho.",
    lede:
      "O mapa de quantidades não se abre para «explorar» o concurso. Abre-se depois do go: habilitação, critério, prazo e caução já passaram. Caso contrário a semana morre num PDF que a classe de alvará já matava.",
    intent: "informativa",
    tags: ["mapa-quantidades", "empreitadas", "proposta"],
    markdown: "## Porque esta é a parte cara da proposta?\n\nPorque exige orçamentista, fornecedores, subempreitadas e tempo. Um mapa incompleto ou uma memória copiada do concurso anterior são risco de preço e de exclusão. A dúvida «devo orçamentar para treinar?» Treine num go real da **carteira**, não em dez cadernos do **radar** sem filtro.\n\n## Qual é a ordem depois do go?\n\nConfirme lotes e objecto. Peça esclarecimentos cedo se quantidades forem ambíguas. Cruze memória e mapa (contradições são clássicas). Só depois o preço. Escreva o prazo da plataforma na carteira; use **«agir esta semana»** e **alertas**.\n\n## Como o PrepBid protege este tempo?\n\n**Perfil** e radar cortam CPV, distrito e valor. Sem go, não há mapa. A análise Pro lista red flags; não substitui o orçamentista. O intervalo histórico de adjudicação (Business) dá contexto de mercado, não o preço a escrever.\n\n## Que erros evitar?\n\nComeçar pelo mapa. Ignorar unidades. Não visitar o local quando as peças o exigem. Entregar memória genérica em critério de qualidade.\n\n## O que este guia não faz?\n\nNão orçamenta. Confirme peças. Não é aconselhamento jurídico. Conta PrepBid grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Devo orçamentar o mapa antes de filtrar o concurso?",
        answer: "Não. Habilitação, critério, prazo e caução primeiro. O mapa é para os sim da carteira.",
      },
      {
        question: "O PrepBid preenche o mapa de quantidades?",
        answer: "Não. Filtra o concurso e, no Business, um rascunho de proposta não substitui o mapa nem a sua estrutura de custos.",
      },
      {
        question: "E se o mapa e a memória se contradisserem?",
        answer: "Esclarecimento cedo. Não invente a conciliação na véspera. O prazo de esclarecimentos está nas peças.",
      }
    ],
  },
  {
    slug: "o-que-e-o-cpv-em-concursos-publicos",
    title: "O que é o CPV em concursos públicos e como usá-lo no PrepBid",
    description:
      "O CPV (Vocabulário Comum para Contratos Públicos) classifica o objecto do concurso. Aprenda a filtrar empreitadas, energia e saúde sem depender só do título — no perfil e no radar do PrepBid.",
    lede:
      "O CPV é o código de oito dígitos do objecto. Títulos parecidos escondem códigos diferentes. Quem filtra só por palavra vive no ruído; quem põe os códigos certos no perfil do PrepBid vê o radar da empresa.",
    intent: "informativa",
    tags: ["cpv", "perfil", "radar"],
    markdown: "## O que é o CPV e porque as empresas o ignoram?\n\nÉ o Vocabulário Comum para Contratos Públicos: um código que classifica o objecto. A entidade escolhe-o (às vezes mal). Uma reabilitação de cobertura e um fornecimento de lâmpadas podem ter títulos parecidos e CPV diferentes. Filtrar por «obras» mistura especialidades, espaços verdes e empreitada geral.\n\nA dúvida «devo usar só os 8 dígitos?» Use os 8 em que já ganhou e acrescente a classe (4 dígitos). Muita entidade classifica mal o detalhe.\n\n## Onde encontro os CPV da minha empresa?\n\nNo histórico de adjudicações do seu NIF no **PrepBid** e nas peças dos concursos que executa. Copie para o **perfil** os que ainda são a actividade. O **radar** fica mais honesto.\n\n## Como o CPV se liga a distrito e valor?\n\nOs três cortes juntos. CPV certo no distrito errado continua a ser um não. No PrepBid o perfil aplica-os ao radar e a **«agir esta semana»**. A **carteira** recebe só os gos. **Alertas** nos prazos.\n\n## Que erros evitar?\n\nUm único código demasiado estreito. Só palavras. Ignorar a divisão de 2 dígitos. Não rever o perfil quando a empresa muda de especialidade.\n\n## O PrepBid corrige CPV mal classificados pela entidade?\n\nNão reescreve o anúncio. Mostra o código publicado e deixa o perfil (incluindo classes mais largas) apanhar o que importa. Confirme o objecto nas peças. Não é aconselhamento jurídico. Conta grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Devo usar só os 8 dígitos?",
        answer: "Use os 8 em que já ganhou e acrescente a classe (4 dígitos). Muita entidade classifica mal o detalhe.",
      },
      {
        question: "Onde encontro os CPV da minha empresa?",
        answer: "No histórico de adjudicações do seu NIF no PrepBid e nas peças dos concursos que executa.",
      },
      {
        question: "Palavras no título substituem o CPV?",
        answer: "Não. Palavras misturam objectos. O CPV no perfil é o corte que o radar aplica todos os dias.",
      }
    ],
  },
  {
    slug: "o-que-e-o-portal-base",
    title: "Onde a empresa filtra concursos: radar e perfil no PrepBid",
    description:
      "Anúncios e contratos públicos existem nas fontes oficiais; o trabalho diário da empresa — perfil, radar, carteira e «agir esta semana» — faz-se no PrepBid. Este guia explica os papéis, sem tratar um portal público como o inbox da equipa.",
    lede:
      "Os anúncios oficiais saem no Diário da República e as peças entregam-se na plataforma electrónica. O sítio onde a empresa filtra, vê o radar e age esta semana é o PrepBid — não uma lista nacional sem perfil.",
    intent: "informativa",
    tags: ["radar", "perfil", "prepbid"],
    markdown: "## Onde a empresa deve trabalhar no dia a dia?\n\nNo **PrepBid**: **perfil → radar → Hoje → carteira**. CPV, distritos, valor e prazos já cortados. A lista útil é **«agir esta semana»**. Quem trata a transparência pública como motor de busca da empresa lê limpezas, papelaria e obras pesadas na mesma manhã.\n\nA dúvida que traz gente a este URL: «não preciso de ir ao sítio onde os contratos são publicados?» Precisa do *dado*; não precisa de fazer ali o filtro do dia. O corpus já alimenta o PrepBid. As **alertas** e a carteira são da empresa.\n\n## Que papéis têm as fontes oficiais e as plataformas?\n\nO Diário da República publica anúncios. As plataformas electrónicas (Vortal, acinGov e outras) são o canal de peças e de submissão. Contratos e adjudicações ficam em fontes públicas oficiais. Nenhum desses canais aplica o seu alvará, monta a lista da semana nem estima a janela de renovação à medida da empresa.\n\n## O que o PrepBid faz com esses dados?\n\nAplica o perfil, monta o radar, estima renovações, junta concorrentes e entidades. Conta grátis, sem cartão, sem reunião comercial. Não substitui o anúncio oficial nem a entrega na plataforma.\n\n## Como começa o fluxo de manhã?\n\nAbra o PrepBid. Veja «agir esta semana». Marque gos na carteira. Peças e submissão só nos «sim», na plataforma indicada no anúncio.\n\n## O que este guia não é?\n\nNão é um tutorial de outro portal. Confirme o CCP e as peças. Não é aconselhamento jurídico.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Onde entrego a proposta?",
        answer: "Na plataforma electrónica indicada no anúncio. O PrepBid não submete por si; avisa o prazo na carteira.",
      },
      {
        question: "Onde filtro concursos todas as manhãs?",
        answer: "No perfil e no radar do PrepBid (CPV, distritos, valor, prazo). A lista útil é «agir esta semana».",
      },
      {
        question: "O PrepBid substitui o Diário da República ou a plataforma?",
        answer: "Não. Organiza o universo para a sua empresa: radar, renovações, concorrentes e carteira. O anúncio oficial e a entrega continuam nos canais próprios.",
      }
    ],
  },
  {
    slug: "plataformas-eletronicas-vortal-acingov",
    title: "Plataformas eletrónicas: Vortal, acinGov e a entrega da proposta",
    description:
      "A proposta entrega-se na plataforma indicada no anúncio (Vortal, acinGov e outras). Checklist de acesso e submissão; o PrepBid gere prazos na carteira, não substitui o portal de entrega.",
    lede:
      "A plataforma electrónica indicada no anúncio é o canal de peças e de submissão: sem acesso validado a tempo, o prazo perde-se. O PrepBid avisa o prazo; a entrega continua a ser na plataforma.",
    intent: "informativa",
    tags: ["plataformas", "prazos", "proposta"],
    markdown: "## Que papel tem a plataforma?\n\nVortal, acinGov, Saphety, ESPAP e outras: **peças**, esclarecimentos, visitas, **submissão** e recibo. Não é o PrepBid. O anúncio no Diário da República indica qual usar. No **PrepBid** a ficha do concurso aponta o canal; a **carteira** guarda o prazo. A dúvida «posso entregar no PrepBid?» Não.\n\n## O que validar dias antes do prazo?\n\nCredenciais, certificados de assinatura, perfil da empresa na plataforma, espaço para ficheiros, fuso e hora de fecho. Um go na carteira sem login testado é um no-go disfarçado. As **alertas** Pro (7 e 2 dias) existem para esta margem — se a linha estiver na carteira. **«Agir esta semana»** torna o fecho visível.\n\n## Que erros excluem ou impedem a entrega?\n\nPlataforma errada, submissão depois da hora, ficheiro rejeitado, assinatura inválida, caução não carregada. A pressa é o contexto. O **radar** e o **perfil** não substituem o ensaio de login.\n\n## Qual é a relação com o PrepBid?\n\nA plataforma é o balcão *deste* procedimento. O PrepBid é a mesa de triagem (radar, prazos, carteira). Não misture os dois.\n\n## O que o PrepBid não faz?\n\nNão submete na Vortal. No Business pode haver rascunho .docx; a submissão é sempre manual. Confirme as instruções da plataforma. Não é aconselhamento jurídico. Conta grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Posso entregar a proposta no PrepBid?",
        answer: "Não. A entrega é na plataforma electrónica indicada no anúncio. O PrepBid não submete por si.",
      },
      {
        question: "O PrepBid submete a proposta na Vortal?",
        answer: "Não. A submissão é sempre manual na plataforma. O PrepBid ajuda a escolher o concurso, o prazo e, no Business, um rascunho .docx.",
      },
      {
        question: "Onde vejo qual plataforma usar?",
        answer: "No anúncio e na ficha do concurso no PrepBid. Confirme sempre o texto oficial: a plataforma errada perde o prazo.",
      }
    ],
  },
  {
    slug: "prazos-em-concursos-publicos-como-nao-perder",
    title: "Prazos em concursos públicos: como não perder a proposta",
    description:
      "Prazos de propostas, esclarecimentos e visitas: trabalhe para trás a partir da data limite. No PrepBid «agir esta semana» e a carteira existem para não viver todos os anúncios em urgência.",
    lede:
      "O prazo da proposta é inegociável na plataforma: trabalhe para trás com margem para esclarecimentos e caução. Quem só vê o anúncio na véspera já perdeu — mesmo com um preço excelente no papel.",
    intent: "comercial",
    tags: ["prazos", "carteira", "radar"],
    markdown: "## Porque se perdem propostas «boas»?\n\nPorque o prazo da **plataforma** não negocia. Esclarecimentos, visitas, caução e assinatura comem dias. Quem só vê o anúncio na véspera já perdeu. A dúvida «o prazo do anúncio e o da plataforma podem diferir?» Trabalhe com a hora da plataforma. Em dúvida, a plataforma manda para a entrega.\n\n## Que prazos mapear no dia 1 do go?\n\nPropostas, esclarecimentos, visitas ao local, caução, validade da proposta. Escreva na linha da **carteira**. A data vem no anúncio; o processo (carteira, **alertas**, **«agir esta semana»**) é no **PrepBid**.\n\n## Qual é a checklist operacional?\n\n**Perfil** a cortar o que não é para si → **radar** → Hoje → go na carteira → pasta e preço → submissão com margem. Sem o primeiro corte, todos os prazos parecem iguais e a equipa afoga-se.\n\n## Como não viver em urgência permanente?\n\nEstreite o perfil (CPV, distritos, valor). Use o radar de renovações para trabalhar *antes* do anúncio. Os lembretes Pro (7 e 2 dias) só existem para itens na carteira em Interessa / Em preparação.\n\n## O que o PrepBid não faz?\n\nNão pára o relógio da plataforma. Confirme peças. Não é aconselhamento jurídico. Conta grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "O que é a lista «agir esta semana» no PrepBid?",
        answer: "Oportunidades com prazo a menos de 30 dias, já cortadas pelo perfil. É o ecrã de manhã no PrepBid.",
      },
      {
        question: "Os lembretes de prazo são automáticos?",
        answer: "No Pro, a 7 e 2 dias, para itens na carteira em Interessa / Em preparação. Sem linha na carteira, não há lembrete.",
      },
      {
        question: "O prazo no anúncio e na plataforma podem diferir?",
        answer: "Trabalhe com a hora da plataforma indicada no anúncio. Em dúvida, a plataforma manda para a entrega.",
      }
    ],
  },
  {
    slug: "preco-anormalmente-baixo-o-que-significa",
    title: "Preço anormalmente baixo: o que significa na prática",
    description:
      "Propostas com preço anormalmente baixo podem ir a justificação ou exclusão. Verifique as peças; no PrepBid o histórico de rácio adjudicado/preço base dá contexto de mercado, não a regra deste concurso.",
    lede:
      "Um preço muito abaixo do referencial pode desencadear pedido de justificação ou exclusão se não for fundamentado. Não há um desconto mágico universal. O que manda é este procedimento — o histórico público só dá contexto.",
    intent: "informativa",
    tags: ["preco", "criterios", "proposta"],
    markdown: "## O que está em jogo?\n\nO CCP e o programa podem tratar **preço anormalmente baixo**: pedido de justificação, exclusão se a justificação não colher. A dúvida «qual é a percentagem?» Não há um número único para todos os procedimentos. Leia o programa. Copiar «22 % abaixo porque o histórico mostrou isso» é estatística de mercado, não a sua estrutura de custos.\n\n## Como se preparar na proposta?\n\nConheça a conta de custos. Se o preço está agressivo, tenha memória de custos, subempreitadas e produtividades para justificar. Não copie um desconto. Uma justificação não salva sempre: se a entidade a considerar insuficiente, pode excluir.\n\n## Para quem analisa o mercado?\n\nO rácio adjudicado/preço base na ficha PrepBid (previsão de fecho no Business) explica o que o mercado tem fechado. Não substitui o critério nem a análise do júri. O **radar** continua a servir para não orçamentar concursos irrelevantes: preço anormalmente baixo é um problema *depois* do go na **carteira**.\n\n## O que este guia não faz?\n\nNão define o limiar legal do seu concurso. Não aconselha a baixar o preço. Confirme peças e jurista. **«Agir esta semana»** e **alertas** não avaliam o seu preço.\n\n## O PrepBid avisa se o meu preço é anormalmente baixo?\n\nNão avalia a sua proposta. Mostra intervalos históricos (Business) para a decisão comercial go/no-go. Conta grátis, sem cartão. Não é aconselhamento jurídico.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Qual é a percentagem que torna o preço anormalmente baixo?",
        answer: "Não há um número único para todos os procedimentos. Leia o programa e o CCP aplicável. O histórico no PrepBid é contexto, não o limiar.",
      },
      {
        question: "O PrepBid avisa se o meu preço é anormalmente baixo?",
        answer: "Não avalia a sua proposta. Mostra intervalos históricos de adjudicação (Business) para a decisão comercial go/no-go.",
      },
      {
        question: "Uma justificação salva sempre o preço?",
        answer: "Não. Se a entidade considerar a justificação insuficiente, pode excluir. Trabalhe com o seu apoio jurídico.",
      }
    ],
  },
  {
    slug: "prr-e-concursos-publicos-o-que-muda-na-pratica",
    title: "PRR e concursos públicos: o que muda (e o que o CCP não dispensa)",
    description:
      "Procedimentos ligados ao PRR continuam a ser CCP: peças, prazos e habilitação. No PrepBid trate-os no radar como os outros, com o perfil a cortar energia e infraestruturas relevantes — sem o mito do atalho europeu.",
    lede:
      "Concursos associados ao PRR continuam a ser procedimentos CCP: leia peças, prazos e habilitação. O financiamento europeu não elimina formalidades nem paga a exclusão formal.",
    intent: "comercial",
    tags: ["prr", "prazos", "energia"],
    markdown: "## O que muda — e o que não muda?\n\nPode mudar o calendário político, o volume em energia e infraestruturas, e a pressão de executar. **Não muda** a lógica do CCP: tipo de procedimento, habilitação, critérios, plataforma, exclusões formais. A dúvida «é PRR, portanto é mais fácil?» Não. Tratar «é PRR» como atalho é o erro.\n\n## O que verificar nas peças?\n\nFonte de financiamento, prazos de execução curtos, certificações, lotes, caução. O mesmo guião, com menos folga. No **PrepBid**, primeiro o **perfil** (CPV, distrito, valor); depois a ficha e a **carteira**. **«Agir esta semana»** apanha prazos curtos.\n\n## Como priorizar no radar?\n\nDeixe o radar aplicar o perfil. Se a empresa é de eficiência energética, os CPV certos já apanham o volume. Não há um interruptor mágico «só PRR». O objecto manda. Confirme o texto oficial na ficha e nas peças.\n\n## Qual é o risco comercial?\n\nExecutar tarde, caução pesada, critérios de qualidade que a PME não evidencia. A análise de IA (Pro) lista red flags. **Alertas** se o go existir.\n\n## O que este guia não é?\n\nNão é aconselhamento jurídico nem sobre fundos. Conta PrepBid grátis, sem cartão.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Os concursos PRR têm regras próprias de habilitação?",
        answer: "Podem ter exigências extra nas peças, mas não dispensam o CCP. Leia o procedimento concreto.",
      },
      {
        question: "Como filtro concursos PRR no PrepBid?",
        answer: "Não há um interruptor mágico «só PRR». Há perfil (CPV, distritos, valor) e o radar. O objecto manda.",
      },
      {
        question: "O PrepBid identifica automaticamente os procedimentos PRR?",
        answer: "Não há um interruptor «só PRR». Há perfil e radar. Confirme o texto oficial na ficha e nas peças.",
      }
    ],
  },
  {
    slug: "radar-de-oportunidades-vs-abrir-o-base-todos-os-dias",
    title: "Radar PrepBid vs varrer a lista nacional todos os dias",
    description:
      "Tratar a lista nacional como inbox gasta horas. O radar do PrepBid aplica CPV, distritos e valor e devolve o que agir esta semana — perfil, carteira e alertas, não uma pesquisa manual sem filtro.",
    lede:
      "Uma lista nacional sem perfil gasta horas: a equipa lê títulos, abre PDFs e descobre tarde que o alvará ou o distrito não batem. O inbox da empresa é o radar do PrepBid.",
    intent: "comercial",
    tags: ["radar", "perfil", "prepbid"],
    markdown: "## Qual é o custo real de uma lista nacional sem perfil?\n\nSem perfil, a lista mistura limpezas, papelaria, obras pesadas e dispositivos médicos. Isso não é diligência — é **ruído**. A dúvida que traz gente a este artigo é «não estou a ser menos rigoroso se não vir tudo?» O rigor está em ler o caderno dos *sim*, não em abrir cem PDFs de *não*.\n\n## O que o radar do PrepBid faz?\n\nAplica o **perfil**: CPV, distritos, intervalo de valor, termos e entidades a excluir. Destaca prazos na lista **«agir esta semana»**. Mostra **renovações** estimadas a partir dos contratos em curso. Liga concorrentes, entidades e **carteira**. Não substitui ler o caderno. Substitui a primeira hora perdida a caçar o que não é para si. **Alertas** nos gos.\n\n## Quando ainda vale ir às peças oficiais à mão?\n\nUma peça em falta na plataforma, uma dúvida pontual no caderno. Excepção, não rotina. O radar e a ficha já estão no PrepBid.\n\n## Qual é o modelo híbrido que funciona?\n\nPerfil → radar → triagem 15–30 min no Hoje → go/no-go na carteira → peças só nos «sim» → plataforma. Digest de segunda (grátis) no email. Conta sem cartão; teste Pro 7 dias nos planos.\n\n## Preciso de IA para filtrar?\n\nNão. Os filtros do perfil já cortam a maior parte do ruído. A análise de IA (Pro) é para o caderno dos «sim». Confirme CCP e peças. Não é aconselhamento jurídico.\n\n## O que fazer esta semana, na prática?\n\nAbra o **PrepBid**. Confirme que o **perfil** (CPV, distritos, valor) ainda descreve a empresa. Percorra **«agir esta semana»** e a **carteira**: o que fecha, o que está em preparação, o que é renovação. Só depois abra peças na plataforma. Este hábito — e não uma lista de campos noutro sítio — é o que separa a PME que concorre com calma da que chega à sexta em pânico.\n\nSe a dúvida persistir (habilitação, critério, prazo), trate-a no go da carteira com as peças à frente, não com um título de anúncio. Use as **alertas** se a linha já existir. Conta grátis, sem cartão. Confirme o CCP. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Onde filtro concursos todos os dias?",
        answer: "No radar do PrepBid, com o perfil da empresa (CPV, distritos, valor). A lista «agir esta semana» é o inbox.",
      },
      {
        question: "Preciso de IA para filtrar concursos?",
        answer: "Não. Os filtros do perfil (CPV, distrito, valor) já cortam a maior parte do ruído. A análise de IA (Pro) é para o caderno dos «sim».",
      },
      {
        question: "Quanto tempo se poupa?",
        answer: "O ganho está nas horas não gastas em cadernos errados e na janela de renovação antes do anúncio. A lista «agir esta semana» é o teste diário.",
      }
    ],
  },
  {
    slug: "renovacao-de-contratos-publicos-quando-contactar",
    title: "Renovação de contratos públicos: quando contactar a entidade",
    description:
      "A janela útil de contacto é meses antes do anúncio, não no dia em que o concurso sai. No PrepBid o radar de renovações estima o fim do contrato a partir das datas públicas e sugere quando falar com a entidade — sem uma ficha de campos para preencher noutro sítio.",
    lede:
      "Quando o anúncio sai, o incumbente já está a trabalhar a proposta. Em obras, energia e saúde o objecto repete-se. Quem espera pelo concurso joga o jogo do prazo curto. A pergunta certa não é «que campos consultar num portal»: é quando falar, o que dizer, e como o PrepBid estima essa janela.",
    intent: "comercial",
    tags: ["renovacoes", "radar", "entidades"],
    markdown: "## Porque o anúncio chega tarde demais?\n\nPorque o ciclo real começa meses antes. Há um contrato em curso, uma data de fim estimada, uma entidade que já conhece um fornecedor, e uma equipa interna a preparar peças. Quando o procedimento abre, o prazo é curto e o incumbente tem memória de custos. Esperar pelo anúncio não é prudência: é chegar depois.\n\nA dúvida honesta das PME: «se eu contactar agora, não estou a pedir um ajuste direto ilegal?» Contactar para dizer que executa aquele objecto naquela geografia, que quer ser tido em conta quando o procedimento abrir, e que tem referências públicas no mesmo CPV, não é pedir um ajuste ilegal. Não prometa o que a lei não permite. Não é argumento jurídico; é presença comercial.\n\nOutra dúvida: «e se não houver concurso aberto — se for consulta ou ajuste?» O radar não adivinha o tipo futuro. Estima **quando**. O histórico da entidade (ajustes repetidos, concursos, lotes) dá o padrão; a conversa adapta-se. O que não se adapta é chegar no dia da publicação.\n\n## Como se estima a janela — sem transformar isto numa lista de campos?\n\nNa prática comercial usa-se a data de celebração e o prazo de execução ou vigência, quando existem, para estimar o fim, e trabalha-se para trás. Muitas equipas usam cerca de quatro meses antes do fim estimado para o primeiro contacto institucional, com ajuste ao sector: uma empreitada não é um fornecimento contínuo de consumíveis. Datas mal preenchidas, adendas e prorrogações partem a conta: trate a data como hipótese de trabalho e confirme na ficha.\n\nNão precisa de um ritual semanal de ir buscar esses campos a um portal público. No **PrepBid** a estimativa e a **data sugerida de contacto** estão no **radar de renovações** e na ficha da entidade, a partir das datas públicas já indexadas. O trabalho da equipa é decidir se o objecto é seu (CPV, distrito, capacidade) e marcar o follow-up.\n\n## O que dizer no contacto — e o que não dizer?\n\nQue executa aquele objecto naquela geografia. Que tem referências verificáveis. Que quer ser considerado quando o procedimento abrir. Não peça para «ficar com o ajuste». Não critique o incumbente com números que não controla. Não envie uma proposta completa para um procedimento que ainda não existe. Um email curto e um follow-up na **carteira** batem uma apresentação genérica.\n\nSe a entidade não responder, isso também é informação. Volte na janela seguinte; não transforme o silêncio em dez telefonemas na véspera do anúncio.\n\n## Como o PrepBid encaixa neste hábito?\n\nO **perfil** garante que as renovações que vê são do seu CPV e geografia. O **radar de renovações** estima o fim e sugere o contacto. **«Agir esta semana»** mistura prazos curtos de concursos abertos *e* o trabalho de renovação que não pode esperar. As **alertas** lembram o que já está na carteira. Sem linha na carteira, não há lembrete — e a renovação volta a ser um Excel órfão.\n\nIsto não substitui conhecer o sector. Um contrato de manutenção anual não se aborda como uma obra de dois anos. Ajuste a janela; não desligue o radar.\n\n## Quais são as limitações honestas?\n\nContratos prorrogados, prazos mal preenchidos no corpus, CPV errados, procedimentos que mudam de aberto para ajuste. O PrepBid não garante que vai haver concurso aberto. Estima o timing. Confirme na ficha e nas peças quando existirem. Conta grátis, sem cartão. Não é aconselhamento jurídico.",
    faq: [
      {
        question: "Como sei quando contactar a entidade antes do próximo concurso?",
        answer: "Pelo radar de renovações do PrepBid, que estima o fim do contrato em curso e sugere uma janela (cerca de quatro meses antes, ajustável ao sector). Marque o follow-up na carteira.",
      },
      {
        question: "O radar garante que vai haver concurso aberto?",
        answer: "Não. Estima o timing. O procedimento pode ser aberto, consulta prévia ou ajuste direto. O histórico da entidade dá o padrão.",
      },
      {
        question: "Devo esperar pelo anúncio oficial para agir?",
        answer: "Não, se o objecto se repete. Esperar pelo anúncio é chegar tarde. «Agir esta semana» no PrepBid inclui concursos com prazo curto e o trabalho de renovação.",
      }
    ],
  },
  {
    slug: "volume-de-negocios-minimo-em-concursos",
    title: "Volume de negócios mínimo: como ler e quando é um no-go",
    description:
      "Requisitos de volume de negócios ou capacidade financeira no programa: evidência e decisão de concorrer. No PrepBid trate-o na triagem da carteira, depois do radar ter filtrado CPV e valor — não no fim da semana de orçamento.",
    lede:
      "O volume de negócios mínimo é um filtro de capacidade financeira: se o programa o exige e não o evidencia, a proposta corre risco de exclusão. Confirme-o no go da carteira, não depois de orçamentar o mapa.",
    intent: "informativa",
    tags: ["habilitacao", "volume-negocios", "go-no-go"],
    markdown: "## O que é este requisito?\n\nMuitos programas pedem um **volume de negócios** mínimo (global ou na área do concurso) num certo número de anos. É habilitação económica, não um critério de qualidade. Sem evidência nos termos das peças, a proposta cai. A dúvida «o preço base é o volume exigido?» Não. O preço base é o teto do procedimento; o volume mínimo, quando existe, está no programa.\n\nOutra dúvida: «posso somar o grupo?» Só nos termos das peças e do regime aplicável. Não assuma. Confirme com o seu apoio jurídico e o ROC/contabilista.\n\n## Como evidenciar?\n\nContas, certidões, declarações — o que o programa listar, no formato pedido. Agrupamentos podem somar se as peças o permitirem. Não invente números; o júri cruza. Média vs. um único ano, IVA, volume «na área do objecto» vs. global, datas de encerramento de contas: leia a frase do programa, não o hábito.\n\n## Como usar no filtro semanal do PrepBid?\n\nO **radar** já cortou CPV, distrito, valor e prazo. Na triagem de 20 minutos, o volume de negócios é um sim/não. No-go → **carteira** fechada. Não peça à contabilista a pasta para concursos que o **perfil** já deveria ter excluído pelo valor. **«Agir esta semana»** e **alertas** são para os que passam.\n\nO PrepBid não calcula o seu volume de negócios. O histórico do NIF ajuda à narrativa; o requisito está nas peças deste concurso.\n\n## A que deve prestar atenção?\n\nMédia vs. um ano. IVA. Volume na área vs. global. O radar filtra o valor do concurso, não o seu volume interno. Pode constar no contexto da análise de IA se o perfil o disser — a conferência é sua.\n\n## O que este guia não é?\n\nNão é aconselhamento jurídico nem financeiro. Confirme peças e ROC. Conta PrepBid grátis, sem cartão.",
    faq: [
      {
        question: "O preço base do concurso é o volume de negócios exigido?",
        answer: "Não. O preço base é o teto do procedimento. O volume mínimo, quando existe, está no programa como requisito de habilitação.",
      },
      {
        question: "O PrepBid sabe se o meu volume chega?",
        answer: "Não automaticamente. O radar filtra valor do concurso; a conferência do requisito é na triagem e na pasta.",
      },
      {
        question: "Posso somar o volume de empresas do grupo?",
        answer: "Só nos termos das peças e do regime aplicável. Não assuma. Confirme com o seu apoio jurídico.",
      }
    ],
  }
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
    if (h2 < 4) throw new Error(`H2 insuficientes: ${g.slug}`);
    if (g.markdown.length < 1600) throw new Error(`markdown curto: ${g.slug}`);
    if (!Array.isArray(g.tags) || g.tags.length < 1 || g.tags.length > 5) throw new Error(`tags: ${g.slug}`);
    if (g.markdown.includes(RESERVED)) throw new Error(`reserva no markdown: ${g.slug}`);
    const reader = [g.title, g.description, g.lede, g.markdown, JSON.stringify(g.faq), g.tags.join(',')].join('\n');
    if (/\bBASE\b/.test(reader) || /base\.gov/i.test(reader)) {
      throw new Error(`nome de portal público no copy do leitor: ${g.slug}`);
    }
    if (!/PrepBid/.test(`${g.lede}\n${g.markdown}`)) throw new Error(`falta PrepBid: ${g.slug}`);
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

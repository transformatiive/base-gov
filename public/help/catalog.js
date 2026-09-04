(function (w) {
  'use strict';

  var locked = {
    title: 'Funcionalidade do plano Pro',
    body: 'Este ecrã está incluído no Pro e no Business. Pode ver os planos ou voltar ao Hoje e aos Concursos, que estão no Grátis.',
  };

  w.BRHelpCatalog = {
    splash: {
      eyebrow: 'Primeiros passos',
      title: 'Quer um onboarding guiado?',
      lead: 'Em dois minutos vê o que o BaseRadar faz. Pode percorrer os menus connosco — ou entrar já na aplicação e receber uma explicação só na primeira visita a cada ecrã.',
      examples: [
        { id: 'hoje', title: 'Hoje', body: 'O que exige atenção hoje: concursos a fechar, carteira com prazo e valor em jogo nos próximos 90 dias.' },
        { id: 'oportunidades', title: 'Oportunidades', body: 'Concursos abertos e renovações, ordenados por score. Adequação IA à sua atividade no plano Pro.', pro: true },
        { id: 'carteira', title: 'Carteira', body: 'Kanban da empresa: Interessa → Em preparação → Submetida. Estados partilhados com a equipa.' },
        { id: 'mapa', title: 'Mapa e sazonalidade', body: 'Onde as entidades compram na sua atividade, e em que meses o mercado se mexe.' },
      ],
      ctaTour: 'Avançar com o onboarding',
      ctaSkip: 'Entrar na aplicação',
      footnote: 'Pode sair a qualquer momento. Em cada ecrã, a primeira visita mostra as zonas principais.',
    },
    menuTour: {
      steps: [
        { href: '#/hoje', title: 'Hoje', body: 'O painel do dia: o que tem prazo, o que está na carteira e o valor em jogo. Comece sempre aqui.' },
        { href: '#/radar/opportunities', feature: 'score_fit', title: 'Oportunidades', body: 'Concursos abertos e renovações da sua atividade, ordenados por score (valor, urgência, recorrência). A adequação IA aparece no plano Pro.' },
        { href: '#/pipeline', feature: 'pipeline', title: 'Carteira', body: 'Mesa de trabalho da empresa. Arraste cartas entre Interessa, Em preparação e Submetida. Os estados são partilhados.' },
        { href: '#/radar/renewals', feature: 'renovacoes', title: 'Renovações', body: 'Contratos a terminar — a janela para contactar o cliente antes do novo procedimento.' },
        { href: '#/radar/announcements', title: 'Concursos', body: 'Anúncios do BASE/DRE na sua atividade, incluindo no plano Grátis. Abra a ficha para prazos, peças e análise IA.' },
        { href: '#/radar/map', title: 'Mapa', body: 'Onde as entidades adjudicantes compram na sua área. Clique num distrito para o detalhe.' },
        { href: '#/radar/seasonality', title: 'Sazonalidade', body: 'Em que meses o mercado da sua atividade costuma abrir procedimentos.' },
        { href: '#/radar/competitors', feature: 'concorrentes', title: 'Concorrentes', body: 'Quem ganha os contratos no seu perfil: quota, volume e entidades em comum.' },
        { href: '#/entities', feature: 'entidades', title: 'Entidades', body: 'Ficha de adjudicantes e adjudicatários: histórico, CPV e ligações.' },
        { href: '#/config', title: 'Configuração', body: 'Perfis de atividade (termos e CPV), recolhas e dados abertos. É isto que alimenta o radar.' },
      ],
    },
    screens: {
      hoje: {
        lockedFallback: null,
        steps: [
          { sel: 'hoje-head', title: 'O seu dia', body: 'Cumprimento, prazos a agir e a actividade seleccionada. Se a primeira recolha ainda corre, os números vão aparecendo.', placement: 'bottom' },
          { sel: 'hoje-ctx', title: 'Actividade', body: 'Troque o perfil (termos e CPV) sem sair do Hoje. Cada perfil tem o seu radar.', placement: 'bottom' },
          { sel: 'hoje-agir', title: 'Agir esta semana', body: 'Concursos e renovações com prazo até 30 dias. Abra a ficha ou as peças do procedimento.', placement: 'right' },
          { sel: 'hoje-injogo', title: 'Em jogo', body: 'Valor dos procedimentos nos próximos 90 dias. O mapa ao lado mostra onde está o dinheiro.', placement: 'left' },
          { sel: 'hoje-pipe', title: 'No pipeline', body: 'Itens da carteira com prazo próximo. Só aparece quando há cartas a acompanhar.', placement: 'top' },
          { sel: 'hoje-mapa', title: 'Mapa do dia', body: 'Atalho para o mapa da atividade — onde está o valor em jogo.', placement: 'left' },
        ],
      },
      oportunidades: {
        lockedFallback: locked,
        steps: [
          { sel: 'opp-title', title: 'Oportunidades', body: 'Lista combinada de concursos abertos e renovações, ordenada por score.', placement: 'bottom' },
          { sel: 'opp-filters', title: 'Filtros', body: 'Objecto, entidade, distrito e prazo. Valor, CPV e tipo de procedimento são Pro.', placement: 'bottom' },
          { sel: 'opp-matrix', title: 'Matriz', body: 'Cima-esquerda = agir já (valor alto, prazo curto). Cor = fit IA quando existir.', placement: 'bottom' },
          { sel: 'opp-table', title: 'Lista', body: 'Score, fit, data-chave. Clique a linha para a ficha. O estado passa o item para a carteira.', placement: 'top' },
        ],
      },
      carteira: {
        lockedFallback: locked,
        steps: [
          { sel: 'pl-title', title: 'Carteira', body: 'Mesa de trabalho da empresa. Os estados são os mesmos para toda a equipa.', placement: 'bottom' },
          { sel: 'pl-board', title: 'Kanban', body: 'Três colunas abertas. Arraste a carta para mudar o estado.', placement: 'bottom' },
          { sel: 'pl-col-interessa', title: 'Interessa', body: 'Caixa de entrada. Daqui passa a Em preparação quando for avançar.', placement: 'right' },
          { sel: 'pl-closed', title: 'Fechadas', body: 'Ganha, perdida, descartada e outras — fora do quadro principal.', placement: 'top' },
        ],
      },
      renovacoes: {
        lockedFallback: locked,
        steps: [
          { sel: 'ren-title', title: 'Renovações', body: 'Contratos do seu perfil a aproximar-se do fim. Use a data de contactar e abra a ficha do contrato.', placement: 'bottom' },
          { sel: 'ren-filters', title: 'Filtros', body: 'Aperte a lista por distrito, prazo ou entidade (avançados no Pro).', placement: 'bottom' },
          { sel: 'ren-table', title: 'Lista', body: '«Termina» é uma estimativa (celebração + prazo de execução). O estado envia o contrato para a carteira.', placement: 'top' },
        ],
      },
      concursos: {
        lockedFallback: null,
        steps: [
          { sel: 'ann-title', title: 'Concursos', body: 'Anúncios do BASE e do DRE na sua atividade. O plano Grátis inclui esta lista.', placement: 'bottom' },
          { sel: 'ann-filters', title: 'Filtros', body: 'Distrito e prazo estão no Grátis. Valor, CPV, entidade e tipo de procedimento são Pro.', placement: 'bottom' },
          { sel: 'ann-table', title: 'Lista', body: 'Clique a linha para a ficha: prazos, peças, análise IA e carteira.', placement: 'top' },
        ],
      },
      mapa: {
        lockedFallback: null,
        steps: [
          { sel: 'map-canvas', title: 'Mapa', body: 'Cada distrito soma contratos da atividade. Clique para entidades e procedimentos desse território.', placement: 'bottom' },
          { sel: 'map-legend', title: 'Período', body: 'Filtre por mês ou veja todo o período. A dimensão do círculo é o valor contratado.', placement: 'bottom' },
        ],
      },
      sazonalidade: {
        lockedFallback: null,
        steps: [
          { sel: 'sea-chart', title: 'Sazonalidade', body: 'Distribuição mensal de contratos e anúncios. Serve para planear capacidade, não para prever um concurso concreto.', placement: 'bottom' },
        ],
      },
      concorrentes: {
        lockedFallback: locked,
        steps: [
          { sel: 'cmp-table', title: 'Concorrentes', body: 'Ranking de adjudicatários no seu perfil: quota, volume e principais clientes. Clique para a ficha da entidade.', placement: 'bottom' },
        ],
      },
      entidades: {
        lockedFallback: locked,
        steps: [
          { sel: 'ent-tabs', title: 'Adjudicantes e adjudicatárias', body: 'Compradores públicos de um lado, fornecedores do outro.', placement: 'bottom' },
          { sel: 'ent-search', title: 'Pesquisa', body: 'Nome ou NIF. Abra o histórico, CPV e contratos recentes.', placement: 'bottom' },
          { sel: 'ent-table', title: 'Lista', body: 'Clique uma linha para a ficha da entidade.', placement: 'top' },
        ],
      },
      config: {
        lockedFallback: null,
        steps: [
          { sel: 'cfg-tabs', title: 'Configuração', body: 'Perfis de atividade, recolhas do site e dados abertos.', placement: 'bottom' },
          { sel: 'cfg-profiles', title: 'Perfis', body: 'Um perfil = uma atividade (palavras-chave + CPV). Sem perfil não há radar no Hoje. Crie outro se tiver várias linhas de negócio.', placement: 'bottom' },
        ],
      },
      ficha: {
        lockedFallback: null,
        steps: [
          { sel: 'ficha-tabs', title: 'Separadores', body: 'Análise IA, Enquadramento, Carteira, Cronologia e Formalidades. Mude de separador sem sair da ficha.', placement: 'bottom' },
          { sel: 'ficha-ia', title: 'Análise IA', body: 'Go / no-go, fit, habilitação e checklist. A checklist precisa das peças; o anúncio do DRE sozinho não chega.', placement: 'bottom' },
          { sel: 'ficha-carteira', title: 'Carteira nesta ficha', body: 'Estado na carteira da empresa, nota e responsável. Partilhado com a equipa.', placement: 'bottom' },
        ],
      },
      conta: {
        lockedFallback: null,
        steps: [
          { sel: 'acct-plan', title: 'Plano', body: 'Plano actual, trial, faturas e gestão da subscrição.', placement: 'bottom' },
          { sel: 'acct-seats', title: 'Equipa', body: 'Lugares e convites. O tecto conta membros e convites pendentes.', placement: 'bottom' },
          { sel: 'acct-profile', title: 'Perfil da empresa', body: 'Certificações, distritos, intervalo de valor e exclusões — alimentam o fit de IA.', placement: 'top' },
        ],
      },
    },
  };
})(window);

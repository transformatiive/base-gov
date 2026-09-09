(function (w) {
  'use strict';
  w.BRQaChecklist = {
    title: 'Checklist de validação',
    intro: 'Percorra a aplicação e marque o que confirma. Os links abrem o ecrã correspondente. O estado fica neste browser (não é enviado ao servidor).',
    groups: [
      {
        id: 'gratis',
        title: 'Plano Grátis — o que já deve funcionar',
        items: [
          { id: 'g-registo', href: '#/registo', label: 'Registo com termos/CPV cria perfil diário e abre o Hoje', expect: 'Após criar conta, o Hoje carrega (não fica vazio à espera do BASE).' },
          { id: 'g-hoje', href: '#/hoje', label: 'Hoje: Agir / pipeline do dia / Em jogo', expect: 'Há cumprimento, select de atividade e blocos à esquerda e à direita.' },
          { id: 'g-concursos', href: '#/radar/announcements', label: 'Concursos: lista + filtros distrito/prazo', expect: 'Filtros de texto, distrito e prazo; valor/CPV com cadeado.' },
          { id: 'g-mapa', href: '#/radar/map', label: 'Mapa: distritos clicáveis', expect: 'Círculos no mapa; clique abre detalhe do distrito.' },
          { id: 'g-sazo', href: '#/radar/seasonality', label: 'Sazonalidade: gráficos mensais', expect: 'Barras por mês de contratos e anúncios.' },
          { id: 'g-carteira', href: '#/pipeline', label: 'Carteira: colunas Interessa / Em preparação / Submetida', expect: 'Kanban visível (pode estar vazio). Arrastar muda o estado.' },
          { id: 'g-digest', href: '#/digest', label: 'Resumo semanal (página)', expect: 'Página HTML do digest; o envio de email é à segunda 08:00 se o mail estiver configurado.' },
          { id: 'g-config', href: '#/config', label: 'Configuração: criar perfil termos+CPV', expect: 'Formulário Novo perfil e tabela de perfis.' },
          { id: 'g-conta', href: '#/conta', label: 'Conta: plano Grátis, 1 lugar, perfil da empresa', expect: 'Plano Grátis; convite bloqueado no 2.º lugar; bloco certificações/distritos.' },
        ],
      },
      {
        id: 'pro',
        title: 'Plano Pro — o que o cadeado deve abrir',
        items: [
          { id: 'p-opp', href: '#/radar/opportunities', label: 'Oportunidades: score, fit, matriz, filtros avançados', expect: 'Lista com score; filtros de valor/CPV/entidade activos; matriz se houver ≥2 pontos.' },
          { id: 'p-fit-fb', href: '#/radar/opportunities', label: 'Fit IA: 👍/👎 com motivo', expect: 'No chip de fit, popover Útil / motivos; grátis mostra cadeado.' },
          { id: 'p-ren', href: '#/radar/renewals', label: 'Renovações: termina + contactar até', expect: 'Tabela com datas e estado da carteira.' },
          { id: 'p-ted', href: '#/radar/announcements', label: 'TED (concursos europeus) na página de Concursos', expect: 'Bloco TED abaixo da lista; no Grátis, painel de upgrade.' },
          { id: 'p-comp', href: '#/radar/competitors', label: 'Concorrentes: quota e clientes', expect: 'Tabela de quota; clique abre entidade.' },
          { id: 'p-ent', href: '#/entities', label: 'Entidades: adjudicantes / adjudicatárias + pesquisa', expect: 'Toggle e pesquisa por nome/NIF.' },
          { id: 'p-ficha', href: '#/radar/announcements', label: 'Ficha: Análise IA, checklist, carteira, formalidades', expect: 'Abrir um anúncio: separadores IA / Enquadramento / Carteira / Formalidades (DEUCP).' },
          { id: 'p-lembretes', href: '#/conta', label: 'Conta: opt-in de digest e lembretes 7/2 dias', expect: 'Bloco Notificações; lembretes só no Pro.' },
          { id: 'p-excel', href: '#/radar/opportunities', label: 'Exportação Excel (quando o ecrã a expõe)', expect: 'Botão de exportar visível no Pro; 403 no Grátis.' },
        ],
      },
      {
        id: 'regras',
        title: 'Perfil da empresa e regras de fit',
        items: [
          { id: 'r-onboard', href: '#/hoje', label: 'Wizard de 4 perguntas após o primeiro registo', expect: 'Distritos, certificações, valor, exclusões; Saltar fecha sem gravar.' },
          { id: 'r-conta', href: '#/conta', label: 'Editar perfil da empresa em Conta', expect: 'Gravar distritos/certificações altera o fit (regra visível no chip).' },
          { id: 'r-geo', href: '#/radar/opportunities', label: 'Fora da geografia: cap e texto «Regra:»', expect: 'Com distritos preenchidos, um concurso noutro distrito não passa do tecto.' },
        ],
      },
      {
        id: 'onboarding',
        title: 'Onboarding e guias (esta entrega)',
        items: [
          { id: 'o-splash', href: '#/hoje', label: 'Splash após o wizard: onboarding vs entrar na app', expect: 'Só no primeiro registo. «Avançar com o onboarding» percorre os menus; «Entrar na aplicação» salta o tour.' },
          { id: 'o-tour', href: '#/hoje', label: 'Tour dos menus: Seguinte / Anterior / Sair', expect: 'Pop-up em cada item da nav; cadeado nos ecrãs Pro; Escape sai.' },
          { id: 'o-screen', href: '#/hoje', label: 'Primeira visita a cada ecrã explica as zonas', expect: 'Hoje, Concursos, Carteira, etc. Sair marca o ecrã como visto. Recarregar não repete.' },
          { id: 'o-ajuda', href: '#/ajuda', label: 'Ajuda: manual + repetir demonstração', expect: 'FAB tem tab Manual; #/ajuda lista capítulos; botões para repetir o tour ou este ecrã.' },
        ],
      },
      {
        id: 'ainda-nao',
        title: 'Ainda fora de âmbito (não marcar como falha)',
        items: [
          { id: 'x-alerta', href: '#/digest', label: 'Email no instante em que sai um concurso', expect: 'Não existe. Só digest de segunda 08:00.' },
          { id: 'x-espd', href: '#/radar/announcements', label: 'Wizard ESPD / DEUCP preenchível', expect: 'Só texto na tab Formalidades.' },
          { id: 'x-vortal', href: '#/radar/announcements', label: 'Submissão autenticada no Vortal', expect: 'Só o link «abrir na plataforma».' },
          { id: 'x-pdf', href: '#/radar/opportunities', label: 'PDF da ficha para partilhar', expect: 'Não existe. Excel no Pro.' },
          { id: 'x-base', href: '#/config', label: 'Pesquisa nativa no BASE com todos os filtros oficiais', expect: 'O scraper continua a pesquisar por termos/CPV; os filtros actuam no corpus já importado.' },
        ],
      },
    ],
  };
})(window);

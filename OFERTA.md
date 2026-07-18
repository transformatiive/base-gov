# BaseRadar — Oferta

> **Inteligência comercial de contratos públicos.** O BaseRadar transforma os dados oficiais do Portal BASE, do Diário da República e do TED num radar de vendas: diz a uma empresa **que contratos públicos vai poder ganhar, quando, por quanto — e o que preparar para vencer**, antes de o concurso abrir.

---

## 1. Em uma frase

Uma aplicação web que cruza o histórico completo da contratação pública portuguesa com a atividade da tua empresa e devolve um **plano de ação comercial diário**: oportunidades priorizadas, renovações previsíveis, análise de concursos por IA e inteligência sobre concorrentes e compradores.

## 2. Para quem é (ICP)

PME e empresas que **vendem ao Estado** (municípios, hospitais, universidades, empresas públicas) e que hoje descobrem os concursos tarde, um a um, sem contexto:

- Fornecedores de bens e serviços recorrentes a autarquias e entidades públicas.
- Empresas com equipa comercial pequena que não consegue vigiar o BASE/DR todos os dias.
- Setores com forte componente de **renovação** (contratos plurianuais que voltam a concurso).

Exemplos de atividade: pirotecnia e eventos, construção e manutenção, material médico, limpeza, catering, TI, formação, etc. — qualquer atividade descritível por **palavras-chave** e **códigos CPV**.

## 3. O problema que resolve

- **Descoberta tardia:** quando o concurso sai no Diário da República já há pouco tempo para preparar uma boa proposta.
- **Ruído:** milhares de contratos e anúncios; difícil separar o que interessa do que não interessa.
- **Falta de contexto:** não basta ver o anúncio — é preciso saber os critérios, requisitos de habilitação, riscos e se vale a pena competir.
- **Cegueira sobre renovações:** a maior parte do negócio público é recorrente, mas ninguém avisa quando um contrato em curso está prestes a terminar.
- **Concorrência opaca:** quem ganha o quê, com que quota, a que preço médio — informação dispersa e difícil de consolidar.

## 4. Proposta de valor

1. **Antecipar** — prever renovações meses antes de o concurso reabrir ("antes do concurso abrir").
2. **Priorizar** — um score 0-100 por oportunidade (valor, urgência, recorrência) e um *fit* por IA face à atividade da empresa.
3. **Preparar** — a IA lê o caderno de encargos e devolve go/no-go, critérios, requisitos, red flags e um dossier de resposta.
4. **Competir melhor** — inteligência sobre concorrentes e compradores para escolher onde atacar.

---

## 5. Funcionalidades

### 5.1 Hoje — painel diário de ação
Página de entrada. Agrega tudo num plano do dia:
- **Agir esta semana** — oportunidades com prazo < 30 dias (score em donut, chip concurso/renovação, ações "Analisar com IA" / "Ver peças").
- **Preparar** — renovações a 1-6 meses, com data sugerida de contacto e valor.
- **Monitorizar** — oportunidades a mais de 6 meses.
- Painel **"Em jogo · próximos 90 dias"** (valor total + KPIs), **"Onde está o dinheiro"** (top distritos) e **"Concorrência"** (líder da área e quota).

### 5.2 Oportunidades priorizadas
- **Matriz de priorização** (dispersão valor × prazo; cima-esquerda = agir já).
- Tabela com **barra de score**, **fit IA**, tipo (concurso aberto / renovação), entidade, valor e **data-chave** (a vermelho quando urgente).
- **Score 0-100:** concursos abertos = 25 base + até 35 (valor, escala log) + até 40 (urgência do prazo); renovações = até 35 (valor) + até 30 (proximidade do fim) + até 15 (recorrência da entidade).
- **Fit IA** calculado automaticamente para oportunidades nos próximos 12 meses.

### 5.3 Radar de renovações
Contratos em curso cujo **fim previsto** cai nos próximos 12 meses — estimado a partir do BASE (data de celebração + prazo de execução). Mostra fornecedor atual, entidade, valor e **data sugerida de contacto** (~4 meses antes do fim). É o diferenciador central: agir *antes* do próximo procedimento.

### 5.4 Concursos abertos (anúncios DR) + TED
- Anúncios com prazo de propostas a decorrer, recolhidos do Portal BASE.
- Painel **"Concursos europeus (TED)"** — concursos acima dos limiares UE e oportunidades cross-border, via API aberta do Tenders Electronic Daily.
- **Acordos-quadro** sinalizados com badge **"AQ"** (canal de contratação centralizada).

### 5.5 Mapa e sazonalidade
- **Mapa por distrito** com timeline (histórico por publicação ou futuro por fim de contrato) — onde se concentra o dinheiro e as renovações.
- **Sazonalidade** — em que meses se contrata, para planear a prospeção com antecedência.

### 5.6 Concorrentes (inteligência competitiva)
Adjudicatários com contratos na atividade, **consolidados por NIF** (nome canónico), com barra de **quota**, valores médios e principais clientes. A própria empresa aparece destacada.

### 5.7 Entidades (compradores e fornecedores)
Ficha por entidade com KPIs, **contratos recentes**, **como compra/vende**, **fornecedores/clientes habituais**, **próxima janela** de renovação e **sinais** derivados (tendência em crescimento/declínio, concentração de clientes, e — para adjudicatárias — um **"sinal de abertura"** quando o incumbente está vulnerável).

### 5.8 Detalhe de contrato / anúncio
Ficha completa: partes e enquadramento, documentos (com estado guardado/pendente), painel de preço e fim previsto, **cronologia** (publicação → celebração → contacto sugerido → fim) e **modificações ao contrato** (adendas/prorrogações; badge "contrato modificado +X%"). Ligações à entidade, à plataforma e ao DR.

### 5.9 Análise por IA (go/no-go)
Por concurso ou renovação, a IA produz uma **ficha de oportunidade**:
- Recomendação **GO / CONDICIONAL / NO-GO** com justificação destacada.
- Fit com a atividade (0-100), resumo, **critérios de adjudicação**, prazos, preço base, cauções.
- **Requisitos de habilitação**, **red flags** e **checklist** para a proposta.
- **Dossier de resposta** gerado por IA (documento com placeholders da empresa).
- A análise é **fundamentada nos documentos reais** — a IA descarrega as **peças do procedimento** (caderno de encargos/programa) da plataforma e o **texto oficial do anúncio no DR**. O resultado fica guardado (só paga uma vez por análise).

### 5.10 Digest semanal
Resumo por email (rascunho no Gmail / versão web): novos concursos, renovações a entrar na janela de contacto e o essencial da semana.

---

## 6. Como funciona

1. **Registo (grátis, sem cartão)** — nome, email, empresa e NIF. Pode experimentar o Pro 7 dias a qualquer momento.
2. **Atividade** — palavras-chave e/ou códigos **CPV** (com pesquisa assistida). O radar fica **pré-configurado** em minutos.
3. **Recolha** — o sistema cruza o histórico completo do BASE e vigia as novas publicações (recolha diária).
4. **Radar** — a partir daí, tudo é apresentado no contexto da atividade: oportunidades, renovações, mapa, concorrentes.

Multi-empresa: cada conta vê **apenas os seus** perfis e dados; o corpus público (contratos, entidades, CPV) é partilhado. Preparado para vários utilizadores por empresa.

## 7. Fontes de dados

| Fonte | O que traz |
|---|---|
| **Portal BASE (Base4)** | Anúncios de procedimento (concursos), contratos adjudicados, entidades, documentos |
| **dados.gov.pt / IMPIC** | Histórico completo de contratos (2012–2026), importado em bloco |
| **Diário da República** | Texto oficial do anúncio (PDF) para a análise IA |
| **Plataformas eletrónicas** (AcinGov, Vortal, Saphety, ESPAP) | Peças do procedimento (caderno de encargos/programa) para a análise IA |
| **TED (ted.europa.eu)** | Concursos europeus acima dos limiares UE, por CPV |

## 8. Tecnologia (resumo)

- Backend Node/TypeScript (Fastify), Postgres; scraper resiliente ao anti-bot do BASE (retries).
- SPA vanilla-JS com routing por hash; mapa MapLibre GL.
- IA via OpenRouter (modelos Claude) para análise, fit e dossiers.
- Sessão por cookie assinado; isolamento de dados por empresa; gating de subscrição.
- Deploy contínuo (Railway).

---

## 9. Planos e preço

Três planos, todos sem compromisso — comece grátis e suba quando precisar. Pagamento nacional (Multibanco, MB WAY ou cartão) via **Easypay**; cancele quando quiser.

| Plano | Preço (sem IVA) | Inclui |
|---|---|---|
| **Grátis** | 0 € | Concursos abertos, mapa por distrito, sazonalidade e digest semanal. 1 utilizador. |
| **Pro** | 29 € / mês | Tudo do Grátis + oportunidades com **score e fit IA**, radar de **renovações**, concursos europeus (**TED**), **análise IA** do caderno de encargos + dossier de resposta, **concorrentes** e **entidades**, exportação Excel. **2 utilizadores**. |
| **Business** | 99 € / mês | Tudo do Pro + **equipa até 10 utilizadores** (seats), **uso elevado de IA** e **exportação avançada**. |

- **Experimente o Pro 7 dias grátis, sem cartão** — ao fim do período, a conta volta ao plano Grátis se não subscrever.
- O acesso a cada funcionalidade é validado no servidor pelo plano da conta (o plano é a fonte de verdade).
- O uso de IA é contabilizado por conta (com visibilidade no painel da conta); a contagem é informativa e não bloqueia.

## 10. Diferenciadores

- **Renovações previsíveis** — o radar não mostra só o que já abriu; prevê o que vai abrir.
- **IA fundamentada em documentos reais** — go/no-go com critérios e requisitos citados do caderno de encargos, não só dos metadados.
- **Score + fit** combinam relevância comercial e encaixe na atividade.
- **Inteligência competitiva consolidada por NIF**, com sinais de vulnerabilidade do incumbente.
- **Cobertura nacional + europeia** (BASE + DR + TED) e sinalização de **acordos-quadro**.
- **Pré-configuração em minutos** por CPV/palavras-chave — valor no primeiro dia.

---

## 11. Limitações conhecidas / roadmap

- **Peças do procedimento:** recolhidas em *best-effort*; plataformas que exigem registo podem não ser acessíveis (nesses casos a análise usa o anúncio do DR + dados estruturados).
- **Enriquecimento financeiro de entidades** (capital social, insolvências, rating): a parte acionável (tendência, concentração, sinal de abertura) está entregue a partir do corpus; a saúde financeira auditada exigiria uma fonte paga (Informa D&B / eInforma).
- **Catálogo completo de acordos-quadro da ESPAP:** sinalizados os que passam pelo DR/BASE e TED; a ESPAP não expõe API pública.
- **Antecedência (DRE direto):** garantida sobretudo pelo radar de renovações e pelo TED; o DRE não disponibiliza API JSON aberta utilizável.

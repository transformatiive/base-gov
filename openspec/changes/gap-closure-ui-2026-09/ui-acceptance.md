# Critérios de aceitação validáveis na UI

Fonte canónica: [`SPEC.md`](./SPEC.md) §10. Se este extracto divergir, vence o SPEC.

Como usar: abrir o URL, seguir os passos, marcar Passa / Falha. Sem acesso à API nem à BD. Ambiente: `https://basegov-robot-production.up.railway.app/` (anónimo) e `/app` (sessão).

Planos de teste: **Grátis**, **Pro** (ou trial), **Business** (dois utilizadores). Onde o AC pede Pro, um trial de 7 dias basta.

---

## GTM — Landing e copy (PR 1)

### GTM-01 — Hero fala ao diretor de concursos
- **URL:** `/` (sem login)
- **Passos:** Ler o H1, o lead e o eyebrow.
- **Passa se:** o eyebrow contém «diretor de concursos» ou «obras» / «reabilitação»; o H1 fala de obras municipais / concursos **antes de irem a concurso** (ou equivalente: a tempo de concorrer); o lead menciona alvará **ou** construtora **ou** reabilitação municipal.
- **Falha se:** o H1 ou o lead vendem «a sua atividade» genérica sem sector, ou «festas».

### GTM-02 — Cartão do hero é uma obra municipal, não uma festa
- **URL:** `/`
- **Passos:** Ler os dois cartões de oportunidade no hero.
- **Passa se:** o primeiro cartão é um concurso de **reabilitação / obra / edifício / escola / cobertura / fachada** com valor ≥ 100 000 € e uma câmara/município; o segundo é uma **renovação** de conservação/reabilitação.
- **Falha se:** aparece «Festas da Cidade», «piromusical», «pirotecnia», «Barcelos · Festas», «Grupo Luso Pirotecnia».

### GTM-03 — Business é a oferta da equipa; Pro é o isco
- **URL:** `/#preco`
- **Passos:** Ler os três planos.
- **Passa se:** Grátis 0 €, Pro 29 €, Business 99 €; o cartão **Business** está visualmente destacado (borda/ribbon «A MESA DA EQUIPA» ou equivalente) e o texto fala de **equipa de concursos** / até 10 utilizadores / CRM; o Pro oferece 7 dias grátis e **não** tem ribbon «MAIS POPULAR».
- **Falha se:** o ribbon «MAIS POPULAR» está no Pro e o Business parece um extra irrelevante.

### GTM-04 — Funcionalidades sem pirotecnia
- **URL:** `/#funcionalidades`
- **Passos:** Percorrer os cartões (renovações, concorrentes, digest).
- **Passa se:** as mini-visualizações usam nomes de **obras/câmaras/construtoras**; o digest promete email semanal; existe (ou o copy promete) pipeline ou mesa de trabalho.
- **Falha se:** «Grupo Luso», «Pirotec», «Festas», «pirotecnia».

### GTM-05 — CTA e meta
- **URL:** `/`
- **Passos:** Inspecionar `<title>`, meta description, botões «Começar grátis» / «Entrar».
- **Passa se:** title e description em português europeu, sem «festas»/«pirotecnia»; «Começar grátis» vai para `/app#/registo`; «Entrar» vai para `/app#/login`.

### GTM-06 — Registo já não exemplifica com fogo de artifício
- **URL:** `/app#/registo`
- **Passos:** Ler o parágrafo da atividade e o placeholder do CPV.
- **Passa se:** o exemplo é construção / reabilitação / alvará / CPV de obras.
- **Falha se:** «pirotecnia» ou «fogo de artifício».

---

## Fundações (PR 2)

Fonte canónica dos AC: [`SPEC.md`](./SPEC.md) §10. Este ficheiro é o extracto clicável. Se divergir, vence o SPEC.

### FND-01 — Digest web com datas DD/MM
- **URL:** `/app#/digest` (utilizador com perfil)
- **Passos:** Abrir o digest na app e a «Versão email».
- **Passa se:** prazos e datas de fim aparecem como `DD/MM/AAAA` ou `D/MM/AAAA`, nunca `Wed Jul 29` nem `2026-07-29T…`.

---

## Pipeline (PR 3)

Estados visíveis: **Nova** (omissão), **Interessa**, **Em preparação**, **Submetida**, **Ganha**, **Perdida**, **Descartada**.

### PIP-01 — Chip na lista de oportunidades
- **URL:** `/app#/radar/opportunities` (Pro)
- **Passos:** Numa linha **Nova**, abrir o seletor e escolher «Interessa». Sem recarregar.
- **Passa se:** a linha mostra o chip «Interessa» de imediato; a entrada «Pipeline» na navegação existe; ao abrir `/app#/pipeline` o item está na coluna Interessa.

### PIP-02 — Equipa vê o mesmo estado
- **URL:** `/app#/radar/opportunities` (Business, utilizador B noutro browser)
- **Passos:** A marca Interessa (PIP-01); B recarrega a lista.
- **Passa se:** B vê «Interessa» na mesma linha, sem a ter marcado.

### PIP-03 — Transição proibida visível
- **URL:** ficha da oportunidade já **Submetida**
- **Passos:** Tentar mudar para «Interessa».
- **Passa se:** aparece a mensagem *«Uma proposta submetida só pode passar a Ganha, Perdida ou Descartada»* e o chip continua «Submetida».

### PIP-04 — Descartada é reversível
- **URL:** ficha / lista
- **Passos:** Nova → Descartada → Interessa.
- **Passa se:** volta a Interessa; o histórico na ficha mostra as duas transições com autor e hora.

### PIP-05 — Vista Pipeline
- **URL:** `/app#/pipeline`
- **Passos:** Empresa sem marcas: ver estado vazio. Depois marcar 1 Interessa, 1 Em preparação, 1 Submetida, 1 Descartada.
- **Passa se:** colunas Interessa / Em preparação / Submetida visíveis; Ganha/Perdida/Descartada numa secção **Fechadas** colapsada; cada linha tem prazo, valor; prazo passado em preparação aparece a vermelho com «Prazo ultrapassado» e sugestão «Marcar como Submetida ou Descartada».
- **Estado vazio passa se:** texto a explicar que se marca a partir das listas, com ligação para Oportunidades.

### PIP-06 — Responsável na página Hoje
- **URL:** `/app#/hoje` (dois utilizadores)
- **Passos:** Ana põe Rui como responsável de uma «Em preparação» com prazo ≤ 7 dias.
- **Passa se:** Rui vê o item em **«A minha responsabilidade»**; a secção **«No pipeline»** está **acima** de «Agir esta semana».

### PIP-07 — Hoje não inventa secção vazia
- **URL:** `/app#/hoje`
- **Passos:** Empresa com pipeline mas nenhum prazo nos próximos 14 dias.
- **Passa se:** a secção «No pipeline» **não** aparece.

### PIP-08 — Checklist na ficha
- **URL:** `/app#/announcements/{id}` com análise IA já gerada, estado Em preparação
- **Passos:** Marcar 3 de 6 itens da checklist.
- **Passa se:** a ficha mostra «3/6 · 50 %»; `/app#/pipeline` mostra a mesma percentagem; outro utilizador vê os mesmos 3 ticks.
- **Sem análise:** a secção diz «Gere a análise de IA para obter a checklist de preparação» — sem erro.

---

## Perfil da empresa e regras de fit (PR 4)

### PRF-01 — Onboarding saltável a 4 passos
- **URL:** imediatamente após `/app#/registo` bem-sucedido
- **Passos:** Ver o assistente. Saltar. Ir a Conta.
- **Passa se:** 4 perguntas (onde executa, certificações, intervalo de valor, o que nunca faz); existe **Saltar**; em `/app#/conta` há **«Perfil da empresa»** para voltar.

### PRF-02 — Certificações de construtor no topo
- **URL:** `/app#/conta` → Perfil da empresa
- **Passos:** Abrir sugestões de certificações.
- **Passa se:** as primeiras sugestões incluem **Alvará classe 1–5** e ISO 9001/14001/45001. Pirotecnia/HACCP, se existirem, não são as primeiras.

### PRF-03 — Intervalo inválido
- **URL:** Perfil da empresa
- **Passos:** mínimo 100 000, máximo 50 000, Guardar.
- **Passa se:** mensagem *«O valor máximo tem de ser superior ao mínimo»* e os valores antigos mantêm-se.

### PRF-04 — Exclusão por termo = fit 0 sem IA
- **URL:** perfil com exclusão «manutenção»; depois `/app#/radar/opportunities`
- **Passos:** Encontrar (ou filtrar) um concurso cujo título contém «Manutenção…».
- **Passa se:** fit apresentado é **0**; motivo visível *«Excluído por regra: contém 'manutenção'»* (ou equivalente); há ligação para editar o perfil.

### PRF-05 — Geografia limita, não inventa
- **URL:** perfil com distritos Lisboa e Setúbal; oportunidade no Porto com IA alta
- **Passos:** Ver o chip de fit.
- **Passa se:** fit **≤ 20**; motivo *«Fora da área geográfica (Porto)»*; a razão da IA continua visível por baixo; ligação para editar o perfil.

### PRF-06 — Dados em falta não penalizam
- **URL:** perfil com distritos definidos; concurso sem distrito
- **Passos:** Ver o fit.
- **Passa se:** **não** aparece «Fora da área geográfica»; o número é o da IA (ou «desatualizado» se o teto estiver ativo).

### PRF-07 — Análise confronta alvará
- **URL:** ficha de concurso após «Analisar com IA»; empresa **sem** Alvará classe 4
- **Passos:** Ler requisitos de habilitação e o veredicto.
- **Passa se:** um requisito de alvará classe 4 (se o caderno o tiver) aparece como **«não tem»**; go/no-go é no máximo **condicional**; red flag de habilitação não coberta.
- **Perfil vazio:** requisitos «não determinável» e convite «Complete o perfil da empresa».

---

## Descoberta (PR 5)

### DIS-01 — Três filtros combinados (Pro)
- **URL:** `/app#/radar/announcements`
- **Passos:** Distrito Lisboa + valor 20 000–200 000 + tipo «Concurso público».
- **Passa se:** todas as linhas respeitam os três; o total da lista bate certo; o hash contém os três filtros; recarregar mantém os filtros.

### DIS-02 — Cadeado no plano grátis
- **URL:** `/app#/radar/announcements` (Grátis)
- **Passos:** Clicar no filtro de valor.
- **Passa se:** controlo com cadeado; texto a explicar Pro + ligação para `/app#/planos`. Não aplica o filtro.

### DIS-03 — Sem resultados
- **URL:** lista com filtros impossíveis
- **Passos:** Aplicar.
- **Passa se:** *«Sem resultados com estes filtros»* e botão **Limpar filtros** que restaura a lista.

### DIS-04 — Contagens de distrito
- **URL:** concursos, prazo «próximos 30 dias», abrir distrito
- **Passos:** Ler as contagens.
- **Passa se:** cada distrito mostra um número; distritos a 0 estão desativados; existe «Sem localização (N)» se N > 0.

### DIS-05 — Paginação e ordenação
- **URL:** lista com > 50 resultados filtrados
- **Passos:** Página 2; ordenar por valor descendente (Pro).
- **Passa se:** filtros mantêm-se na página 2; a primeira linha é a de maior valor; itens sem valor no fim.

---

## Notificações (PR 6)

### NTF-01 — Preferências na conta
- **URL:** `/app#/conta`
- **Passos:** Procurar Notificações.
- **Passa se:** interruptores «Digest semanal» e «Lembretes de prazo», ambos ligados por omissão; gravar desligar o digest persiste após recarregar.

### NTF-02 — Digest na app continua a existir
- **URL:** `/app#/digest`
- **Passos:** Abrir.
- **Passa se:** os mesmos blocos (novos, abertos, renovações); datas DD/MM; se tudo a zero, mensagem *«Semana sem novidades na sua atividade»* (versão email também).

### NTF-03 — Opt-out a partir do email
- **URL:** ligação «Deixar de receber o digest» no rodapé do email (ou digest HTML)
- **Passos:** Clicar **sem** estar autenticado.
- **Passa se:** página de confirmação; digest desligado; opção de voltar a ligar (esta exige sessão).

### NTF-04 — Lembrete agrupado (Pro)
- **Pré-condição:** 3 oportunidades Em preparação com prazo daqui a 7 dias; admin força tick com data correspondente.
- **Passa se:** **um** email «3 prazos daqui a 7 dias» (ou equivalente) com as três, responsável e % da checklist — não três emails.

### NTF-05 — Submetida não recebe lembrete
- **Passos:** Item Em preparação, prazo a 2 dias; mudar para Submetida **antes** das 08:00; forçar tick.
- **Passa se:** esse item **não** entra no email das 08:00.

### NTF-06 — Grátis vê o prazo, não o email
- **URL:** `/app#/hoje` (Grátis) com Interessa e prazo ≤ 14 dias
- **Passa se:** o prazo aparece no Hoje; nenhum email de lembrete é enviado (verificar na UI admin «Notificações» — estado ausente para essa conta).

---

## Feedback IA e formalidades (PR 7)

### FBK-01 — 👎 com motivo (Pro)
- **URL:** lista Pro, chip de fit
- **Passos:** 👎 → «fora da nossa atividade».
- **Passa se:** o chip mostra que há feedback; hover/título com o motivo; repetir substitui (não duplica na ficha).

### FBK-02 — Cadeado no Grátis
- **URL:** lista Grátis (se o fit estiver visível) ou ficha
- **Passa se:** botão de feedback com cadeado; clique explica Pro.

### FBK-03 — Dois utilizadores, dois votos
- **URL:** ficha Business
- **Passos:** Ana 👍, Rui 👎 no mesmo fit.
- **Passa se:** a ficha lista os dois com o nome.

### FBK-04 — Sugestão de perfil
- **Passos:** 👎 «fora da nossa geografia» num concurso de Faro.
- **Passa se:** convite *«Adicionar Faro…»* (distritos servidos ou exclusão, conforme copy); um clique actualiza o perfil (PRF).

### FOR-01 — Formalidades na ficha
- **URL:** `/app#/announcements/{id}` após análise (ou mesmo antes, bloco estático)
- **Passos:** Procurar «Formalidades».
- **Passa se:** nome da plataforma (Vortal / AcinGov / Saphety / anoGov / Compras Públicas / «ver anúncio») + lembrete DEUCP + assinatura digital qualificada. Sem parecer jurídico.

### FRS-01 — Frescura
- **URL:** `/app#/hoje` e barra lateral
- **Passa se:** «Última recolha: DD/MM HH:mm» (ou equivalente) no cartão de atividade e no topo de Hoje.

---

## Anti-regressão GTM (sempre, qualquer PR)

Depois de cada deploy, repetir **GTM-01, GTM-02, GTM-06** em produção. Qualquer regressão a «festas de Braga» / «pirotecnia» no hero ou no registo **falha o PR**, mesmo que as features novas passem.

# Delta para o domínio `discovery`

> Explorar para além do perfil: filtros facetados nas listas. Plano: filtros **básicos grátis**; **avançados a partir do Pro**.

## ADDED Requirements

### Requirement: Filtros nas listas

As listas de concursos abertos, oportunidades e contratos SHALL aceitar filtros combináveis. Filtros **básicos** (grátis): texto livre, distrito (múltiplo), janela de prazo (próximos 7 / 15 / 30 / 60 dias). Filtros **avançados** (Pro): intervalo de valor, tipo de procedimento (múltiplo), entidade adjudicante (texto), CPV (múltiplo, por prefixo). O estado dos filtros MUST ficar no URL para ser partilhável e sobreviver ao recarregar.

#### Scenario: combinar filtros
- GIVEN um utilizador Pro na lista de concursos
- WHEN filtra por distrito "Lisboa", valor entre 20 000 e 200 000 e tipo "Concurso público"
- THEN a lista mostra só concursos que cumprem as três condições
- AND o total apresentado corresponde ao número de resultados filtrados
- AND o URL reflete os três filtros

#### Scenario: filtro avançado no plano grátis
- GIVEN um utilizador do plano grátis
- WHEN tenta usar o filtro de valor
- THEN o controlo aparece com cadeado e, ao clicar, mostra a explicação e a ligação para os planos
- AND um pedido direto à API com esse filtro responde 403 com o código `plan_required`

#### Scenario: valor desconhecido
- GIVEN concursos sem preço base publicado
- WHEN o utilizador filtra por intervalo de valor
- THEN esses concursos não aparecem, e a barra de filtros indica "N concursos sem valor publicado excluídos"

#### Scenario: sem resultados
- GIVEN filtros que não devolvem nada
- WHEN a lista é apresentada
- THEN mostra "Sem resultados com estes filtros" e um botão "Limpar filtros"

### Requirement: Contagens por faceta

A barra de filtros SHALL mostrar, para distrito e tipo de procedimento, o número de resultados que cada valor devolveria dado o resto dos filtros ativos.

#### Scenario: contagens atualizam
- GIVEN a lista de concursos com o filtro de prazo "próximos 30 dias"
- WHEN o utilizador abre o seletor de distrito
- THEN cada distrito mostra a contagem para os próximos 30 dias, e distritos com 0 aparecem desativados

### Requirement: Desempenho dos filtros

Qualquer combinação de filtros sobre o âmbito de um perfil SHOULD responder em menos de 1,5 s com cache quente; a paginação MUST manter os filtros.

#### Scenario: paginação com filtros
- GIVEN 120 resultados filtrados
- WHEN o utilizador avança para a página 2
- THEN os filtros mantêm-se e a página 2 mostra os resultados 51–100

## MODIFIED Requirements

### Requirement: Ordenação das listas

As listas MUST aceitar ordenação por prazo, valor, data de publicação e (Pro) score/fit, ascendente ou descendente.
(Anteriormente: ordenação fixa por prazo.)

#### Scenario: ordenar por valor
- GIVEN a lista de oportunidades
- WHEN o utilizador ordena por valor descendente
- THEN a primeira linha é a de maior valor e os itens sem valor ficam no fim

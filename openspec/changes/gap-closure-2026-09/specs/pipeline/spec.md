# Delta para o domínio `pipeline`

> Estado de trabalho por oportunidade, partilhado pela equipa da empresa. Plano: **grátis**.

## ADDED Requirements

### Requirement: Estado por oportunidade

O sistema SHALL permitir a um utilizador atribuir a qualquer oportunidade (concurso aberto ou renovação) um dos estados **Interessa**, **Em preparação**, **Submetida**, **Ganha**, **Perdida** ou **Descartada**. Uma oportunidade sem estado atribuído MUST ser apresentada como **Nova**. O estado MUST ser único por `(empresa, oportunidade)` e visível a todos os utilizadores da mesma empresa.

#### Scenario: marcar como Interessa a partir da lista
- GIVEN um utilizador autenticado a ver a lista de oportunidades da sua atividade
- WHEN escolhe "Interessa" no seletor de estado de uma linha
- THEN a linha passa a mostrar o chip "Interessa" sem recarregar a página
- AND qualquer outro utilizador da mesma empresa vê o mesmo chip ao carregar a lista
- AND o item passa a aparecer na vista Pipeline, na coluna "Interessa"

#### Scenario: transições permitidas e proibidas
- GIVEN uma oportunidade no estado "Submetida"
- WHEN o utilizador tenta mudar para "Interessa"
- THEN o sistema recusa com a mensagem "Uma proposta submetida só pode passar a Ganha, Perdida ou Descartada"
- AND o estado mantém-se "Submetida"

#### Scenario: oportunidade de outra empresa
- GIVEN um utilizador da empresa A
- WHEN tenta alterar o estado de uma oportunidade com um identificador válido mas fora do âmbito dos perfis da empresa A
- THEN o sistema responde 404 e nada é gravado
- AND nenhum dado da empresa B é revelado

#### Scenario: reverter Descartada
- GIVEN uma oportunidade "Descartada"
- WHEN o utilizador escolhe "Interessa"
- THEN o estado muda para "Interessa" (Descartada é reversível)
- AND o histórico regista as duas transições

### Requirement: Nota e responsável

O sistema SHALL permitir associar a cada oportunidade com estado uma **nota livre** (até 2 000 caracteres) e um **responsável** (utilizador da mesma empresa). Ambos MAY estar vazios.

#### Scenario: atribuir responsável
- GIVEN uma empresa com dois utilizadores, Ana e Rui
- WHEN Ana marca uma oportunidade como "Em preparação" e escolhe Rui como responsável
- THEN a oportunidade mostra "Rui" como responsável na vista Pipeline
- AND Rui vê a oportunidade na secção "A minha responsabilidade" da página Hoje

#### Scenario: responsável removido da equipa
- GIVEN uma oportunidade com responsável Rui
- WHEN Rui é removido da equipa
- THEN a oportunidade fica sem responsável (não é apagada nem muda de estado)

### Requirement: Histórico de transições

O sistema MUST registar cada mudança de estado com autor, instante, estado anterior e novo. O histórico SHALL ser visível na ficha da oportunidade.

#### Scenario: consultar histórico
- GIVEN uma oportunidade que passou por Interessa → Em preparação → Submetida
- WHEN o utilizador abre a ficha
- THEN vê as três transições por ordem cronológica, com quem e quando

#### Scenario: mudança sem alteração real
- GIVEN uma oportunidade em "Interessa"
- WHEN o utilizador escolhe novamente "Interessa"
- THEN nada é registado no histórico e a resposta é bem-sucedida

### Requirement: Checklist de preparação interativa

Quando existe uma análise de IA para a oportunidade, o sistema SHALL apresentar a sua `checklist` como itens marcáveis, guardados por empresa, e SHALL mostrar a percentagem concluída na vista Pipeline e na ficha.

#### Scenario: marcar itens
- GIVEN uma oportunidade "Em preparação" com análise de IA de 6 itens de checklist
- WHEN o utilizador marca 3 itens
- THEN a ficha mostra "3/6 · 50 %" e a vista Pipeline mostra a mesma percentagem na linha
- AND outro utilizador da empresa vê os mesmos 3 itens marcados

#### Scenario: análise regenerada
- GIVEN uma checklist com itens marcados
- WHEN a análise de IA é regenerada e devolve itens diferentes
- THEN os itens com texto idêntico mantêm a marcação; os novos aparecem desmarcados; os desaparecidos deixam de ser mostrados

#### Scenario: sem análise
- GIVEN uma oportunidade sem análise de IA
- WHEN o utilizador abre a ficha
- THEN a secção de checklist mostra "Gere a análise de IA para obter a checklist de preparação" (sem erro)

### Requirement: Vista Pipeline

O sistema SHALL disponibilizar uma vista "Pipeline" na navegação principal, agrupada por estado, com prazo, valor, responsável, progresso da checklist e ordenação por prazo mais próximo. Ganha, Perdida e Descartada SHALL ficar numa secção "Fechadas", colapsada por omissão.

#### Scenario: vista vazia
- GIVEN uma empresa que nunca marcou oportunidades
- WHEN abre a vista Pipeline
- THEN vê uma explicação curta de como marcar oportunidades a partir das listas, com ligação para "Oportunidades"

#### Scenario: prazo ultrapassado em preparação
- GIVEN uma oportunidade "Em preparação" cujo prazo de propostas já passou
- WHEN a vista Pipeline é apresentada
- THEN a linha aparece com o prazo a vermelho e a etiqueta "Prazo ultrapassado"
- AND o sistema sugere "Marcar como Submetida ou Descartada"

### Requirement: Hoje reflete o pipeline

A página Hoje SHALL destacar, acima de tudo o resto, as oportunidades "Em preparação" com prazo nos próximos 7 dias e as "Interessa" com prazo nos próximos 14 dias.

#### Scenario: nada urgente
- GIVEN uma empresa com oportunidades marcadas mas nenhuma com prazo nos próximos 14 dias
- WHEN abre a página Hoje
- THEN a secção de pipeline não aparece (não ocupa espaço vazio)

## MODIFIED Requirements

### Requirement: Listas de oportunidades e concursos incluem o estado

As respostas das listas de oportunidades, concursos abertos e renovações MUST incluir o estado do pipeline de cada item para a empresa do pedido (`null` quando Nova), sem chamadas adicionais por linha.
(Anteriormente: as listas não tinham noção de estado.)

#### Scenario: lista com estados
- GIVEN 50 oportunidades, 3 delas marcadas
- WHEN a lista é pedida
- THEN a resposta traz as 50 com o campo de estado preenchido nas 3 e vazio nas restantes, numa única resposta

#### Scenario: filtrar por estado
- GIVEN a lista de oportunidades
- WHEN o utilizador escolhe "Só novas"
- THEN só aparecem oportunidades sem estado atribuído

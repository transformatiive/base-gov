# Delta para o domínio `company-profile`

> Capacidades reais da empresa, a alimentar o fit e a análise de IA. Plano: **grátis** (o fit em si continua Pro).

## ADDED Requirements

### Requirement: Perfil da empresa

O sistema SHALL permitir a um utilizador da empresa manter um **perfil da empresa** (um por empresa, distinto dos perfis de atividade) com: descrição livre do que faz; certificações e alvarás (lista livre, com sugestões comuns); distritos onde executa; intervalo de valor de contrato em que concorre (mínimo e máximo, ambos opcionais); termos de exclusão; entidades a excluir. Todos os campos MAY estar vazios.

#### Scenario: preencher no onboarding
- GIVEN um utilizador acabado de registar
- WHEN termina o registo
- THEN é-lhe proposto (sem obrigar) completar o perfil da empresa em 4 perguntas: onde executa, que certificações tem, entre que valores concorre, o que nunca faz
- AND pode saltar e voltar mais tarde em Conta → Perfil da empresa

#### Scenario: editar mais tarde
- GIVEN um perfil preenchido
- WHEN o utilizador altera os distritos servidos
- THEN a alteração fica gravada, visível a toda a empresa, e os fits em cache passam a ser considerados desatualizados (ver Requirement seguinte)

#### Scenario: intervalo inválido
- GIVEN o utilizador introduz mínimo 100 000 e máximo 50 000
- WHEN guarda
- THEN o sistema recusa com "O valor máximo tem de ser superior ao mínimo" e nada é gravado

### Requirement: Regras determinísticas antes da IA

O sistema MUST aplicar, antes de qualquer chamada ao modelo, as seguintes regras a cada oportunidade, e MUST tornar o resultado da regra visível ao utilizador como motivo:

| Regra | Efeito |
|---|---|
| Termo de exclusão presente no título ou descrição | fit = 0, motivo "Excluído por regra: contém '<termo>'", **sem chamada à IA** |
| Entidade adjudicante na lista de exclusão | fit = 0, motivo "Excluído por regra: entidade excluída", **sem chamada à IA** |
| Distrito do procedimento fora dos distritos servidos (quando definidos e o distrito é conhecido) | fit limitado a 20, motivo "Fora da área geográfica (<distrito>)" |
| Valor fora do intervalo (quando definido e o valor é conhecido) | fit limitado a 35, motivo "Valor fora do intervalo habitual (<valor>)" |

As regras SHOULD ser reavaliadas sempre que o perfil muda; os limites aplicam-se sobre o score da IA, nunca o elevam.

#### Scenario: exclusão por termo
- GIVEN uma empresa com o termo de exclusão "manutenção"
- WHEN surge um concurso "Manutenção de espaços verdes"
- THEN o fit apresentado é 0 com o motivo "Excluído por regra: contém 'manutenção'"
- AND não é registado consumo de IA para este item

#### Scenario: fora da geografia com IA favorável
- GIVEN uma empresa que serve Lisboa e Setúbal
- WHEN a IA devolve fit 85 para um concurso no Porto
- THEN o fit apresentado é 20 com os motivos "Fora da área geográfica (Porto)" e, abaixo, a razão da IA
- AND o utilizador consegue ver que o limite veio de uma regra do seu perfil, com ligação para a editar

#### Scenario: dados em falta não penalizam
- GIVEN um perfil com distritos definidos
- WHEN um concurso não tem distrito determinável
- THEN nenhuma regra geográfica é aplicada e o fit é o da IA

### Requirement: Contexto do perfil nos prompts

As análises de fit e as fichas de oportunidade geradas por IA MUST receber o perfil da empresa como contexto, e a ficha MUST confrontar explicitamente os `requisitos_habilitacao` do procedimento com as certificações declaradas, marcando cada um como "tem", "não tem" ou "não determinável".

#### Scenario: requisito não coberto
- GIVEN uma empresa sem "Alvará classe 4" declarado
- WHEN a análise de um concurso identifica "Alvará de construção classe 4 ou superior"
- THEN a ficha lista esse requisito com a marca "não tem" e o go/no-go MUST ser, no máximo, "condicional"
- AND os *red flags* incluem "Requisito de habilitação não coberto pelo perfil"

#### Scenario: perfil vazio
- GIVEN uma empresa sem perfil preenchido
- WHEN é gerada uma análise
- THEN os requisitos são listados como "não determinável" e a ficha sugere "Complete o perfil da empresa para uma verificação automática"

### Requirement: Invalidação preguiçosa do fit

Alterar o perfil da empresa MUST marcar como desatualizados os fits em cache da empresa, MUST NOT recomputá-los em massa, e SHOULD recomputá-los apenas quando o item volta a ser apresentado, respeitando o teto de IA do plano.

#### Scenario: alteração de perfil
- GIVEN 300 fits em cache
- WHEN o perfil muda
- THEN nenhuma chamada à IA é feita nesse momento
- AND ao abrir a lista de oportunidades (12 meses), os fits visíveis são recomputados e os restantes ficam para quando forem pedidos

#### Scenario: teto de IA atingido
- GIVEN uma empresa Pro com o teto mensal de IA atingido (modo aviso)
- WHEN os fits desatualizados são pedidos
- THEN o sistema apresenta os valores antigos com a etiqueta "desatualizado" em vez de bloquear a lista

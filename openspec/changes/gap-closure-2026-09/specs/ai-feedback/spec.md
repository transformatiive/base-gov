# Delta para o domínio `ai-feedback`

> O utilizador corrige a IA; a IA passa a ter isso em conta. Plano: **a partir do Pro**.

## ADDED Requirements

### Requirement: Feedback no fit e na ficha

O sistema SHALL permitir dar 👍 ou 👎 a cada fit de IA e a cada ficha de análise. Num 👎 o utilizador SHOULD escolher um motivo entre: **fora da nossa atividade**, **fora da nossa geografia**, **requisito impossível para nós**, **valor desadequado**, **outro** (com comentário livre opcional, até 500 caracteres). O feedback MUST ficar associado à empresa, ao utilizador e ao item.

#### Scenario: feedback negativo com motivo
- GIVEN um utilizador Pro a ver um fit 78 numa oportunidade
- WHEN dá 👎 e escolhe "fora da nossa atividade"
- THEN o chip do fit mostra o ícone de feedback dado e o motivo ao passar o rato
- AND o feedback fica registado uma vez (repetir substitui, não duplica)

#### Scenario: plano grátis
- GIVEN um utilizador do plano grátis
- WHEN vê o botão de feedback
- THEN aparece com cadeado e explicação; um pedido direto à API responde 403 `plan_required`

#### Scenario: feedback contraditório na equipa
- GIVEN Ana deu 👍 e Rui deu 👎 ao mesmo fit
- WHEN a ficha é apresentada
- THEN mostra os dois feedbacks com os autores; para efeitos de aprendizagem conta o mais recente

### Requirement: Feedback usado pela IA

Os pedidos de fit e de análise para a mesma empresa MUST incluir, como exemplos negativos, os últimos 10 feedbacks 👎 dessa empresa (título do item e motivo). Um 👎 com motivo "requisito impossível para nós" ou "fora da nossa geografia" SHOULD desencadear a sugestão de atualizar o perfil da empresa com a exclusão ou o distrito correspondente.

#### Scenario: exemplo negativo a influenciar o fit seguinte
- GIVEN uma empresa que deu 👎 "fora da nossa atividade" a três concursos de "limpeza"
- WHEN é calculado o fit de um novo concurso de limpeza
- THEN o prompt inclui os três exemplos e o fit resultante é mais baixo, com a razão a referir feedback anterior

#### Scenario: sugestão de atualizar o perfil
- GIVEN um 👎 com motivo "fora da nossa geografia" num concurso do distrito de Faro
- WHEN o feedback é gravado
- THEN o sistema propõe "Adicionar Faro aos distritos excluídos?" com um clique para aceitar

### Requirement: Feedback visível ao administrador

O painel de administração SHALL mostrar os feedbacks por empresa e motivo, com o texto do item, para permitir detetar padrões de erro da IA.

#### Scenario: padrão de erro
- GIVEN 15 feedbacks 👎 "fora da nossa atividade" de 4 empresas diferentes sobre concursos com o CPV 90910000
- WHEN o administrador consulta a página
- THEN vê a contagem agregada por motivo e por CPV, e consegue abrir cada item

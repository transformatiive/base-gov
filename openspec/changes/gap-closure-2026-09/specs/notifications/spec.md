# Delta para o domínio `notifications`

> O que chega sem ninguém pedir. Digest: **grátis**. Lembretes de prazo: **a partir do Pro**.

## ADDED Requirements

### Requirement: Digest semanal automático

O sistema SHALL enviar, **todas as segundas-feiras às 08:00 (Europa/Lisboa)**, um email de digest por perfil de atividade a todos os utilizadores da empresa que não tenham desligado a opção. O conteúdo MUST ser o mesmo da versão web do digest (novos concursos, concursos com prazo a decorrer, renovações a preparar, introdução) e MUST usar datas no formato DD/MM.

#### Scenario: envio regular
- GIVEN uma empresa com dois utilizadores e um perfil "Pirotecnia"
- WHEN chega segunda-feira às 08:00
- THEN cada utilizador recebe um email "BaseRadar — Digest semanal · Pirotecnia · DD/MM/AAAA"
- AND o envio fica registado, e uma segunda execução no mesmo dia não reenvia

#### Scenario: opt-out
- GIVEN um utilizador que desligou "Receber o digest semanal" na conta
- WHEN chega segunda-feira
- THEN não recebe o email; os colegas recebem

#### Scenario: perfil sem novidades
- GIVEN um perfil com zero novos anúncios, zero concursos abertos e zero renovações a 90 dias
- WHEN chega segunda-feira
- THEN o email é enviado na mesma com a mensagem "Semana sem novidades na sua atividade" e os números a zero (o utilizador sabe que o sistema está vivo)

#### Scenario: deploy a sobrepor-se à hora de envio
- GIVEN dois contentores em execução simultânea durante um deploy às 08:00
- WHEN ambos avaliam o envio
- THEN apenas um email por utilizador/perfil é enviado (idempotência por registo em base de dados)

#### Scenario: falha de email
- GIVEN o serviço de email indisponível
- WHEN o envio falha
- THEN o registo fica marcado como falhado com o erro, e é tentado de novo no ciclo seguinte até 3 vezes; nunca bloqueia outras notificações

### Requirement: Lembretes de prazo (Pro)

Para cada oportunidade em estado **Interessa** ou **Em preparação** com prazo conhecido, o sistema SHALL enviar um lembrete **7 dias** e **2 dias** antes do prazo, às 08:00, aos utilizadores da empresa com a opção ligada. Os lembretes de um mesmo dia MUST ser agrupados num único email por utilizador. Um lembrete MUST NOT ser enviado se a oportunidade mudou entretanto para Submetida, Ganha, Perdida ou Descartada.

#### Scenario: lembrete agrupado
- GIVEN três oportunidades "Em preparação" com prazo daqui a 7 dias
- WHEN chegam as 08:00
- THEN cada utilizador recebe **um** email "3 prazos daqui a 7 dias" com as três oportunidades, responsável e progresso da checklist

#### Scenario: submetida antes do lembrete
- GIVEN uma oportunidade "Em preparação" com prazo daqui a 2 dias
- WHEN passa a "Submetida" às 07:30
- THEN o lembrete das 08:00 não é enviado para essa oportunidade

#### Scenario: plano grátis
- GIVEN uma empresa no plano grátis com oportunidades marcadas
- WHEN chega a hora do lembrete
- THEN nenhum email é enviado, e a página Hoje continua a mostrar os prazos (o aviso na aplicação é grátis; só o email é Pro)

#### Scenario: prazo alterado pela entidade
- GIVEN um lembrete de 7 dias já enviado
- WHEN o prazo do concurso é prorrogado em 10 dias
- THEN o lembrete de 7 dias é enviado de novo na nova data (a idempotência é por prazo, não só por oportunidade)

### Requirement: Preferências de notificação

Cada utilizador SHALL poder ligar e desligar, na sua conta, o digest semanal e os lembretes de prazo. Ambos MUST estar ligados por omissão. Cada email MUST ter uma ligação de um clique para desligar esse tipo de notificação.

#### Scenario: desligar a partir do email
- GIVEN um utilizador a receber o digest
- WHEN clica em "Deixar de receber o digest" no rodapé do email
- THEN a preferência é desligada sem exigir início de sessão (token assinado de uso único por tipo), e vê a confirmação com opção de voltar a ligar

### Requirement: Registo e visibilidade das notificações

O sistema MUST manter um registo de cada notificação (tipo, destinatário, referência, instante, resultado) e o painel de administração SHOULD mostrar as últimas 200 com o estado.

#### Scenario: auditoria
- GIVEN um utilizador que diz não ter recebido o digest
- WHEN o administrador consulta o registo
- THEN vê se foi enviado, quando, e o identificador do fornecedor de email ou o erro

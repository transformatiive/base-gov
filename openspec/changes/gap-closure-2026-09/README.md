# BaseRadar — Fecho de gaps de produto (v1.1) — Spec SDD

> **Gerado:** 2026-09-02 · **Modo:** OpenSpec (pasta, delta-specs) · **Agente alvo:** Claude Code · **Projeto:** interno (Transformatiive, Lda.) · **Codebase:** brownfield — `transformatiive/base-gov`

Esta pasta contém os artefactos de *Spec-Driven Development* para a alteração **gap-closure-2026-09**: pipeline por oportunidade, perfil rico da empresa a alimentar o fit de IA, filtros facetados, feedback sobre a IA, digest automático, lembretes de prazo e um conjunto de melhorias transversais.

> **Implementação e QA:** documento único (os 9 ficheiros desta pasta cruzados de novo com a análise de gaps + GTM + AC de UI) em [`../gap-closure-ui-2026-09/SPEC.md`](../gap-closure-ui-2026-09/SPEC.md). O `design.md` desta pasta continua válido; o SPEC absorve-o e não o contradiz.

## Estrutura

```
gap-closure-2026-09/
├── README.md              ← este ficheiro
├── proposal.md            ← porquê, âmbito, fora de âmbito, restrições, fatia mínima
├── design.md              ← arquitetura, decisões (com alternativas), dados, ficheiros a tocar
├── tasks.md               ← checklist de implementação, por fases e verificável
└── specs/                 ← contratos de comportamento (delta), por domínio
    ├── pipeline/spec.md
    ├── company-profile/spec.md
    ├── discovery/spec.md
    ├── notifications/spec.md
    └── ai-feedback/spec.md
```

Ordem de leitura: `proposal.md` → `specs/*/spec.md` → `design.md` → `tasks.md`.

## Como usar com Claude Code

Cola isto no arranque da sessão:

```
Lê openspec/changes/gap-closure-2026-09/proposal.md, depois todos os specs/*/spec.md,
depois design.md. Valida que cada Requirement dos specs está coberto por pelo menos uma
tarefa em tasks.md antes de começar. Implementa tarefa a tarefa, pela ordem de tasks.md.
Depois de cada tarefa, confirma o cenário Given/When/Then correspondente e marca-a como
feita em tasks.md. Não implementes nada que não esteja em tasks.md. Se um Requirement for
ambíguo, para e pergunta. Segue as convenções do repositório: TypeScript estrito, sem
dependências novas salvo decisão registada em design.md, comentários e UI em português
europeu, migrações idempotentes em src/db.ts.
```

## Convenções

- Palavras-chave RFC 2119 (**SHALL / MUST / SHOULD / MAY**) nos requisitos.
- Cenários em Given / When / Then. Cada requisito tem pelo menos um caminho feliz e um caso limite.
- Os specs descrevem **comportamento observável**; o **como** vive em `design.md`.
- Nenhum segredo ou credencial nestes ficheiros — apenas nomes de variáveis de ambiente.

## Ao concluir

Quando todas as tarefas estiverem feitas e verificadas, os delta-specs devem ser fundidos na spec principal do produto e esta pasta arquivada (`openspec/changes/archive/2026-09-gap-closure/`).

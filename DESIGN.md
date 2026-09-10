# PrepBid — normas de identidade

Fonte das normas visuais (logótipo, paleta, tipo, usos incorrectos) e das
regras de produto. Ler este ficheiro antes de alterar UI, documentos gerados
(`.docx`), landing ou qualquer superfície com a marca.

Valores de cor, tipo e forma no código vêm só de `src/styles/tokens.css`
(copiado para `public/tokens.css`). Este documento explica **quando** e
**como** usá-los. Não inventar hex, pesos ou tracking.

Regras curtas sempre no contexto do Cursor: `.cursor/rules/prepbid-brand.mdc`.

---

## 1. A marca

PrepBid é um **logótipo tipográfico**. Não existe símbolo, ícone ou
monograma: a **palavra**, o **filete** e o **descritivo** são a totalidade
da identidade.

A palavra é uma única run de texto, um peso, uma cor:

```html
<span class="pb-wordmark">PrepBid</span>
```

Nunca imagem, SVG, favicon-glyph ao lado, nem `Prep` + `Bid` em pesos ou
cores diferentes.

---

## 2. Composição do lockup (variante A)

| Peça | Norma |
|---|---|
| **Palavra** | Archivo SemiBold **600**, tracking **−3,8 %** (`--pb-wordmark-tracking: -0.038em`). Uma cor. |
| **Filete** | 1 px · **20 % de tinta** · altura = **66 % da maiúscula** |
| **Descritivo** | `CONTRATOS` / `PÚBLICOS` em **duas linhas**. Archivo Medium **500**, caixa alta, tracking **20 %** |
| **Intervalos** | palavra → filete **0,28×M** · filete → descritivo **0,28×M** (`M` = largura do M da palavra) |

O descritivo alinhado ao centro óptico da palavra, não à linha de base.

Tracking da palavra (−3,8 %) é o da norma. Não se acrescenta letter-spacing
extra, não se aperta mais, não se estica.

---

## 3. Área de protecção e dimensão mínima

**Protecção.** Margem livre em todos os lados igual à **altura da maiúscula P**.
Nada entra nesta área: nem texto, nem filetes, nem imagem.

**Mínimos**

| Suporte | Palavra |
|---|---|
| Ecrã | **21 px** (`--pb-wordmark-size`) |
| Impresso | **15 mm** (≈ 42,5 pt) |

Abaixo de **30 px** o descritivo e o filete saem: usa-se só a palavra
(variante C). Não existe versão de ícone — em favicon e app usa-se o **P
recortado** do logótipo (rectângulo tinta, raio 4 px), não um pictograma.

Na app, nav / sidebar / wordmark de ecrã: 21 px. Não descer abaixo de 19 px.

---

## 4. Três variantes, uma hierarquia

| | Variante | Uso |
|---|---|---|
| **A** | Horizontal — palavra + filete + descritivo em duas linhas | **Origem.** Topo da barra lateral, cabeçalhos, **documentos**. |
| **B** | Empilhado — palavra; descritivo por baixo, centrado | Formatos verticais e assinaturas de email. |
| **C** | Palavra só | Espaços com menos de **160 px** de largura, e abaixo de 30 px de altura. |

Documentos gerados (proposta `.docx`): **variante A no título**.
Implementação: `src/docx-brand.ts`.

---

## 5. Paleta

Tinta e papel fazem quase todo o trabalho. O verde é **acento**, nunca
fundo de página.

| Nome | Hex | Token | Papel |
|---|---|---|---|
| Tinta | `#141613` | `--pb-ink` | Texto e logótipo; superfícies escuras |
| Papel | `#EFEDE7` | `--pb-paper` | Fundo institucional (app, marketing, documentos) |
| Branco | `#FFFFFF` | `--pb-surface` | Fundo de interface: cartões, painéis, linhas de tabela |
| Verde BASE | `#1C6B4C` | `--pb-green` | Acento · acção (botão primário, links, nav activa, uma série de dados) |
| Verde claro | `#4FA37E` | `--pb-green-light` | Acento **sobre tinta** (gráficos, números grandes). Nunca corpo de texto. |
| Cinza | `#6E7269` | `--pb-grey` | Texto secundário, descritivo do lockup, desactivado |
| Âmbar | `#B4741C` | `--pb-amber` | Prazo urgente, score ring, «Em preparação», `[A COMPLETAR]` |
| Granada | `#8C2F2F` | `--pb-garnet` | Prazo ultrapassado, não avançar, destrutivo |

Opacidades de tinta (não são hex novos — são `--pb-ink` com alpha):

| Token | Uso |
|---|---|
| `--pb-ink-80` / `--pb-ink-60` | Secundário, metadados |
| `--pb-ink-42` | Labels, ticks |
| `--pb-ink-12` | Bordas (`--pb-border`) |
| `--pb-ink-06` | Grelha, zebra |

Tints de estado: `--pb-green-tint`, `--pb-amber-tint`, `--pb-garnet-tint`.
`--pb-surface-sunken` (`#E7E4DC`) para poços e áreas vazias de gráfico.

**Filete a 20 % de tinta:** misturar `--pb-ink` a 20 % sobre o fundo
(papel ou branco). Não inventar um cinza à parte.

---

## 6. Cor do logótipo

Seis combinações permitidas. Palavra e descritivo **a mesma família de
cor** (tinta, papel ou verde) — nunca duas cores dentro da palavra.

| | Nome | Fundo | Palavra + descritivo |
|---|---|---|---|
| 01 | Primária | Papel | Tinta (descritivo pode ir a cinza) |
| 02 | Interface | Branco | Tinta |
| 03 | Reversa | Tinta | Papel (`.pb-wordmark--reverse`) |
| 04 | Acento | Papel | Verde BASE |
| 05 | Reversa acento | Verde BASE | Papel |
| 06 | Uma cor | Branco | Tinta a 100 % (filete também tinta) |

**01** é o default em documentos e marketing. **02** na app sobre cartões
brancos. **03** em painéis tinta (ex.: rodapé da landing). **04/05** só
quando o verde é o acento do bloco, nunca um sítio inteiro verde. **06**
quando o filete a 20 % desapareceria (impressão a uma tinta).

---

## 7. Tipografia

Duas famílias, papéis separados. Nunca serif. Nunca itálico.

### Archivo — texto e marca

Regular **400** · Medium **500** · SemiBold **600**.

- Títulos em **600** com tracking negativo (`--pb-heading-tracking: -0.025em`).
- Corpo em **400**.
- **Nunca Bold 700** em títulos longos.
- Marca: só **600**, tracking −3,8 %.

| Token | Uso |
|---|---|
| `--pb-h1` / `--pb-h2` / `--pb-h3` | Títulos de página e secção |
| `--pb-body` / `--pb-body-sm` | Corpo, nav, botões |
| `--pb-wordmark` | Palavra PrepBid (21 px / 600 / −0.038 em) |

### IBM Plex Mono — dados

Valores, prazos, scores, CPV, etiquetas de campo e referências do Portal
BASE. Caixa alta com tracking **16–20 %** nas etiquetas; sempre
`font-variant-numeric: tabular-nums`.

| Token | Uso |
|---|---|
| `--pb-numeric` / `.pb-num` | Números de corpo |
| `--pb-numeric-l` / `.pb-num-l` | Números grandes |
| `--pb-label` / `.pb-label` | Eyebrows, cabeçalhos de tabela, chips, ticks |
| `--pb-font-mono` | CPV, NIF, referências de procedimento |

Números em português: espaço como milhares, vírgula decimal, `€` **depois**
do número com espaço — `868 780 €`, `15,6 M €`.

---

## 8. Onde não se mexe (usos incorrectos)

1. **Dois pesos ou duas cores dentro da palavra** (ex.: Prep + Bid verde).
2. **Alterar o tracking da palavra** (abrir, fechar, ou tracking 0).
3. **Itálico, distorção ou condensação.**
4. **Contraste insuficiente sobre cor** (palavra verde-claro sobre verde, ou
   tinta a 40 % sobre papel).

Também proibido: sombra, gradiente, outline, rotação, lockup com ícone,
Bold 700 na marca, serif.

---

## 9. Aplicação no produto

### Cabeçalho do site / nav

Variante **A**, palavra a **21 px**, filete e descritivo em duas linhas.
Abaixo do lockup corre a barra separadora de **1 px** que fecha o topo da
barra lateral. Variante **C** só abaixo de 160 px de largura.

Classe: `.pb-wordmark`. Descritivo: tipo label (caixa alta, tracking largo,
cinza ou tinta-42).

### Superfícies e forma

- Fundo de página: `--pb-paper`. Cartões: `--pb-surface`.
- Texto: `--pb-ink`. Metadados: `--pb-ink-60`. Labels: `--pb-ink-42`.
- Botão primário: verde, texto papel. Secundário: superfície, texto tinta, borda.
- Nav activa: `--pb-green-tint` + texto verde.
- Verde **nunca** é fundo de página, painel ou gráfico inteiro.
- Flat: `box-shadow` não se usa. Separação: borda 1 px e raio **4 px**.
  Sem elevation, sem `rounded-2xl`.

### Estados

- Interessa → chip green-tint.
- Em preparação → âmbar.
- Prazo ultrapassado / não avançar → granada: **borda esquerda 3 px** +
  texto mono, não um preenchimento rosa.
- Colunas kanban: título na cor do estado e filete inferior 2 px; o corpo
  da coluna fica papel, nunca um fundo tintado.
- Painéis escuros («Em jogo»): tinta, número de acento em `--pb-green-light`.

### Gráficos

Barras sequenciais `--pb-chart-1` → `--pb-chart-4` (tinta em opacidade
decrescente). `--pb-chart-accent` (verde) marca **no máximo uma** série —
o pico, a quota do utilizador, o item a actuar. Sem gradiente, sombra, 3D
ou caps arredondadas. Valores acima da barra em mono 10 px.

### Score

Anel `conic-gradient(--pb-amber 0 <score>%, --pb-ink-12 <score>% 100%)`,
círculo interior `--pb-surface`, número em mono. Listas de baixa prioridade:
tinta em vez de âmbar.

### Acessibilidade

Corpo ≥ 4,5:1. Tinta a 100 % sobre verde, âmbar e tinta. Nunca uma tinta
com alpha sobre um fundo colorido. `--pb-green-light` só em gráficos e
numerais grandes sobre tinta.

### Voz

Português pt-PT, grafia pré-2011 já usada no produto (`activa`,
`electrónica`, `protecção`). Frases curtas e factuais. Sem pontos de
exclamação, emoji ou adjectivos de marketing. Labels são nomes
(`Renovações`, não `Ver renovações`). Nunca inventar um número: o
desconhecido renderiza `[A COMPLETAR]`.

---

## 10. Documentos (proposta `.docx`)

- Título: **variante A** (não a C, não um título Calibri).
- Palavra ≥ 15 mm. Área de protecção = altura do P.
- Fundo papel. Texto tinta. Descritivo cinza.
- Sem itálico, sem serif, sem 700.
- `[A COMPLETAR]` em âmbar sobre `--pb-amber-tint`.
- Valores / CPV / datas em IBM Plex Mono.

---

## 11. Ficheiros

| Ficheiro | Papel |
|---|---|
| `DESIGN.md` | Estas normas (ler primeiro) |
| `src/styles/tokens.css` | Valores. Única fonte de hex / tipo / raio |
| `public/tokens.css` | Cópia exacta do anterior |
| `.cursor/rules/prepbid-brand.mdc` | Regras curtas, sempre no contexto |
| `src/docx-brand.ts` | Lockup A e estilos do Word da proposta |

Componentes consomem tokens. Se a cor não está em `tokens.css`, parar e
perguntar.

# PrepBid — pacote de entrega para o Cursor

Sim, passa-se em Markdown — mas o MD sozinho não chega. O Cursor obedece a
regras que estão no repositório, não a um documento que alguém lhe cola no
chat. São três ficheiros, e a ordem importa.

## 1. Copiar dois ficheiros para o repositório

| Deste projecto | Para o repositório |
|---|---|
| `handoff/tokens.css` | `src/styles/tokens.css` |
| `handoff/prepbid-brand.mdc` | `.cursor/rules/prepbid-brand.mdc` |

`tokens.css` é a fonte única de cor, tipo e forma. `prepbid-brand.mdc` é a
regra: tem `alwaysApply: true` e `globs` para ficheiros de UI, por isso entra
no contexto de todos os pedidos sem ninguém se lembrar de a mencionar.

Importar os tokens uma vez, no topo da folha global:

```css
/* src/styles/globals.css */
@import "./tokens.css";
```

Se o projecto usa Tailwind, mapear os tokens no tema em vez de manter duas
paletas:

```js
// tailwind.config.js
theme: { extend: { colors: {
  ink:    "var(--pb-ink)",
  paper:  "var(--pb-paper)",
  green:  "var(--pb-green)",
  amber:  "var(--pb-amber)",
  garnet: "var(--pb-garnet)",
}}}
```

## 2. Fazer o commit antes de pedir o redesenho

Regras e tokens primeiro, num commit só deles. Se o Cursor reescrever
componentes na mesma passagem em que cria os tokens, fica sem base para
comparar e o diff torna-se ilegível.

## 3. Pedir ecrã a ecrã, nunca "aplica isto ao projecto"

Um ecrã por pedido, sempre com a mesma cláusula de contenção:

> Aplica as regras de `.cursor/rules/prepbid-brand.mdc` a
> `src/pages/Renovacoes.tsx`. Só cor, tipografia, raios e bordas. Não
> alteras a estrutura JSX, larguras, grelhas nem espaçamentos. Substitui
> todos os hex e classes de cor do Tailwind por tokens de
> `src/styles/tokens.css`. Todos os números — valores em euros, prazos,
> datas, scores, contagens — passam a `--pb-font-mono` com
> `tabular-nums`. Listas de alterações no fim, sem tocar em mais nada.

Ordem sugerida, do mais estruturante para o mais isolado:

1. o componente do logótipo e a barra lateral (fixa o lockup e a navegação)
2. os primitivos partilhados: botão, cartão, etiqueta, campo de filtro
3. tabelas: Renovações, Concursos, Concorrentes
4. Hoje e Carteira
5. fichas de detalhe (Análise IA, Entidade)
6. gráficos: sazonalidade, matriz de priorização, mapa
7. landing page

Os gráficos ficam para o fim porque a paleta sequencial (`--pb-chart-1..4`)
costuma estar espalhada por opções de biblioteca, não por CSS.

## 4. O que verificar em cada diff

- nenhum hex novo, nenhuma classe de cor do Tailwind sobrevivente;
- `box-shadow` removido, raio a 4 px;
- nenhum serif e nenhum itálico;
- o logótipo é texto — sem `<img>`, sem SVG, sem ícone ao lado;
- verde só em botões primários, links, item activo e uma série de dados;
- números em mono e alinhados à direita nas colunas de valor.

## 5. Referência visual

`DESIGN.md` na raiz do repositório é a norma de identidade (logótipo,
paleta, tipo, usos incorrectos, documentos). `tokens.css` é a fonte dos
valores.

`PrepBid App Adapted.dc.html` neste projecto tem os nove ecrãs já adaptados
(A1–A9). Vale mais do que a descrição: quando o Cursor devolver algo que não
bate, compara-se com o ecrã correspondente. `PrepBid Brand Guidelines.dc.html`
tem as normas do logótipo, a paleta e os usos incorrectos, em quatro páginas
A4 imprimíveis.

## 6. O que este pacote não decide

Espaçamento, densidade e breakpoints ficam como estão no produto — as
regras proíbem mexer-lhes. Se quiser uma escala de espaçamento própria, é um
segundo pacote: define-se `--pb-space-*`, e só depois se autoriza o Cursor a
alterar padding e gaps.

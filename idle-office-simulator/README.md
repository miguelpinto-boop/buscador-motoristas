# Idle Office Simulator — Versão 1.0

Jogo idle de gestão em que você transforma um prédio comercial decadente em um império corporativo. Single-player, **offline-first**, instalável como **PWA**, 100% em português do Brasil — sem backend, sem frameworks e sem dependências externas.

> Anúncios e compras são **simulados**: nenhum valor real é cobrado e nenhuma propaganda real é exibida.

## Como executar

O jogo usa módulos ES nativos, então precisa de um servidor estático (qualquer um):

```bash
cd idle-office-simulator
python3 -m http.server 8080
# abra http://localhost:8080
```

ou

```bash
npx serve .
```

- **Instalar como PWA:** abra no Chrome/Edge/Android → menu → "Instalar aplicativo". Após o primeiro carregamento, funciona sem internet.
- **Painel de depuração:** `http://localhost:8080/?debug=1` (dinheiro, REP, PL, saltos de tempo, simulador econômico, validação de save).
- **Testes automatizados:** `http://localhost:8080/tests/tests.html`.

## Publicação na Google Play

A build é uma PWA hospedável em qualquer serviço estático (GitHub Pages, Netlify, Firebase Hosting). Para a Play Store, empacote como **TWA (Trusted Web Activity)** com o [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://SEU_DOMINIO/manifest.webmanifest
bubblewrap build
```

Requisitos já atendidos pela build: manifest completo, service worker offline, ícones 192/512 + maskable, HTTPS (pela hospedagem).

## Arquitetura

```
index.html                  Shell da aplicação
manifest.webmanifest        PWA
service-worker.js           Cache versionado offline-first (não toca no save)
styles/                     Tokens, base, componentes e telas (mobile-first, 360px+)
src/
├── app.js                  Bootstrap + loop (economia por tempo real, 1 tique/s)
├── core/
│   ├── store.js            Estado central (única fonte de verdade) e save V3
│   ├── formulas.js         TODA a economia em funções puras (JSDoc)
│   ├── format.js           Abreviações PT-BR (mil, mi, bi, tri, qua, qui)
│   ├── rng.js              RNG com semente persistida (anti-recarregamento)
│   └── bus.js              Pub/sub para UI
├── data/                   TODO o conteúdo em configuração (nada na lógica):
│   │                       36 salas, 36 empresas, 24 gestores, 13 instalações,
│   │                       12 capítulos, 18 projetos, 24 pesquisas, 24 melhorias
│   │                       de Legado, 60 conquistas, 30 eventos, 10 desafios,
│   │                       30 itens de coleção, 12 mercados, 8 produtos
├── systems/                Ações e regras (upgrades, contratos, gestores, missões,
│   │                       campanha, eventos, offline, prestígio, projetos,
│   │                       desafios, monetização simulada)
├── persistence/save.js     Save V3 + checksum + backup + checkpoint + migração V2→V3
├── ui/                     Telas, navegação, modais, toasts, onboarding, game feel
└── debug/panel.js          Painel ?debug=1 + simulador econômico
tests/                      Testes automatizados no navegador
```

### Princípios (PRD §26/§45)

- **Estado central**: a UI nunca altera o estado; toda ação passa por `src/systems/`.
- **Economia por tempo real**: `Date.now()` na lógica, nunca contagem de frames.
- **Conteúdo é configuração**: adicionar empresa/sala/missão/evento não exige tocar na lógica.
- **RNG com semente salva**: resultados de projetos e sorteios diários não podem ser re-rolados recarregando a página.
- **Renderização parcial**: números de alta frequência atualizam via `data-*` sem reconstruir cards.

## Fórmulas principais

```
rendaBrutaDaSala  = base × multInquilino × (1 + 0,10 × somaDosNíveis)
multSatisfação    = 0,70 + satisfação × 0,006      (50→1,00× · 100→1,30×)
rendaFinal        = bruta × satisfação × bônusAndar × gestor × sinergia
rendaTotal        = Σ salas × multPermanente × multPrestígio × multTemporário
ganhoPorToque     = max(1; renda/s × 0,08)
custoUpgrade      = teto(base × fator^nível)        (fatores 1,14–1,17 por andar)
PL no Prestígio   = max(1; ⌊10×√(valor/1e9)⌋ + ⌊REP/250⌋)
```

## Save (V3)

- Chave: `idleOfficeSaveV3` (localStorage) + backup automático + checkpoint de Prestígio.
- Checksum FNV-1a; validação completa no load (NaN/Infinity corrigidos, IDs desconhecidos ignorados).
- Migração automática de saves V2.
- Exportação/importação por texto ou arquivo `.json`, com pré-visualização e backup do progresso atual.
- Salvamento: a cada 10 s, após ações relevantes, ao ocultar a aba e antes de fechar.
- Ganho offline calculado **por trechos**, respeitando expiração de boosts (limite 8 h; até 36 h com melhorias).

## Roteiro de testes manuais (PRD §47.2)

1. Save novo → onboarding → primeiro upgrade em <30 s.
2. Abrir todos os escritórios do Aurora; concluir 1º projeto; desbloquear Torre Central.
3. Mercado/manutenção (cap. 6+), pesquisas, Prestígio, restaurar checkpoint.
4. Campus Horizonte → campanha completa → Modo Império.
5. Instalar PWA, jogar offline, atualizar SW sem perder save, importar save V2.
6. Testar 360 px / tablet / desktop; navegação por teclado; `prefers-reduced-motion`.

## Privacidade

Todos os dados ficam no dispositivo. Nenhuma chamada de rede é necessária para jogar; nenhuma telemetria sai do aparelho; a exportação de save não contém dados pessoais.

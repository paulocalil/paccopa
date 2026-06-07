# ⚽ Pac Copa 2026

Site **local** para acompanhar a Copa do Mundo FIFA 2026 (EUA · Canadá · México) e jogar um **bolão** entre amigos. Tema claro, cores do Brasil. Tudo roda na sua máquina, sem banco de dados — os dados ficam em arquivos **JSON** em `data/`.

## Como rodar

Pré-requisito: **Node.js** (LTS).

```bash
npm install      # instala o Express (e jsdom só para testes)
npm start        # sobe em http://localhost:3000
```

No Windows, dá pra dar duplo-clique em **`start.cmd`** — ele instala as dependências (na 1ª vez), sobe o servidor e abre o navegador.

```bash
npm test         # roda toda a suíte (lógica, bolão, mata-mata e render headless)
```

## O que dá pra fazer

**Acompanhamento da Copa**
- **Jogos** — 104 partidas com data/hora de Brasília, sede, grupo/fase e placar; filtros por fase e grupo.
- **Editar partida** — lança placar, gols, cartões e pênaltis. Tudo recalcula na hora.
- **Classificação** — 12 grupos com os critérios de desempate da FIFA (confronto direto antes do saldo).
- **Terceiros** — ranking dos 12 terceiros e os 8 que avançam (Anexo C).
- **Mata-mata** — dos 16-avos à final + disputa de 3º, com propagação automática de vencedores.
- **Artilharia** — goleadores por jogador e seleção.

**Bolão**
- **Apostadores** — cadastro só com o nome.
- **Palpites** — placar nos jogos com adversários definidos e ainda não realizados.
- **Visualização** — todos os jogos × palpite de cada um × pontos por jogo.
- **Classificação** — ranking dos apostadores. Pontuação: **15** placar exato · **10** resultado certo · **5** total de gols certo.

## Como funciona

- **Servidor** Node.js + Express (`server.js`) serve as páginas (`public/`) e expõe uma **API REST** (`/api/...`).
- **Lógica de cálculo** em `src/logic/` (funções puras): classificação, terceiros, chaveamento, artilharia, fair play, fuso e bolão. Nada derivado é persistido — editou um jogo/palpite, tudo é recalculado a partir dos JSON.
- **Persistência segura**: gravação atômica + backup com timestamp em `data/backups/` antes de cada alteração.

## Dados

Pré-carregados com o sorteio de 05/12/2025 e os 104 jogos reais (horários convertidos para GMT-3), além da tabela completa do **Anexo C** (495 combinações). Para começar do zero é só editar os arquivos em `data/`.

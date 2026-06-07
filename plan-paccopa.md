# Plano — "Pac Copa 2026" (Site de Acompanhamento + Bolão da Copa do Mundo FIFA 2026)

## Contexto

Criar, do zero, um site **em português do Brasil** chamado **"Pac Copa 2026"** para acompanhar a Copa do Mundo FIFA 2026 (EUA/Canadá/México, 11/06 a 19/07/2026), com um **bolão** integrado. É um projeto novo — não há código existente. O site roda **localmente**, armazena tudo em **arquivos JSON (sem banco de dados)** e permite **inserir/editar resultados** e **palpites do bolão**, recalculando automaticamente classificações, projeção do chaveamento, artilharia e pontuação do bolão.

- **Diretório raiz do projeto:** `C:\Users\pac-m\dev\codebase\paccopa`
- **Nome do site:** **Pac Copa 2026**

O formato de 2026 é novo e define a complexidade do projeto:
- **48 seleções** em **12 grupos (A–L)** de 4.
- Avançam: **os 2 primeiros de cada grupo (24) + os 8 melhores terceiros colocados (8) = 32 times** para uma fase de **16-avos de final (Round of 32)**.
- Mata-mata: 16-avos → oitavas → quartas → semifinais → disputa de 3º lugar + final. Total de **104 jogos** (72 de grupos + 32 de mata-mata).

Decisões já confirmadas com o usuário:
1. **Arquitetura:** servidor local em **Node.js + Express** (lê/grava JSON e serve a interface).
2. **Dados iniciais:** pré-carregar os **dados reais** (sorteio de 05/12/2025, 104 jogos, sedes, horários convertidos para Brasília GMT-3).
3. **Regra dos terceiros:** implementar a **tabela oficial completa do Anexo C** (495 combinações) do regulamento da FIFA.

---

## Arquitetura geral

Servidor Node.js + Express que:
- Serve as páginas (HTML/CSS/JavaScript puro — **sem build, sem framework de frontend**, para simplicidade e portabilidade local).
- Expõe uma **API REST** para ler/gravar partidas, usuários do bolão e palpites.
- Mantém **toda a lógica de cálculo num módulo compartilhado** (`src/logic/`), de forma que classificações, ranking de terceiros, chaveamento, artilharia e **pontuação do bolão** sejam **recalculados sob demanda** a partir dos JSON (funções puras). Não há estado derivado persistido — editou um jogo ou um palpite → tudo recalcula.

```
paccopa/                        # C:\Users\pac-m\dev\codebase\paccopa
├── plan-paccopa.md             # este plano
├── package.json
├── server.js                   # Express: rotas de páginas + API
├── start.cmd                   # atalho Windows: npm start + abre o navegador
├── data/                       # ÚNICA fonte de dados (JSON)
│   ├── teams.json              # 48 seleções: id, nome pt-BR, sigla, confederação, ranking FIFA
│   ├── groups.json             # grupos A–L → ids das seleções
│   ├── stadiums.json           # sedes: cidade, estádio, fuso local
│   ├── matches.json            # 104 jogos (fixture + resultado editável)
│   ├── third-place-allocation.json  # Anexo C: 495 combinações → confrontos
│   ├── config.json             # critérios de desempate, pontos, fair play, regras do bolão
│   ├── bolao-users.json        # usuários do bolão (somente nome + id)
│   ├── bolao-guesses.json      # palpites por usuário/jogo
│   └── backups/                # cópias automáticas antes de cada gravação
├── src/
│   ├── logic/
│   │   ├── standings.js        # classificação por grupo + desempates FIFA
│   │   ├── thirds.js           # ranking dos 12 terceiros + escolha dos 8
│   │   ├── bracket.js          # projeção do mata-mata (Anexo C + propagação)
│   │   ├── scorers.js          # artilharia
│   │   ├── fairplay.js         # pontuação de conduta (cartões)
│   │   ├── bolao.js            # pontuação e classificação do bolão
│   │   └── timezone.js         # conversão UTC → America/Sao_Paulo (GMT-3)
│   └── storage.js              # leitura/gravação atômica de JSON + backup
└── public/
    ├── páginas: index / jogos / classificacao / terceiros / mata-mata / artilharia
    │            + bolao-usuarios / bolao-palpites / bolao-visualizacao / bolao-classificacao
    └── css/  e  js/            # frontend que consome a API (marca "Pac Copa 2026")
```

### Como hospedar/rodar localmente
- Pré-requisito: **Node.js instalado** (LTS).
- `npm install` (instala apenas Express; sem dependências pesadas).
- `npm start` → servidor em **http://localhost:3000**.
- `start.cmd` (Windows): roda `npm start` e abre o navegador automaticamente.
- Persistência segura sem banco: gravação **atômica** (escreve em arquivo temporário e renomeia) + **backup com timestamp** em `data/backups/` antes de sobrescrever.

---

## Modelo de dados

**`matches.json`** — cada jogo:
```json
{
  "id": "M01",
  "fase": "grupo",                 // grupo | 16avos | oitavas | quartas | semi | terceiro | final
  "grupo": "A",                    // só na fase de grupos
  "dataHoraUTC": "2026-06-11T19:00:00Z",
  "estadioId": "azteca",
  "mandante": { "tipo": "time", "ref": "MEX" },   // fase de grupos: id do time
  "visitante": { "tipo": "slot", "ref": "3C/D/F/G/H..." }, // mata-mata: slot a definir
  "jogado": false,
  "placar": { "mandante": null, "visitante": null },
  "eventos": [
    { "tipo": "gol", "timeId": "MEX", "jogador": "Nome", "minuto": 23 },
    { "tipo": "amarelo", "timeId": "MEX", "jogador": "Nome", "minuto": 40 },
    { "tipo": "vermelho", "timeId": "MEX", "jogador": "Nome", "minuto": 80, "subtipo": "direto" }
  ],
  "penaltis": { "mandante": null, "visitante": null }   // só mata-mata empatado
}
```
- **Slots de mata-mata**: os 32 jogos têm posições fixas no chaveamento (ex.: "Vencedor Grupo A", "2º Grupo B", "3º colocado do grupo X/Y/Z…", "Vencedor do jogo 73"). O engine resolve esses slots conforme os resultados entram.

**`bolao-users.json`** — usuário do bolão:
```json
{ "id": "u1", "nome": "Fulano" }
```

**`bolao-guesses.json`** — palpites (apenas o placar de cada time):
```json
{ "usuarioId": "u1", "jogoId": "M01", "palpite": { "mandante": 2, "visitante": 1 } }
```

- **`config.json`** guarda a ordem dos critérios de desempate, a pontuação de fair play e a **pontuação do bolão** (15 / 10 / 5), para as regras ficarem explícitas e ajustáveis.

---

## Lógica central (o coração do projeto)

### 1. Classificação de grupo (`standings.js`) — critérios de desempate FIFA 2026 (Art. 13), nesta ordem:
1. **Pontos** (V=3, E=1, D=0).
2. Entre os times empatados — **confronto direto**: pontos → saldo → gols marcados (somente nos jogos entre eles). Reaplicado se um subgrupo continuar empatado.
3. **Saldo de gols** geral.
4. **Gols marcados** geral.
5. **Pontuação de conduta / fair play** (cartões — ver `fairplay.js`).
6. **Ranking mundial FIFA** (campo em `teams.json`).
7. **Sorteio** — entrada manual editável; **fallback: ordem alfabética** quando o sorteio é necessário mas ainda não foi inserido (com aviso visual de "provisório por ordem alfabética").

Saída por grupo: posição, seleção, **indicação classificado/classificando**, pontos, V, E, D, GP, GC, SG, **cartões amarelos**, **cartões vermelhos**.

### 2. Ranking dos terceiros (`thirds.js`)
Ordena os 12 terceiros colocados por: **pontos → saldo geral → gols geral → fair play → ranking FIFA → sorteio (fallback alfabético)**. Seleciona os **8 melhores**.

### 3. Chaveamento (`bracket.js`)
- Monta a chave fixa dos 16-avos (vencedores e vices em posições pré-definidas).
- Para os 8 terceiros: identifica a **combinação** (conjunto de 8 letras de grupo) e consulta a **tabela do Anexo C** (`third-place-allocation.json`) para alocar cada terceiro ao confronto correto — **um terceiro nunca enfrenta o vencedor do próprio grupo**.
- **Propagação**: ao concluir um jogo de mata-mata, o vencedor é inserido automaticamente no jogo seguinte; nas **semifinais**, os **perdedores** vão para a **disputa de 3º lugar**.
- "De momento": enquanto a fase de grupos não termina, projeta a chave com base na classificação parcial.

### 4. Artilharia (`scorers.js`)
Agrega todos os eventos `gol` de `matches.json` → jogador, seleção, total de gols (ordenado).

### 5. Bolão (`bolao.js`)
Pontuação de um palpite contra o resultado real de um jogo, em **camadas mutuamente exclusivas (maior pontuação aplicável)**:
1. **15 pontos** — placar exato (gols do mandante **e** do visitante batem).
2. **10 pontos** — acertou o resultado (vencedor correto **ou** empate quando foi empate), sem placar exato.
3. **5 pontos** — acertou o **total de gols** (soma mandante+visitante igual à real), mas **errou** o vencedor/empate.
4. **0 ponto** — nenhum dos casos.

Regras de cálculo:
- Só pontua jogos **já realizados** (`jogado = true` / com resultado inserido).
- Palpite ausente para um jogo realizado = 0 ponto.
- **Classificação do bolão**: soma a pontuação de cada usuário em todos os jogos realizados; ordena por pontos (desempate sugerido: nº de placares exatos → nome em ordem alfabética).
- Constantes 15/10/5 vêm de `config.json`.

### 6. Fuso horário (`timezone.js`)
Armazena horário em **UTC**; exibe em **America/Sao_Paulo (GMT-3 fixo** — o Brasil não tem horário de verão desde 2019). Usa `Intl.DateTimeFormat` nativo (sem dependência externa).

---

## Páginas (frontend)

**Acompanhamento da Copa**
1. **Jogos** — lista filtrável por fase/grupo/data; mostra data e hora (Brasília GMT-3), cidade + estádio, grupo/fase, placar.
2. **Editar partida** — formulário: placar, eventos (gols/amarelos/vermelhos com nome do jogador e minuto) e **pênaltis** (habilitado só em mata-mata empatado). Salva via API → recalcula tudo.
3. **Classificação** — uma tabela por grupo (A–L) com todas as colunas exigidas + destaque dos classificados de momento.
4. **Terceiros colocados** — ranking dos 12 terceiros e quais 8 se classificam (de momento).
5. **Mata-mata** — chaveamento dos 16-avos à final + disputa de 3º lugar, com projeção de momento.
6. **Artilharia** — jogador, seleção, total de gols.

**Bolão**
7. **Bolão — Usuários** — cadastrar usuário informando **apenas o nome**; lista os usuários cadastrados.
8. **Bolão — Palpites** — após escolher o usuário:
   - Lista os jogos com **adversários definidos até o momento** (ambos os lados são seleções reais; **não inclui confrontos apenas projetados/slots**).
   - Nos jogos **ainda não realizados** (sem resultado inserido), permite **inserir/editar** o palpite — limitado ao **placar de cada time**.
   - Jogos já realizados aparecem como somente leitura (sem edição de palpite).
9. **Bolão — Visualização dos palpites** — tela com **todos os jogos da Copa** mostrando, por jogo:
   - o **resultado** (quando já cadastrado);
   - o **palpite de cada apostador**;
   - **quantos pontos cada apostador fez naquele jogo**, se já realizado.
10. **Bolão — Classificação** — tabela com **posição** e **pontuação total** de cada usuário até o momento.

Todas as páginas exibem a marca **"Pac Copa 2026"**.

---

## API REST (resumo)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/jogos`, `/api/classificacao`, `/api/terceiros`, `/api/chave`, `/api/artilharia` | leituras com cálculo sob demanda |
| PUT | `/api/jogos/:id` | editar resultado/eventos/pênaltis + sorteios de desempate |
| GET/POST | `/api/bolao/usuarios` | listar / cadastrar usuário (só nome) |
| GET | `/api/bolao/jogos-disponiveis` | jogos com adversários definidos (para palpite) |
| GET/PUT | `/api/bolao/palpites/:usuarioId` | ler / inserir/editar palpites (apenas jogos não realizados) |
| GET | `/api/bolao/visualizacao` | todos os jogos × palpites × pontos por jogo |
| GET | `/api/bolao/classificacao` | ranking dos apostadores |

---

## Como obter os dados e regras (durante a implementação)

| Dado | Fonte | Como |
|---|---|---|
| 12 grupos + 48 seleções (sorteio 05/12/2025) | Wikipédia "2026 FIFA World Cup" / FIFA.com | Coleta via firecrawl/scrape → `teams.json`, `groups.json` |
| 104 jogos: data, hora, cidade, estádio | Wikipédia / ESPN / FIFA | Horários em hora local da sede → **converter para GMT-3** ao popular `matches.json` |
| Ranking FIFA (desempate) | Ranking oficial FIFA | Campo em `teams.json` |
| Critérios de desempate (Art. 13) | Regulamento oficial FIFA | Confronto direto antes do saldo geral → `config.json` |
| Pontuação de fair play (cartões) | Regulamento FIFA | amarelo −1, 2º amarelo −3, vermelho direto −4, amarelo+vermelho −5 → `config.json` |
| **Anexo C — 495 combinações** dos terceiros | Regulamento FIFA (PDF) / Wikipédia "third-place allocation" | Transcrever a tabela determinística → `third-place-allocation.json` |
| Regras do bolão (15/10/5) | Definidas pelo usuário | `config.json` + `bolao.js` |

**Validação cruzada:** conferir que somam 104 jogos (72+32), 12 grupos × 6 jogos, e que cada uma das 495 linhas do Anexo C atribui 8 terceiros sem repetir confronto nem cruzar com o próprio grupo.

Fontes de referência:
- [2026 FIFA World Cup — Wikipedia](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup)
- [World Cup 2026 groups: how teams qualify and tie-breakers — FIFA](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers)
- [2026 FIFA World Cup: format, tiebreakers, schedule — ESPN](https://www.espn.com/soccer/story/_/id/47108758/2026-fifa-world-cup-format-tiebreakers-fixtures-schedule)
- [Third-place allocation explained](https://wc2026.app/blog/third-place-rule-explained)

---

## Etapas de implementação

1. **Esqueleto do projeto** em `C:\Users\pac-m\dev\codebase\paccopa`: `package.json`, Express, `storage.js` (gravação atômica + backup), `start.cmd`, estrutura de pastas; marca "Pac Copa 2026".
2. **Coleta de dados reais** → popular `teams.json`, `groups.json`, `stadiums.json`, `matches.json` (104 jogos, horários em GMT-3) e `third-place-allocation.json` (Anexo C).
3. **Engine de cálculo** (`src/logic/`): `fairplay.js` → `standings.js` → `thirds.js` → `bracket.js` → `scorers.js` → `timezone.js`, com testes pontuais por função.
4. **API REST** da Copa: `GET` partidas/classificação/terceiros/chave/artilharia; `PUT` partida (edição) + sorteios de desempate.
5. **Frontend da Copa**: páginas 1–6 consumindo a API.
6. **Dados de mata-mata**: slots e propagação automática de vencedores/perdedores.
7. **Bolão**: `bolao.js` (pontuação 15/10/5), `bolao-users.json`/`bolao-guesses.json`, API do bolão e páginas 7–10.
8. **Acabamento**: layout pt-BR, indicadores de "classificado/provisório", validações de formulário, identidade visual "Pac Copa 2026".

---

## Verificação (teste de ponta a ponta)

- `npm start` e abrir `http://localhost:3000` — todas as páginas carregam com os dados reais e a marca "Pac Copa 2026".
- **Cenário de grupos**: inserir resultados de um grupo inteiro e conferir a classificação contra cálculo manual, incluindo empate por confronto direto e por fair play.
- **Empate total**: forçar empate em todos os critérios → conferir fallback alfabético e depois inserir o vencedor do sorteio, vendo a tabela atualizar.
- **Terceiros + Anexo C**: simular a conclusão de todos os grupos e validar que os 8 terceiros caem nos confrontos corretos para uma combinação conhecida do Anexo C.
- **Propagação**: concluir um jogo de mata-mata e ver o vencedor na fase seguinte; concluir as semifinais e ver os perdedores na disputa de 3º lugar.
- **Bolão — pontuação**: para um jogo com resultado conhecido, conferir os 4 casos: placar exato (15), vencedor/empate certo sem placar (10), total de gols certo com vencedor errado (5) e erro total (0).
- **Bolão — palpites**: só aparecem para palpite jogos com adversários definidos; ao inserir um resultado, o jogo deixa de ser editável para palpite e passa a exibir pontos na visualização.
- **Bolão — classificação**: somatório por usuário confere com a tela de visualização.
- **Persistência**: reiniciar o servidor e confirmar que resultados e palpites foram gravados nos JSON (com backup em `data/backups/`).
- **Fuso**: conferir que um jogo com hora local conhecida aparece corretamente em GMT-3.
- **Artilharia**: inserir gols e validar a contagem por jogador/seleção.

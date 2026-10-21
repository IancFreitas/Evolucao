# System Ascension (pasta Evolucao)

PWA de RPG de evolução pessoal: hábitos viram XP, níveis, atributos, classes, dungeons, conquistas e loja. Dados só no aparelho (IndexedDB). Responda ao dono em português do Brasil, curto e direto.

- Stack: HTML, CSS e JS em módulos ES puros, sem build e sem dependências de runtime. Node 22 só para testes; Python 3 só para servir estáticos.
- Comandos: `npm start` (servidor em http://localhost:8080) e `npm test` (`node --test tests/*.test.mjs`).

## Onde está cada coisa
- `docs/ARQUITETURA.md`: camadas, princípios (fonte das regras R1–R5, R7, R8) e como expandir.
- `docs/INTEGRACOES.md`: importadores e fila de confirmação (R6, R9). `docs/SAUDE-IPHONE.md`: integração com o app Saúde (R11).
- `src/core/` regras puras (testadas); `src/storage/` IndexedDB, migrações, backup; `src/services/` notificações e importadores; `src/ui/` casca, componentes e `views/`.
- `sw.js` (offline, `VERSION`, `SHELL`), `tests/core.test.mjs`, `README.md` (tabelas de conquistas e XP).

## Regras que não podem escapar (resumo; R1–R9 e R11 têm fonte nos docs acima; R10, R12 e R13 estão no código: `db.js`, `backup.js`, `sw.js`)
- R1 XP, moedas e atributos nunca são campos editáveis: são somas do livro-razão; nível, classe e recordes são derivados.
- R2 Chaves únicas impedem duplicidade (`m:<missão>:<dia>`, `ext:<origem>:<id>`).
- R3 Reconciliação, não contadores; desfazer remove a recompensa.
- R4 Conquistas são permanentes.
- R5 Mudança de regra vale só daqui pra frente (a entrada guarda o XP do momento).
- R6 O que vem de fora só gera progresso após confirmação na fila.
- R7 Tela nova: `src/ui/views/<nome>.js` + `VIEWS` em `src/ui/app.js` + `SHELL` do `sw.js`.
- R8 Regra/atributo novo: `defaults.js` + migração aditiva (`fill`) em `migrations.js`. `SCHEMA_VERSION` só sobe em mudança incompatível de forma (renomear/mover/converter), com migração ramificada por versão e teste com backup antigo.
- R9 Integração nova: itens `{source, externalId, date, title, activity}` e `engine.addPending`.
- R10 Privacidade: nada sai do aparelho (sem servidor, CDN, rastreador ou fetch externo), salvo backup exportado.
- R11 Saúde: a parte do link após `#` nunca vai ao servidor; só os últimos 30 dias.
- R12 Backup com senha usa AES-GCM + PBKDF2 (250.000 iterações); sem senha é JSON simples.
- R13 Service worker: rede primeiro, cache como reserva; `SHELL` é lista manual.

## Checklist de feature
1. Regra em `src/core/` (pura) e teste em `tests/core.test.mjs`.
2. Tela nova: view + `VIEWS` + `SHELL` (R7). Arquivo novo carregado pelo app também entra no `SHELL`.
3. Estado novo: defaults + migração aditiva (R8); `SCHEMA_VERSION` só se a forma mudar de modo incompatível.
4. Incrementar `VERSION` do `sw.js` ao mudar a lista `SHELL` (a troca limpa o cache antigo; com rede primeiro, editar um arquivo já listado chega online sem bump). Hoje `sa-v10`.
5. Atualizar o `README.md` (tabelas de conquistas e XP) e rodar `npm test`.

**Atenção:** o workflow `.github/workflows/pages.yml` publica no GitHub Pages a cada push em `claude/system-ascension-rpg-ml5zrf` (roda `npm test` antes). Push = publicação pública.

## Equipe de agentes (obrigatório)

Todo trabalho feito neste projeto passa por uma equipe de quatro subagentes, definidos em `.claude/agents/` (do projeto ou de `~/.claude/agents/`):

| Papel   | Agente    | Modelo | Faz o quê |
|---------|-----------|--------|-----------|
| Júnior  | `junior`  | haiku  | Trabalho braçal: levantar arquivos/dados, mudanças mecânicas, rodar comandos e testes, rascunhos |
| Pleno   | `pleno`   | sonnet | Implementa a parte principal e revisa o Júnior |
| Sênior  | `senior`  | sonnet | Partes difíceis, revisão adversarial, consolida a discussão |
| Gerente | `gerente` | opus   | Decide: `APROVADO` ou `REFAZER` (e quem refaz) |

A sessão principal é a **orquestradora**: ela divide o trabalho, repassa as entregas de um para o outro e só fala com o usuário depois da decisão do Gerente. Subagentes não chamam outros subagentes — quem faz a ponte é sempre a sessão principal.

Os subagentes editam direto na árvore de trabalho; um `REFAZER` parte do estado atual. Tarefas em paralelo só podem tocar arquivos disjuntos.

### Fluxo de cada tarefa

1. **Divisão** — a orquestradora quebra o pedido em partes e atribui cada uma: braçal → Júnior, implementação → Pleno, arquitetura/riscos → Sênior. Partes independentes rodam em paralelo.
2. **Execução** — cada um entrega no formato do seu arquivo de agente.
3. **Discussão** — antes de ir ao Gerente, a equipe discute:
   - o Pleno recebe a entrega do Júnior e responde (concorda, corrige, discorda);
   - o Sênior recebe as entregas e a resposta do Pleno, faz a revisão adversarial e consolida uma proposta, registrando divergências em aberto;
   - se o Sênior discordar de algo do Pleno, a orquestradora devolve ao Pleno uma vez para réplica (use `SendMessage` para continuar o mesmo agente; sem `SendMessage`, reinvoque o agente colando o contexto anterior);
   - a orquestradora sempre cola a transcrição completa (entregas + réplicas) no prompt do próximo membro, e não um resumo dela.
4. **Decisão** — o Gerente recebe o pedido original do usuário + todas as entregas + a discussão e responde `DECISÃO: APROVADO` ou `DECISÃO: REFAZER`. Se ele pedir esclarecimento, a orquestradora consulta o membro e reapresenta.
5. **Refazer** — se `REFAZER`, a orquestradora devolve o trabalho a quem o Gerente indicou, com o critério de aceite dele, e repete os passos 3–4. Limite de **3 rodadas**; se ainda não aprovar, leva ao usuário o impasse e as opções.
6. **Entrega** — só depois de `APROVADO` a orquestradora dá o trabalho por concluído (commit/push/PR só se o usuário pediu) e responde ao usuário, citando de forma curta o que cada membro fez e a decisão do Gerente.

### Proporcionalidade

- Perguntas simples de informação (sem mudança em arquivo nem ação externa) podem ser respondidas direto, sem acionar a equipe.
- Tarefas pequenas podem pular o Júnior ou o Pleno, mas **nunca** pulam o Sênior e o Gerente quando há mudança em código, arquivos ou ações externas.

<!-- fim-equipe -->

## A equipe neste projeto

Regra geral: custo proporcional ao risco. O fluxo, a discussão e as 3 rodadas são os da seção acima; aqui só se diz quem faz o quê em cada processo.

O Sênior e o Gerente participam de toda mudança em arquivos (regra da seção acima); o que muda é a profundidade. **Revisão completa do Sênior** (adversarial, com caminho concreto de falha) quando o diff tocar: livro-razão (`ledger.js`), `engine.js`, `storage/` (db, backup, migrações), `migrations.js`/`SCHEMA_VERSION`, `sw.js` (VERSION/SHELL/cache) ou qualquer coisa ligada a privacidade (R10–R12, rede, `fetch`, bibliotecas externas). Fora disso, o Sênior faz uma passada curta no diff e o parecer é curto.

| Processo | Júnior (paralelo no início) | Pleno | Sênior | Gerente / dono |
|---|---|---|---|---|
| Feature | `npm test` de base; lista dos arquivos a tocar (view, VIEWS, SHELL, README); depois confere o checklist | Regra, view, testes | Revisão de R1–R5; completa se tocar os itens acima | Gerente decide; dono aprova o escopo; push só se o dono pedir |
| Ajuste de regra/XP | Lista valores atuais em `defaults.js` e tabela do README | Altera valores e testes | Checa efeito em dados existentes (R5) e no livro-razão | Dono aprova o balanceamento |
| Bug | Reproduz e roda os testes | Corrige + teste de regressão (se for regra) | Passada curta; completa se tocar storage, `sw.js` ou privacidade | Gerente decide; push só se o dono pedir |
| Migração | Levanta os campos novos e o teste de backup antigo (`core.test.mjs`, “migração preenche campos ausentes”) | Escreve a migração (modo fill) e o teste com backup antigo | Completa; propõe o `SCHEMA_VERSION` | Dono aprova |
| Integração | Levanta o formato de entrada e os exemplos (`docs/exemplos/`, `tests/fixtures/`) | Adaptador + `engine.addPending` + teste de duplicidade | Completa (privacidade, fila R6) | Dono aprova |
| Publicar | Confere workflow, `VERSION` e `npm test` | Bump do `VERSION`/`SHELL` se faltar | Revisa mudança de SHELL/cache (completa) | Push só com pedido do dono (é público) |

Paralelismo: Júnior (levantamento/testes de base) roda junto com o Pleno em arquivos disjuntos; README e tabelas podem ir para o Júnior enquanto o Pleno codifica, desde que o Pleno revise. Dois membros nunca editam o mesmo arquivo na mesma rodada.

Pode pular: Júnior em mudanças de uma ou duas linhas; Pleno quando o Sênior já implementa a parte difícil; texto/README sem código ainda passa por Sênior e Gerente, mas de forma curta.

Pontos de aprovação do dono: escopo de feature nova, balanceamento de XP/recompensas, mudança de `SCHEMA_VERSION`, qualquer push (publica no Pages) e qualquer coisa que altere a promessa de privacidade.

### Pendências conhecidas
- Resolvidas: contagem de conquistas no README (41), ícone maskable no `SHELL` (`sa-v10`), gatilho inexistente `main` removido do `pages.yml` e documentação de `SCHEMA_VERSION` alinhada ao código (migração aditiva `fill`; versão sobe só em mudança incompatível de forma; segue em 1 porque não houve mudança incompatível até hoje).
- Atenção futura: `migrate()` sempre regrava `s.version` (`migrations.js:54`), então backup de versão maior é aceito e rebaixado. Hoje não tem efeito; se `SCHEMA_VERSION` subir, rejeitar backups de versão maior.

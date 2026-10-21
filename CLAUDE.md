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

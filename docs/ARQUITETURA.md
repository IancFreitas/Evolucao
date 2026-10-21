# Arquitetura

```
index.html, manifest.webmanifest, sw.js   PWA (instalação, offline, lembretes periódicos)
src/
  core/        Regras de evolução: puras, sem DOM e sem armazenamento (testadas em tests/)
    dates.js         chaves de dia locais, semanas ISO
    defaults.js      atributos, atividades, regras, recompensas e estado inicial
    levels.js        curva de níveis, níveis de atributo, classes e benefícios
    ledger.js        livro-razão: toda pontuação é uma entrada com chave única
    missions.js      agenda, períodos, chaves de conclusão
    streaks.js       sequências não punitivas
    achievements.js  conquistas e títulos
    analytics.js     agregações do painel
    engine.js        ações (concluir, registrar, comprar...) e derivação do estado
  storage/     IndexedDB (+ fallback), migrações de esquema, backup/criptografia
  services/    notificações e importadores (ics, csv, json)
  ui/          casca (app.js), componentes (dom.js, charts.js) e telas (views/)
```

## Princípios

1. **Livro-razão como fonte da verdade.** XP, moedas e atributos nunca são campos editáveis: são somas das
   entradas de `state.log`. Nível, classe, sequência e recordes são **derivados** a cada renderização.
2. **Chaves únicas impedem duplicidade.** Ex.: `m:<missão>:<dia>` para diárias, `m:<missão>:<semana ISO>`
   para semanais, `bonus:<dia>`, `boss:<missão>:<etapa>`, `ext:<origem>:<id externo>` para importações.
3. **Reconciliação em vez de contadores.** O bônus diário e os marcos de missões principais existem se e
   somente se a condição é verdadeira; desfazer uma ação remove a recompensa correspondente.
4. **Conquistas são permanentes.** Sequências interrompidas não apagam nada; o recorde é preservado.
5. **Mudanças de regra valem daqui pra frente.** Cada entrada guarda o XP e as moedas do momento do registro.

## Fluxo de uma ação

```
UI (clique) → run(mutator) → store.mutate(rascunho clonado)
            → engine.act(): deriva antes → executa → avalia conquistas → deriva depois → eventos
            → salva (IndexedDB, com atraso de 250 ms) → re-renderiza → feedback (toast, nível, notificação)
```
Se a regra recusar a ação (`RuleError`), o rascunho é descartado e o usuário vê a mensagem.

## Expansão

- Nova tela: criar `src/ui/views/<nome>.js` exportando `{ id, title, icon, render, actions, forms, changes }`
  e registrá-la em `VIEWS` (`app.js`) e no `SHELL` do `sw.js`.
- Nova regra/atributo: `defaults.js` + migração em `storage/migrations.js`. A migração é aditiva (`fill`): completa campos
  ausentes e funciona sem consultar a versão, então um campo novo com valor padrão **não** exige incrementar
  `SCHEMA_VERSION`. Incremente só em mudança incompatível de forma (renomear, mover ou converter dados existentes),
  e então a migração deve ramificar por `s.version` e ter teste com backup antigo. Hoje nada lê `version` para decidir
  a migração; `migrate` apenas a regrava.
- Nova integração: produzir itens `{ source, externalId, date, title, activity }` e chamar `engine.addPending`.

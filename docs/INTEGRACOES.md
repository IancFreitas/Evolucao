# Integrações

Todas as integrações seguem a mesma regra: **o que vem de fora só gera progresso depois da sua confirmação**
(tela *Registrar → Aguardando confirmação*). Cada item tem um identificador externo; importar o mesmo
arquivo duas vezes não duplica nada. Registros importados podem ter até 30 dias (configurável no código em
`importWindowDays`) e seguem os mesmos limites diários das atividades manuais.

## Calendário (.ics)

Exporte sua agenda (Google Agenda: Configurações → Importar e exportar; Outlook e Apple Calendar também
exportam .ics) e importe em *Ajustes → Integrações → Calendário*.

- Eventos de hoje ou passados → itens para confirmar ("Você fez isso?").
- Eventos dos próximos 60 dias → opção de criar missões especiais com prazo.
- A atividade é sugerida por palavras-chave (academia, corrida, aula, leitura, reunião…), e você pode trocá-la.
- *Exportar prazos* gera um .ics com as missões que têm prazo, para levar de volta ao seu calendário.

## CSV (tarefas, atividade física, estudos)

Separador `,` ou `;`. Colunas reconhecidas (maiúsculas/minúsculas tanto faz):

| Campo | Nomes aceitos |
| --- | --- |
| Data (obrigatório) | `data`, `date`, `activity date`, `completed`, `completed at`, `dia`, `start time` |
| Título (obrigatório) | `titulo`, `title`, `name`, `nome`, `activity name`, `content`, `tarefa`, `task` |
| Tipo | `atividade`, `activity`, `tipo`, `type`, `activity type`, `categoria`, `project` |
| Identificador | `id`, `activity id`, `task id` (sem ele, é gerado um hash de data+título+tipo) |
| Concluída | `concluida`, `completed`, `done`, `status` (linhas `false`, `não`, `pendente` são ignoradas) |
| Duração | `duracao`, `duration`, `elapsed time`, `moving time` (apenas informativa) |

Datas em `AAAA-MM-DD`, `DD/MM/AAAA` ou ISO. O `activities.csv` do Strava funciona diretamente.
Exemplo: [exemplos/atividades.csv](exemplos/atividades.csv).

## Central de Inteligência Pessoal (JSON)

Qualquer sistema seu pode gerar um arquivo (ou texto para colar) neste formato:

```json
{
  "source": "central",
  "events": [
    { "id": "ci-001", "date": "2026-10-18", "activity": "estudo", "title": "Revisão de algoritmos", "detail": "45 min" }
  ]
}
```

- `id`: único por evento na origem (evita duplicidade).
- `activity`: chave de uma atividade cadastrada (`treino`, `cardio`, `estudo`, `programacao`, `leitura`,
  `reflexao`, `planejamento`, `domestica`, `trabalho`, `financas`, `social`, `comunicacao`, `autocuidado`,
  `sono`, `descanso` ou as suas). Se faltar, é sugerida pelo título.

Exemplo: [exemplos/central.json](exemplos/central.json).

## Integrações em tempo real (futuras)

Google Agenda, Todoist, Health Connect, Apple Health e Strava oferecem APIs com OAuth. Para usá-las com
segurança é preciso um pequeno backend que guarde tokens e entregue eventos ao app. O ponto de extensão é
`engine.addPending(state, items)`: qualquer adaptador só precisa produzir itens no formato acima.

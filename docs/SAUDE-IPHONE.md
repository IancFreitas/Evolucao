# Conexão com o app Saúde do iPhone (Apple Health)

A Apple só libera o HealthKit para **apps nativos** de iOS: nenhum site ou PWA consegue ler o app Saúde
diretamente. O System Ascension usa dois caminhos que funcionam sem servidor e sem enviar dados para a internet.

| Caminho | O que traz | Automático? |
| --- | --- | --- |
| **Atalho do iPhone** | Sono, passos, minutos de exercício, atenção plena (e treinos, se você incluir) | Sim, com Automação diária |
| **Exportação do Saúde** (`export.zip` ou `export.xml`) | Tudo acima + **treinos por tipo** (musculação, corrida, ioga…) | Não (manual, quando quiser) |

Os dois geram os mesmos identificadores (`saude:<dia>:sono`, `saude:<início>:<treino>`…), então usar os dois
nunca duplica XP. Os dados viram registros só quando atingem as metas (Ajustes → Integrações → Saúde):

| Dado | Meta padrão | Atividade |
| --- | --- | --- |
| Sono | 7 h | Meta de sono cumprida (VIT, DISC) |
| Passos | 8.000 | Meta de passos (END, VIT) |
| Minutos de exercício | 30 min (só se não houver treino no dia) | Cardio |
| Atenção plena | 5 min | Reflexão (WIS) |
| Treino ≥ 15 min | força → Treino; ioga/pilates → Autocuidado; demais → Cardio | conforme o tipo |

Por padrão tudo entra na fila **Aguardando confirmação**. Se preferir, ative **Confirmar automaticamente dados do Saúde**.

## Caminho 1: Atalho

No app **Atalhos** → **+** (os nomes das ações podem variar um pouco conforme a versão do iOS):

1. **Buscar Amostras de Saúde**: tipo *Passos*, data de início *hoje*, agrupar por *Dia* → **Calcular Estatísticas** (*Soma*) → `Passos`.
2. O mesmo para *Minutos de Exercício* → `Exercicio` e *Minutos de Atenção Plena* → `Mente`.
3. **Buscar Amostras de Saúde**: *Análise do Sono*, data de término *hoje*, valor diferente de "Na cama" e "Acordado" →
   **Obter Detalhes** (*Duração*) → **Calcular Estatísticas** (*Soma*) → `Sono`.
4. **Data Atual** → **Formatar Data** (personalizado `yyyy-MM-dd`) → `Dia`.
5. **Dicionário**: `date`=Dia, `steps`=Passos, `exerciseMinutes`=Exercicio, `mindfulMinutes`=Mente, `sleepHours`=Sono.
6. Entrega:
   - **App instalado na tela de início** (recomendado): **Copiar para Área de Transferência** + **Mostrar Notificação**.
     No app: *Registrar* → **Colar dados do Saúde**. (O app instalado guarda dados separados do Safari, por isso não use link.)
   - **Usando no Safari**: **Codificar URL** + **Abrir URLs** com `https://SEU-ENDERECO/#/saude?j=` seguido do texto codificado.
     A parte depois do `#` nunca é enviada ao servidor.
7. Aba **Automação** → **Hora do Dia** (ex.: 22:00) → *Executar imediatamente*.

O app aceita durações em horas, minutos ou segundos (`sleepHours`, `sleepMinutes`, `sleepSeconds`; valores grandes
em `sleepHours` são convertidos), números com vírgula ou ponto de milhar, datas `AAAA-MM-DD` ou `DD/MM/AAAA`,
um dia só, uma lista ou `{ "days": [...] }`. Treinos opcionais: `"workouts": [{ "type": "Corrida", "minutes": 32, "start": "2026-10-18T07:00" }]`.
O link também aceita `?d=` com o JSON em Base64.

## Caminho 2: Exportação

App Saúde → sua foto → **Exportar Todos os Dados de Saúde** → **Salvar em Arquivos**. No System Ascension:
Ajustes → Integrações → **Importar exportação** e escolha o `export.zip` (não precisa descompactar).

- O arquivo é lido em fluxo no próprio aparelho (funciona com exportações de centenas de MB).
- Só os últimos 30 dias são considerados.
- Quando iPhone e Apple Watch registram o mesmo dado, vale a fonte com maior total do dia (sem soma dupla).
- "Na cama" não conta como sono; apenas as fases dormindo (núcleo, profundo, REM).

## Futuro

Sincronização totalmente automática e em segundo plano exige um pequeno app nativo de iOS (HealthKit) que envie
os mesmos dados para o System Ascension. A entrada (`summariesToItems` em `src/services/health.js`) já está pronta para isso.

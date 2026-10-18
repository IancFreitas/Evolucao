# System Ascension: RPG de Evolução Pessoal

Aplicativo web instalável (PWA) que transforma hábitos, estudos, treinos, trabalho e descanso em
evolução de personagem: XP, níveis, atributos, classes, títulos, conquistas e uma loja de recompensas.
Identidade visual original (tema escuro holográfico em azul elétrico, roxo e preto), inspirada na sensação
de progressão de RPGs, sem usar recursos gráficos protegidos.

## Como usar

O app é estático (HTML, CSS e JavaScript puro), sem build e sem dependências.

```bash
npm start            # ou: python3 -m http.server 8080
# abra http://localhost:8080
npm test             # testes das regras de evolução (Node 20+)
```

Para instalar no celular, publique a pasta em qualquer hospedagem HTTPS (por exemplo GitHub Pages:
Settings → Pages → branch e pasta raiz) e use "Adicionar à tela inicial" / "Instalar app".
Os dados ficam salvos no dispositivo (IndexedDB) e continuam lá após fechar a página.

## O que está implementado

| Área | Funcionalidades |
| --- | --- |
| Personagem | Nome, classe, título ativo, nível, barra de XP, moedas, sequência, escudos |
| Atributos | STR, END, INT, WIS, DISC, CHA, VIT, que evoluem **apenas** por ações registradas |
| XP | Valores configuráveis por atividade e por tipo de missão, curva progressiva editável, bônus diário |
| Anti-exploração | Conclusão única por período, retornos decrescentes, limite diário, intervalo mínimo, sem registros futuros, retroativos limitados, chaves únicas no livro-razão |
| Missões | Diárias (dias da semana, essenciais, versão leve), semanais, principais (progresso + marcos 25/50/75%), especiais, Boss Battles (etapas e HP). Criar, editar, adiar, pausar, concluir, desfazer, excluir |
| Classes | Aprendiz → Explorador → Estrategista → Especialista → Mestre → Ascendente, com requisitos de nível e equilíbrio e benefícios (temas, escudos, bônus de moedas) |
| Conquistas | 33 conquistas (comum, rara, épica, lendária), títulos especiais (ex.: 30 dias de estudo = "Arquiteto do Conhecimento"), permanentes |
| Loja e inventário | Recompensas pessoais com custo, limite semanal e intervalo; inventário com usar/devolver |
| Análise | XP diário/semanal/mensal, radar e evolução dos atributos, hábitos por dia, mapa de consistência, missões principais, histórico de níveis, áreas de dedicação e de atenção, recordes |
| Recuperação | Estados do dia (normal, difícil, descanso planejado, doente, imprevisto), dias protegidos, escudos semanais, bônus de retomada, conquista "Fênix", recordes nunca perdidos |
| Integrações | Importação de calendário (.ics), tarefas, atividade física e estudos (.csv) e Central de Inteligência (JSON), sempre via **fila de confirmação**; exportação de prazos em .ics |
| Notificações | Missões do dia, revisão semanal, objetivos, nível, conquistas, atributos; horários configuráveis e desativação individual; caixa de entrada no app |
| Dados | Backup JSON (opcionalmente criptografado com senha, AES-256-GCM), restauração, CSV do histórico, 7 pontos de restauração automáticos, exclusão total |

## Valores padrão de XP

| Ação | XP |
| --- | --- |
| Atividade física planejada | +40 |
| Sessão de estudo | +30 |
| Leitura de 20 minutos | +20 |
| Tarefa doméstica planejada | +15 |
| Tarefa importante do trabalho | +35 |
| Autocuidado | +20 |
| Completar as missões essenciais do dia | +50 de bônus |

Tudo é editável em **Ajustes → Regras de pontuação** e **Ajustes → Atividades**.
Com ~200 XP/dia, o nível 10 chega em cerca de 1 mês e o nível 50 em pouco mais de 2 anos.

## O que depende de integrações adicionais

- **Sincronização automática** com Google Agenda, Todoist, Google Fit / Health Connect, Apple Health ou
  Strava: exige login OAuth e um backend para guardar tokens com segurança. Hoje a integração é por
  arquivo exportado desses serviços, e um adaptador futuro só precisa gerar itens para a mesma fila.
- **Notificações garantidas com o app fechado**: exigem um servidor Web Push. Hoje os lembretes disparam
  com o app aberto ou em segundo plano e, no Chrome/Edge com o app instalado, por verificação periódica.
- **Sincronização entre dispositivos**: hoje é feita por backup/restauração; nuvem com criptografia ponta a
  ponta é uma expansão possível.

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) e [docs/INTEGRACOES.md](docs/INTEGRACOES.md).

import * as E from '../../core/engine.js';
import { ATTRIBUTES, DEFAULT_RULES } from '../../core/defaults.js';
import { THEMES, totalXpForLevel } from '../../core/levels.js';
import { MISSION_TYPES } from '../../core/missions.js';
import { addDays, formatDay, weekdayName } from '../../core/dates.js';
import { NOTIFICATION_TYPES, permission, registerPeriodicSync, requestPermission, systemNotify } from '../../services/notifications.js';
import { csvToItems, icsToItems, jsonToItems, missionsToIcs } from '../../services/integrations.js';
import { buildBackup, download, isEncrypted, logToCsv, parseBackup } from '../../storage/backup.js';
import { get as dbGet, listSnapshots, wipeAll } from '../../storage/db.js';
import { migrate } from '../../storage/migrations.js';
import { BACKUP_FOLDER, backupStatusText, saveBackupToCloud } from '../cloud.js';
import { healthForms, healthSummaryLine, importHealthFile, pasteHealth } from '../health.js';
import { closeModal, confirmDialog, esc, fmt, icon, openModal, pickFile, promptDialog, readFile, toast } from '../dom.js';
import { render as rerender, run, store, ui } from '../app.js';

const TABS = { profile: 'Perfil', rules: 'Regras de pontuação', activities: 'Atividades', notifications: 'Notificações', integrations: 'Integrações', data: 'Dados e privacidade' };

function profileTab(c) {
  return `<form data-form="profile" class="form-grid"><label class="field">Nome do personagem<input name="name" maxlength="40" value="${esc(c.state.profile.name)}"></label>
    <div class="full"><button class="btn primary sm">Salvar</button></div></form>
    <div class="hud mt">Tema visual</div>
    <div class="chips">${Object.entries(THEMES).map(([k, t]) => {
      const unlocked = c.d.perks.themes.includes(k);
      return `<button class="chip ${c.state.profile.theme === k ? 'accent' : ''}" data-action="set-theme" data-theme="${k}" ${unlocked ? '' : 'disabled data-tip="Desbloqueie evoluindo de classe"'} style="cursor:pointer;${unlocked ? '' : 'opacity:.45'}">
        <i style="width:12px;height:12px;border-radius:50%;background:linear-gradient(135deg,${t.accent},${t.accent2})"></i>${esc(t.name)}${unlocked ? '' : ' 🔒'}</button>`;
    }).join('')}</div>`;
}

function rulesTab(c) {
  const r = c.state.settings.rules;
  const lv = [5, 10, 20, 35, 50].map((l) => ({ l, xp: totalXpForLevel(l, r) }));
  const num = (name, label, val, attrs = '', hint = '') => `<label class="field">${label}<input name="${name}" type="number" ${attrs} value="${val}">${hint ? `<span class="dim" style="font-weight:400;font-size:12px">${hint}</span>` : ''}</label>`;
  return `<form data-form="rules" class="form-grid">
    <div class="full hud">Curva de níveis</div>
    ${num('levelBase', 'XP base por nível', r.levelBase, 'min="20" max="2000"')}
    ${num('levelExponent', 'Crescimento (expoente)', r.levelExponent, 'min="1" max="2.5" step="0.05"', 'XP do nível N = base × N^expoente')}
    <div class="full notice" style="font-size:13px">Com ~200 XP/dia: ${lv.map((x) => `nível ${x.l} em <b>${fmt(x.xp)} XP</b> (~${Math.round(x.xp / 200)} dias)`).join(' · ')}</div>
    <div class="full hud mt-s">Bônus e moedas</div>
    ${num('dailyBonus', 'Bônus por completar as essenciais do dia', r.dailyBonus, 'min="0" max="1000"')}
    ${num('lightFactor', 'Fator das missões leves (0,1–1)', r.lightFactor, 'min="0.1" max="1" step="0.05"')}
    ${num('coinRate', 'Moedas por XP', r.coinRate, 'min="0" max="2" step="0.01"')}
    ${num('comebackBonus', 'Bônus de retomada (XP)', r.comebackBonus, 'min="0" max="500"')}
    ${num('comebackGapDays', 'Dias de pausa para bônus de retomada', r.comebackGapDays, 'min="1" max="60"')}
    ${num('shieldsPerWeek', 'Escudos de sequência por semana', r.shieldsPerWeek, 'min="0" max="7"', 'Classes concedem escudos extras')}
    <div class="full hud mt-s">Anti-exploração</div>
    <label class="field">Retornos decrescentes (por repetição)<input name="diminishing" value="${r.diminishing.join(', ')}"><span class="dim" style="font-weight:400;font-size:12px">Multiplicadores do 1º, 2º, 3º... registro livre da mesma atividade no dia</span></label>
    ${num('cooldownMinutes', 'Intervalo mínimo entre repetições (min)', r.cooldownMinutes, 'min="0" max="1440"')}
    ${num('backdateDays', 'Dias permitidos para registro retroativo', r.backdateDays, 'min="0" max="7"')}
    ${num('dungeonCooldownHours', 'Portão fechado após falhar no chefe (horas)', r.dungeonCooldownHours, 'min="0" max="168"')}
    ${num('dayStartHour', 'Hora de virada do dia (0–8)', r.dayStartHour, 'min="0" max="8"', 'Ex.: 4 = atividades até 3h59 contam no dia anterior')}
    <div class="full hud mt-s">XP padrão por tipo de missão</div>
    ${Object.keys(r.missionTypeXp).filter((t) => t !== 'daily').map((t) => num(`mt_${t}`, MISSION_TYPES[t].single, r.missionTypeXp[t], 'min="0" max="5000"')).join('')}
    <div class="full modal-actions" style="justify-content:flex-start"><button class="btn primary">Salvar regras</button><button type="button" class="btn ghost" data-action="rules-reset">Restaurar padrão</button></div>
  </form>
  <p class="muted" style="font-size:13px">Mudanças valem para registros futuros: o XP já conquistado é preservado. Alterar a curva recalcula seu nível com base no XP total.</p>`;
}

function activitiesTab(c) {
  return `<div class="row between wrap" style="margin-bottom:10px"><p class="muted" style="margin:0;font-size:13px">Cada atividade define XP, atributos desenvolvidos e limite diário de registros.</p>
    <button class="btn primary sm" data-action="act-new">${icon('plus')} Nova atividade</button></div>
    <div class="table-wrap"><table class="rules"><thead><tr><th>Atividade</th><th>XP</th><th>Atributos</th><th>Limite/dia</th><th></th></tr></thead><tbody>
    ${c.state.settings.activities.map((a) => `<tr><td>${a.icon} ${esc(a.name)}</td><td class="mono">${a.xp}</td>
      <td class="mono" style="font-size:12px">${Object.entries(a.attrs).map(([k, v]) => `<span style="color:${ATTRIBUTES.find((x) => x.key === k)?.color}">${k}+${v}</span>`).join(' ')}</td>
      <td class="mono">${a.dailyLimit}</td><td style="white-space:nowrap"><button class="btn icon sm ghost" data-action="act-edit" data-key="${a.key}" aria-label="Editar">${icon('edit')}</button>
      <button class="btn icon sm ghost" data-action="act-delete" data-key="${a.key}" aria-label="Excluir">${icon('trash')}</button></td></tr>`).join('')}
    </tbody></table></div>`;
}

function activityForm(a = null) {
  openModal(a ? 'Editar atividade' : 'Nova atividade', `<form data-form="activity" class="form-grid">
    <input type="hidden" name="originalKey" value="${esc(a?.key || '')}"><input type="hidden" name="key" value="${esc(a?.key || '')}">
    <label class="field">Ícone (emoji)<input name="icon" maxlength="4" value="${esc(a?.icon || '⭐')}"></label>
    <label class="field">Nome<input name="name" required maxlength="60" value="${esc(a?.name || '')}"></label>
    <label class="field">XP base<input name="xp" type="number" min="1" max="1000" value="${a?.xp ?? 20}"></label>
    <label class="field">Limite de registros por dia<input name="dailyLimit" type="number" min="1" max="10" value="${a?.dailyLimit ?? 2}"></label>
    <div class="full hud">Pontos de atributo por registro</div>
    ${ATTRIBUTES.map((x) => `<label class="field"><span style="color:${x.color}">${x.key} · ${esc(x.name)}</span><input name="attr_${x.key}" type="number" min="0" max="10" value="${a?.attrs?.[x.key] || 0}"></label>`).join('')}
    <div class="full modal-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
}

function notificationsTab(c) {
  const n = c.state.settings.notifications;
  const perm = permission();
  const permText = { granted: 'permitidas', denied: 'bloqueadas no navegador', default: 'ainda não autorizadas', unsupported: 'não suportadas neste navegador' }[perm];
  return `<div class="notice ${perm === 'granted' ? 'ok' : 'warn'}">Notificações do sistema: <b>${permText}</b>.
      ${perm === 'denied' ? 'Libere nas configurações do site no navegador.' : ''}</div>
    <div class="stack mt">
      <label class="check"><input type="checkbox" data-change="notif-master" ${n.enabled ? 'checked' : ''}> <b>Ativar notificações</b></label>
      ${Object.entries(NOTIFICATION_TYPES).map(([k, label]) => {
        const on = typeof n[k] === 'object' ? n[k].on : n[k];
        let extra = '';
        if (k === 'daily') extra = `<input type="time" value="${esc(n.daily.time)}" data-change="notif-time" data-type="daily" style="width:auto" aria-label="Horário das missões do dia">`;
        if (k === 'weekly') extra = `<select data-change="notif-day" style="width:auto" aria-label="Dia da revisão">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${Number(n.weekly.day) === d ? 'selected' : ''}>${weekdayName(d)}</option>`).join('')}</select>
          <input type="time" value="${esc(n.weekly.time)}" data-change="notif-time" data-type="weekly" style="width:auto" aria-label="Horário da revisão semanal">`;
        return `<div class="row wrap" style="${n.enabled ? '' : 'opacity:.5'}"><label class="check" style="min-width:230px"><input type="checkbox" data-change="notif-type" data-type="${k}" ${on ? 'checked' : ''}> ${label}</label>${extra}</div>`;
      }).join('')}
      <div><button class="btn sm" data-action="notif-test">${icon('bell')} Enviar notificação de teste</button></div>
    </div>
    <p class="muted mt" style="font-size:13px">Eventos (nível, conquistas, objetivos, atributos) notificam na hora. Lembretes de horário disparam com o app aberto ou em segundo plano;
    com o app instalado em navegadores compatíveis (Chrome/Edge no Android e desktop), uma verificação periódica também ocorre com o app fechado.
    Notificações garantidas com o app fechado exigem um servidor de push (expansão futura).</p>`;
}

function healthCard(c) {
  const h = c.state.settings.health;
  const num = (name, label, val, attrs) => `<label class="field">${label}<input name="${name}" type="number" ${attrs} value="${val}"></label>`;
  return `<div class="panel flat mt" style="border:1px solid rgba(255,92,122,.35);box-shadow:none">
    <div class="panel-title"><h3>❤️ Saúde do iPhone (Apple Health)</h3><span class="muted" style="font-size:12px">${esc(healthSummaryLine(c.state))}</span></div>
    <p class="muted" style="margin-top:0;font-size:13px">Navegadores não acessam o app Saúde diretamente (a Apple libera o HealthKit só para apps nativos).
    Por isso a conexão usa um <b>Atalho do iPhone</b>, que pode rodar sozinho todo dia, ou a <b>exportação do Saúde</b>. Sono, passos, minutos de exercício,
    atenção plena e treinos viram registros quando atingem as metas abaixo. Os dados ficam só no seu aparelho.</p>
    <div class="row wrap">
      <button class="btn sm primary" data-action="health-paste">${icon('upload')} Colar dados do Atalho</button>
      <button class="btn sm" data-action="health-file">${icon('upload')} Importar exportação (.zip ou .xml)</button>
      <button class="btn sm ghost" data-action="health-guide">Como configurar o Atalho</button>
    </div>
    <form data-form="health-settings" class="form-grid mt">
      ${num('sleepGoal', 'Meta de sono (horas)', h.sleepGoal, 'min="3" max="12" step="0.25"')}
      ${num('stepsGoal', 'Meta de passos', h.stepsGoal, 'min="500" max="50000" step="500"')}
      ${num('exerciseGoal', 'Meta de minutos de exercício', h.exerciseGoal, 'min="5" max="300"')}
      ${num('mindfulGoal', 'Meta de atenção plena (min)', h.mindfulGoal, 'min="1" max="120"')}
      ${num('minWorkoutMinutes', 'Duração mínima de um treino (min)', h.minWorkoutMinutes, 'min="1" max="300"')}
      <label class="check" style="align-self:end;padding-bottom:9px"><input type="checkbox" name="autoConfirm" ${h.autoConfirm ? 'checked' : ''}> Confirmar automaticamente dados do Saúde</label>
      <div class="full"><button class="btn sm">Salvar metas</button></div>
    </form></div>`;
}

function healthGuide() {
  const link = `${location.origin}${location.pathname}#/saude?j=`;
  openModal('Atalho: Saúde → System Ascension', `<div class="stack" style="font-size:14px">
    <p class="muted" style="margin:0">No iPhone, abra o app <b>Atalhos</b> → <b>+</b> e adicione as ações abaixo (os nomes podem variar um pouco conforme a versão do iOS).</p>
    <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
      <li><b>Buscar Amostras de Saúde</b> (Find Health Samples): tipo <i>Passos</i>, data de início <i>hoje</i>, agrupar por <i>Dia</i>.
        Depois <b>Calcular Estatísticas</b> → <i>Soma</i>. Renomeie o resultado para <code>Passos</code>.</li>
      <li>Repita para <i>Minutos de Exercício</i> → <code>Exercicio</code> e <i>Minutos de Atenção Plena</i> → <code>Mente</code>.</li>
      <li><b>Buscar Amostras de Saúde</b>: tipo <i>Análise do Sono</i>, data de término <i>hoje</i>, valor <i>não é</i> "Na cama" nem "Acordado".
        <b>Obter Detalhes</b> → <i>Duração</i> → <b>Calcular Estatísticas</b> → <i>Soma</i> → <code>Sono</code> (horas, minutos ou segundos: o app converte).</li>
      <li><b>Data Atual</b> → <b>Formatar Data</b> com formato personalizado <code>yyyy-MM-dd</code> → <code>Dia</code>.</li>
      <li><b>Dicionário</b> com as chaves: <code>date</code> = Dia, <code>steps</code> = Passos, <code>exerciseMinutes</code> = Exercicio,
        <code>mindfulMinutes</code> = Mente, <code>sleepHours</code> = Sono.</li>
      <li><b>App instalado na tela de início:</b> <b>Copiar para Área de Transferência</b> (o Dicionário) e <b>Mostrar Notificação</b> "Abra o Ascension e toque em Colar dados".
        No app: <i>Registrar</i> → <b>Colar dados do Saúde</b>.</li>
      <li><b>Usando no Safari (sem instalar):</b> em vez de copiar, use <b>Codificar URL</b> no Dicionário e <b>Abrir URLs</b> com:<br>
        <code style="word-break:break-all">${esc(link)}</code><i>[texto codificado]</i></li>
      <li>Para rodar sozinho: aba <b>Automação</b> → <b>Hora do Dia</b> (ex.: 22:00) → <i>Executar imediatamente</i> → escolha o atalho.</li>
    </ol>
    <div class="notice">Por que dois modos? No iPhone, o app instalado na tela de início guarda dados separados do Safari. Um link aberto pelo Atalho abre no Safari,
    então para o app instalado use a área de transferência.</div>
    <div class="notice warn">Treinos com o tipo (musculação, corrida, ioga…) chegam com precisão pela <b>exportação do Saúde</b>: app Saúde → sua foto →
    <i>Exportar Todos os Dados de Saúde</i> → salve em Arquivos → aqui, <b>Importar exportação</b> e escolha o .zip. Só os últimos 30 dias são considerados, e nada é enviado para a internet.</div>
    <div class="modal-actions"><button class="btn ghost" data-action="health-copy-link">Copiar link</button><button class="btn primary" data-action="modal-close">Entendi</button></div></div>`, { wide: true });
}

function integrationsTab(c) {
  const card = (ic, title, desc, buttons) => `<div class="reward"><div class="ic">${ic}</div><h4>${title}</h4><p>${desc}</p><div class="row wrap">${buttons}</div></div>`;
  return `<div id="integrations" class="notice">Tudo que é importado entra na fila <b>Aguardando confirmação</b> (tela Registrar). Nada gera XP sem a sua confirmação
    (exceto o app Saúde, se você ativar a confirmação automática),
    e o mesmo item nunca é importado duas vezes.</div>
    <div class="shop mt">
      ${card('📅', 'Calendário', 'Importe um arquivo .ics (Google Agenda, Outlook, Apple). Eventos passados viram registros para confirmar; futuros podem virar missões.',
        `<button class="btn sm" data-action="imp-ics">${icon('upload')} Importar .ics</button><button class="btn sm ghost" data-action="exp-ics">${icon('download')} Exportar prazos</button>`)}
      ${card('✅', 'Aplicativos de tarefas', 'CSV de tarefas concluídas (Todoist, TickTick, Notion, planilhas). Colunas: data, título, tipo/projeto.',
        `<button class="btn sm" data-action="imp-csv" data-source="tarefas">${icon('upload')} Importar CSV</button>`)}
      ${card('🏃', 'Atividade física', 'CSV de treinos (Strava "activities.csv", Google Fit, Garmin, Health Connect exportado). Corrida, bike, academia são reconhecidos.',
        `<button class="btn sm" data-action="imp-csv" data-source="atividade-fisica">${icon('upload')} Importar CSV</button>`)}
      ${card('📚', 'Estudos', 'CSV de sessões de estudo (Anki, Forest, Toggl, planilhas). Colunas: data, título, atividade.',
        `<button class="btn sm" data-action="imp-csv" data-source="estudos">${icon('upload')} Importar CSV</button>`)}
      ${card('🧠', 'Central de Inteligência Pessoal', 'Receba eventos em JSON de outro sistema seu. Formato documentado em docs/INTEGRACOES.md.',
        `<button class="btn sm" data-action="imp-json">${icon('upload')} Arquivo JSON</button><button class="btn sm ghost" data-action="paste-json">Colar JSON</button>`)}
    </div>
    ${healthCard(c)}
    <details class="box mt"><summary>Integrações em tempo real (exigem autorização e servidor)</summary>
      <p class="muted" style="font-size:13px">Sincronização automática com Google Agenda, Todoist API, Google Fit / Health Connect e Strava API requer
      login OAuth e um backend seguro para guardar tokens. A arquitetura já está preparada: basta um adaptador que produza itens no mesmo formato da fila de confirmação.</p></details>`;
}

function dataTab(c) {
  return `<div class="grid g2">
    <div class="reward" style="border-color:color-mix(in srgb,var(--accent) 50%,transparent)"><div class="ic">☁️</div><h4>Backup no iCloud</h4>
      <p>Salva uma cópia completa (missões, histórico, conquistas, configurações) no seu iCloud Drive. No iPhone, abre o menu Compartilhar:
      na primeira vez escolha <b>Salvar em Arquivos → iCloud Drive</b>, crie a pasta <b>${BACKUP_FOLDER}</b> e salve. Nas próximas, o iPhone já sugere a mesma pasta.</p>
      <div class="row wrap"><button class="btn sm primary" data-action="cloud-save">${icon('upload')} Salvar no iCloud agora</button>
      <button class="btn sm" data-action="backup-import">${icon('download')} Restaurar do iCloud</button>
      <button class="btn sm ghost" data-action="export-csv">CSV do histórico</button></div>
      <div class="tl-sub">${esc(backupStatusText(c.state))} · ${c.state.meta.backups || 0} backup(s) no total</div>
      <form data-form="backup-settings" class="form-grid mt">
        <label class="field">Lembrar de salvar a cada<select name="reminderDays">${[[1, 'dia'], [3, '3 dias'], [7, '7 dias'], [14, '14 dias'], [30, '30 dias'], [0, 'nunca lembrar']].map(([v, l]) => `<option value="${v}" ${Number(c.state.settings.backup.reminderDays) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Senha dos backups (opcional)<input name="password" type="password" autocomplete="new-password" placeholder="${c.state.settings.backup.password ? '•••••• (definida)' : 'sem senha'}"></label>
        <label class="check full"><input type="checkbox" name="clearPassword"> Remover a senha (backups voltam a ser JSON simples)</label>
        <div class="full tl-sub">Com senha, o arquivo no iCloud fica criptografado (AES-256). A senha fica guardada só neste aparelho para você não precisar digitá-la sempre.
        <b>Anote-a:</b> sem ela não é possível restaurar.</div>
        <div class="full"><button class="btn sm">Salvar preferências</button></div>
      </form>
      <details class="box mt"><summary>Salvar com um toque, sem escolher pasta (Atalho)</summary>
        <ol style="margin:8px 0 0;padding-left:20px;font-size:13px;display:flex;flex-direction:column;gap:6px">
          <li>No app <b>Atalhos</b>, crie um atalho chamado <b>Salvar no iCloud (Ascension)</b>.</li>
          <li>Em detalhes do atalho (ícone ⓘ), ative <b>Mostrar na Folha de Compartilhamento</b> e aceite <b>Arquivos</b>.</li>
          <li>Adicione <b>Salvar Arquivo</b>: entrada <i>Entrada do Atalho</i>, desative <b>Perguntar Onde Salvar</b>,
          caminho <code>/${BACKUP_FOLDER}/</code> e ative <b>Substituir se o arquivo existir</b>.</li>
          <li>Aqui, toque em <b>Salvar no iCloud agora</b> e escolha o atalho no menu Compartilhar. Ele salva direto em iCloud Drive → Atalhos → ${BACKUP_FOLDER}.</li>
        </ol></details>
    </div>
    <div class="reward"><div class="ic">🕰️</div><h4>Pontos de restauração</h4><p>O app guarda automaticamente uma cópia por dia dos últimos 7 dias neste dispositivo.</p>
      <div id="snapshots" class="list"><span class="muted">Carregando…</span></div></div>
    <div class="reward"><div class="ic">🔒</div><h4>Privacidade</h4><p>Seus dados ficam neste dispositivo (IndexedDB) e nas cópias que você salvar no seu iCloud. O app não usa servidores, rastreadores ou bibliotecas externas,
      e não envia nada pela internet. Para usar em outro aparelho, restaure o backup do iCloud nele.</p>
      <div class="tl-sub" id="persist">Verificando armazenamento persistente…</div></div>
    <div class="reward" style="border-color:rgba(255,92,122,.4)"><div class="ic">⚠️</div><h4>Zona de perigo</h4><p>Apaga todos os dados deste dispositivo, incluindo pontos de restauração. Salve um backup no iCloud antes.</p>
      <div><button class="btn sm danger" data-action="wipe">${icon('trash')} Apagar todos os dados</button></div></div>
  </div>`;
}

function render(c) {
  const tab = ui.tabs.settings || 'profile';
  const body = { profile: profileTab, rules: rulesTab, activities: activitiesTab, notifications: notificationsTab, integrations: integrationsTab, data: dataTab }[tab](c);
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Configurações</div><h1>Ajustes</h1></div></div>
    <div class="tabs">${Object.entries(TABS).map(([k, v]) => `<button class="tab ${k === tab ? 'active' : ''}" data-action="set-tab" data-view="settings" data-tab="${k}">${v}</button>`).join('')}</div>
    <div class="panel">${body}</div>`;
}

async function mounted() {
  const box = document.getElementById('snapshots');
  if (box) {
    const snaps = await listSnapshots();
    box.innerHTML = snaps.length
      ? snaps.map((s) => `<div class="row between" style="font-size:14px"><span>${formatDay(s.date, { withWeekday: true })}</span><button class="btn sm ghost" data-action="snap-restore" data-key="${esc(s.key)}">Restaurar</button></div>`).join('')
      : '<span class="muted">Nenhum ponto ainda.</span>';
  }
  const p = document.getElementById('persist');
  if (p) {
    const persisted = await navigator.storage?.persisted?.();
    const est = await navigator.storage?.estimate?.();
    p.textContent = `${persisted ? '✓ Armazenamento persistente ativo' : 'Armazenamento padrão (instale o app para maior durabilidade)'}${est?.usage ? ` · ${(est.usage / 1024).toFixed(0)} KB usados` : ''}`;
  }
}

/* ------------------------------ Importação ------------------------------ */

async function importItems(items, label, future = []) {
  if (!items.length && !future.length) { toast(`Nenhum item reconhecido em ${label}.`, 'err'); return; }
  let created = 0;
  if (future.length && await confirmDialog(`${future.length} evento(s) futuro(s) encontrados. Criar missões especiais com esses prazos?`, { ok: 'Criar missões' })) {
    run((s) => {
      for (const f of future.slice(0, 50)) {
        if (s.missions.some((m) => m.source === 'calendario' && m.extId === f.externalId)) continue;
        const m = E.saveMission(s, { type: 'special', title: f.title, activity: f.activity || s.settings.activities[0].key, dueDate: f.date, description: f.detail });
        m.source = 'calendario';
        m.extId = f.externalId;
        created++;
      }
    }, null, { quiet: true });
  }
  const added = run((s) => E.addPending(s, items), null, { quiet: true }) || 0;
  toast(`${label}: ${added} registro(s) aguardando confirmação${created ? `, ${created} missão(ões) criada(s)` : ''}.`, 'xp', 4500);
}

const actions = {
  'health-paste': () => pasteHealth(),
  'health-file': () => importHealthFile(),
  'health-guide': () => healthGuide(),
  'health-copy-link': async () => {
    try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/saude?j=`); toast('Link copiado.'); } catch { toast('Não foi possível copiar.', 'err'); }
  },
  'set-theme': (el) => run((s) => E.updateProfile(s, { theme: el.dataset.theme }), null, { quiet: true }),
  'rules-reset': async () => {
    if (await confirmDialog('Restaurar todas as regras de pontuação para o padrão?')) run((s) => E.updateRules(s, structuredClone(DEFAULT_RULES)), null, { quiet: true });
  },
  'act-new': () => activityForm(),
  'act-edit': (el, c) => activityForm(c.state.settings.activities.find((a) => a.key === el.dataset.key)),
  'act-delete': async (el, c) => {
    const a = c.state.settings.activities.find((x) => x.key === el.dataset.key);
    if (await confirmDialog(`Excluir a atividade <b>${esc(a.name)}</b>? O histórico é preservado.`, { ok: 'Excluir', danger: true })) run((s) => E.deleteActivity(s, a.key), null, { quiet: true });
  },
  'notif-test': async (el, c) => {
    if (permission() !== 'granted') {
      const p = await requestPermission();
      if (p !== 'granted') { toast('Permissão de notificação não concedida.', 'err'); return; }
    }
    const ok = await systemNotify({ ...c.state.settings.notifications, enabled: true, goal: true }, 'goal', 'System Ascension', 'As notificações estão funcionando.');
    toast(ok ? 'Notificação enviada.' : 'Não foi possível exibir a notificação.', ok ? '' : 'err');
  },
  'imp-ics': async (el, c) => {
    const f = await pickFile('.ics,text/calendar');
    if (!f) return;
    try {
      const { pending, future } = icsToItems(await readFile(f), c.state.settings.activities, c.today);
      await importItems(pending, 'Calendário', future.filter((x) => x.date <= addDays(c.today, 60)));
    } catch (err) { toast(esc(err.message), 'err'); }
  },
  'exp-ics': (el, c) => download(`system-ascension-prazos.ics`, missionsToIcs(c.state.missions), 'text/calendar'),
  'imp-csv': async (el, c) => {
    const f = await pickFile('.csv,text/csv');
    if (!f) return;
    try {
      const { items, skipped } = csvToItems(await readFile(f), c.state.settings.activities, el.dataset.source);
      await importItems(items, `CSV (${el.dataset.source})${skipped ? `, ${skipped} linha(s) ignorada(s)` : ''}`);
    } catch (err) { toast(esc(err.message), 'err'); }
  },
  'imp-json': async (el, c) => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try { await importItems(jsonToItems(await readFile(f), c.state.settings.activities), 'Central de Inteligência'); } catch (err) { toast(esc(err.message), 'err'); }
  },
  'paste-json': (el, c) => {
    openModal('Colar eventos JSON', `<form data-form="paste-json"><label class="field">Conteúdo JSON<textarea name="json" rows="8" placeholder='{"source":"central","events":[{"id":"1","date":"${c.today}","activity":"estudo","title":"Revisão de SQL"}]}'></textarea></label>
      <div class="modal-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary">Importar</button></div></form>`);
  },
  'cloud-save': () => saveBackupToCloud(),
  'backup-import': async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try {
      const text = await readFile(f);
      const pw = isEncrypted(text) ? await promptDialog('Backup protegido', 'Senha do backup', { type: 'password' }) : '';
      if (pw === null) return;
      const data = await parseBackup(text, pw);
      if (await confirmDialog(`Restaurar backup de <b>${esc(data.profile.name)}</b> com ${data.log.length} registros? Os dados atuais serão substituídos (um ponto de restauração de hoje continua disponível).`, { ok: 'Restaurar', danger: true })) {
        store.set(data);
        toast('Backup restaurado.', 'gold');
      }
    } catch (err) { toast(esc(err.message), 'err', 5000); }
  },
  'export-csv': (el, c) => download(`system-ascension-historico-${c.today}.csv`, logToCsv(c.state), 'text/csv'),
  'snap-restore': async (el) => {
    if (!(await confirmDialog('Restaurar este ponto? Os dados atuais serão substituídos.', { ok: 'Restaurar', danger: true }))) return;
    const data = await dbGet(el.dataset.key);
    if (data) { store.set(migrate(data)); toast('Ponto de restauração aplicado.', 'gold'); }
  },
  wipe: async () => {
    if (!(await confirmDialog('Apagar <b>todos</b> os dados deste dispositivo? Esta ação não pode ser desfeita.', { ok: 'Apagar tudo', danger: true }))) return;
    const typed = await promptDialog('Confirmação final', 'Digite APAGAR para confirmar');
    if (typed !== 'APAGAR') { toast('Operação cancelada.'); return; }
    await wipeAll();
    store.state = null;
    location.hash = '';
    rerender();
  },
};

const changes = {
  'notif-master': async (el) => {
    if (el.checked && permission() !== 'granted' && permission() !== 'unsupported') await requestPermission();
    run((s) => { s.settings.notifications.enabled = el.checked; }, null, { quiet: true });
    if (el.checked) registerPeriodicSync();
  },
  'notif-type': (el) => run((s) => {
    const n = s.settings.notifications;
    const k = el.dataset.type;
    if (typeof n[k] === 'object') n[k].on = el.checked;
    else n[k] = el.checked;
  }, null, { quiet: true }),
  'notif-time': (el) => run((s) => { s.settings.notifications[el.dataset.type].time = el.value; }, null, { quiet: true }),
  'notif-day': (el) => run((s) => { s.settings.notifications.weekly.day = Number(el.value); }, null, { quiet: true }),
};

const forms = {
  ...healthForms,
  'backup-settings': (data) => {
    run((s) => {
      const b = s.settings.backup;
      b.reminderDays = Math.max(0, Math.min(90, Number(data.reminderDays) || 0));
      if (data.clearPassword) b.password = '';
      else if (data.password) b.password = String(data.password).slice(0, 200);
    }, null, { quiet: true });
    toast(data.clearPassword ? 'Senha removida.' : data.password ? 'Senha dos backups definida. Anote-a em lugar seguro.' : 'Preferências salvas.');
  },
  'health-settings': (data) => {
    if (run((s) => E.updateHealthSettings(s, { ...data, autoConfirm: !!data.autoConfirm }), null, { quiet: true })) toast('Metas do Saúde salvas.');
  },
  profile: (data) => { run((s) => E.updateProfile(s, { name: data.name }), null, { quiet: true }); toast('Perfil salvo.'); },
  rules: (data) => {
    const patch = { ...data, missionTypeXp: {} };
    for (const t of Object.keys(MISSION_TYPES)) if (data[`mt_${t}`] != null) patch.missionTypeXp[t] = data[`mt_${t}`];
    if (run((s) => E.updateRules(s, patch), null, { quiet: true })) toast('Regras salvas.');
  },
  activity: (data) => {
    const attrs = Object.fromEntries(ATTRIBUTES.map((a) => [a.key, data[`attr_${a.key}`]]));
    closeModal();
    run((s) => E.saveActivity(s, { ...data, key: data.key || data.name, attrs }), null, { quiet: true });
  },
  'paste-json': async (data, form, c) => {
    try {
      const items = jsonToItems(data.json, c.state.settings.activities);
      closeModal();
      await importItems(items, 'Central de Inteligência');
    } catch (err) { toast(esc(err.message), 'err'); }
  },
};

export default { id: 'settings', title: 'Ajustes', icon: 'settings', render, actions, changes, forms, mounted };

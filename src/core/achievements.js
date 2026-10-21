// Conquistas por marcos reais. Uma vez desbloqueadas, nunca são removidas.

export const RARITY = {
  comum: { label: 'Comum', coins: 10 },
  raro: { label: 'Rara', coins: 30 },
  epico: { label: 'Épica', coins: 75 },
  lendario: { label: 'Lendária', coins: 150 },
};

// metric: função (stats) => valor atual; target: valor necessário.
const A = (id, name, desc, icon, rarity, metric, target, title = null) => ({ id, name, desc, icon, rarity, metric, target, title });

export const ACHIEVEMENTS = [
  A('despertar', 'Despertar', 'Registre seu primeiro progresso.', '👁️', 'comum', (s) => s.effortEntries, 1),
  A('nivel-5', 'Primeira Ascensão', 'Alcance o nível 5.', '⬆️', 'comum', (s) => s.level, 5),
  A('nivel-10', 'Desperto de Verdade', 'Alcance o nível 10.', '🔷', 'raro', (s) => s.level, 10, 'Desperto'),
  A('nivel-25', 'Veterano do Sistema', 'Alcance o nível 25.', '💠', 'epico', (s) => s.level, 25, 'Veterano do Sistema'),
  A('nivel-50', 'Além do Limite', 'Alcance o nível 50.', '🌌', 'lendario', (s) => s.level, 50, 'Além do Limite'),
  A('xp-1k', 'Mil Passos', 'Acumule 1.000 XP.', '✴️', 'comum', (s) => s.totalXp, 1000),
  A('xp-10k', 'Dez Mil Passos', 'Acumule 10.000 XP.', '🌠', 'raro', (s) => s.totalXp, 10000),
  A('xp-50k', 'Força Inesgotável', 'Acumule 50.000 XP.', '☄️', 'epico', (s) => s.totalXp, 50000),
  A('seq-3', 'Faísca', 'Sequência de 3 dias.', '✨', 'comum', (s) => s.bestStreak, 3),
  A('seq-7', 'Chama Acesa', 'Sequência de 7 dias.', '🔥', 'comum', (s) => s.bestStreak, 7),
  A('seq-30', 'Inabalável', 'Sequência de 30 dias.', '🛡️', 'raro', (s) => s.bestStreak, 30, 'Inabalável'),
  A('seq-100', 'Lenda da Constância', 'Sequência de 100 dias.', '👑', 'lendario', (s) => s.bestStreak, 100, 'Lenda da Constância'),
  A('int-30', 'Arquiteto do Conhecimento', '30 dias com estudo, leitura ou programação.', '🏛️', 'raro', (s) => s.attrDays.INT, 30, 'Arquiteto do Conhecimento'),
  A('str-30', 'Forjado em Ferro', '30 dias de treino de força.', '⚒️', 'raro', (s) => s.attrDays.STR, 30, 'Forjado em Ferro'),
  A('end-30', 'Fôlego Incansável', '30 dias de cardio ou condicionamento.', '🌬️', 'raro', (s) => s.attrDays.END, 30, 'Fôlego Incansável'),
  A('wis-20', 'Mente Clara', '20 dias de reflexão ou planejamento.', '🔮', 'raro', (s) => s.attrDays.WIS, 20, 'Sábio Sereno'),
  A('cha-20', 'Voz que Une', '20 dias de conexão ou comunicação.', '🎭', 'raro', (s) => s.attrDays.CHA, 20, 'Voz que Une'),
  A('vit-30', 'Guardião da Chama', '30 dias cuidando do corpo e do descanso.', '🌱', 'raro', (s) => s.attrDays.VIT, 30, 'Guardião do Equilíbrio'),
  A('leitura-30', 'Devorador de Páginas', '30 dias com leitura registrada.', '📜', 'raro', (s) => s.activityDays.leitura || 0, 30, 'Devorador de Páginas'),
  A('perfeito-1', 'Dia Perfeito', 'Complete todas as missões essenciais de um dia.', '🌟', 'comum', (s) => s.perfectDays, 1),
  A('perfeito-10', 'Ritmo Firme', '10 dias perfeitos.', '🎯', 'raro', (s) => s.perfectDays, 10),
  A('perfeito-50', 'Disciplina Absoluta', '50 dias perfeitos.', '⚜️', 'epico', (s) => s.perfectDays, 50, 'Disciplina Absoluta'),
  A('boss-1', 'Caçador de Chefes', 'Derrote seu primeiro Boss.', '🗡️', 'raro', (s) => s.bossesDefeated, 1, 'Caçador de Chefes'),
  A('boss-5', 'Matador de Gigantes', 'Derrote 5 Bosses.', '🐲', 'epico', (s) => s.bossesDefeated, 5, 'Matador de Gigantes'),
  A('main-1', 'Jornada Concluída', 'Conclua uma missão principal.', '🏔️', 'epico', (s) => s.mainCompleted, 1, 'Conquistador'),
  A('semanal-10', 'Estrategista do Tempo', 'Conclua 10 missões semanais.', '⏳', 'raro', (s) => s.weeklyCompleted, 10, 'Estrategista do Tempo'),
  A('especial-5', 'Aventureiro', 'Conclua 5 missões especiais.', '🧩', 'raro', (s) => s.specialCompleted, 5),
  A('missoes-100', 'Centurião', 'Conclua 100 missões.', '🏆', 'epico', (s) => s.missionsCompleted, 100, 'Centurião'),
  A('fenix', 'Fênix', 'Retome a rotina depois de uma pausa.', '🐦‍🔥', 'raro', (s) => s.comebacks, 1, 'Renascido'),
  A('descanso-10', 'Mestre do Equilíbrio', 'Respeite 10 dias de descanso planejado.', '☯️', 'raro', (s) => s.restDays, 10),
  A('equilibrio', 'Harmonia Perfeita', 'Todos os atributos no nível 5.', '🌈', 'lendario', (s) => s.minAttrLevel, 5, 'Harmonia Perfeita'),
  A('dg-1', 'Primeiro Portão', 'Limpe sua primeira dungeon.', '🚪', 'comum', (s) => s.dungeonsCleared, 1),
  A('dg-c', 'Explorador de Masmorras', 'Alcance o Rank C em uma área.', '🗝️', 'raro', (s) => s.maxAreaRank + 1, 3, 'Explorador de Masmorras'),
  A('dg-a', 'Conquistador de Abismos', 'Alcance o Rank A em uma área.', '🌋', 'epico', (s) => s.maxAreaRank + 1, 5, 'Conquistador de Abismos'),
  A('dg-s', 'Soberano da Área', 'Alcance o Rank S em uma área.', '👁️‍🗨️', 'lendario', (s) => s.maxAreaRank + 1, 6, 'Soberano'),
  A('rank-s', 'Rank S', 'Rank geral S: quatro áreas no Rank S.', '⚡', 'lendario', (s) => s.hunterRank + 1, 6, 'Rank S'),
  A('idioma-1', 'Primeiras Palavras', 'Pratique um idioma pela primeira vez.', '💬', 'comum', (s) => s.languageDays, 1),
  A('idioma-10', 'Ponte entre Línguas', '10 dias praticando idiomas, sem pressa.', '🌉', 'raro', (s) => s.languageDays, 10),
  A('idioma-dois', 'Duas Vozes', 'Pratique dois idiomas, 5 dias cada.', '🌎', 'raro', (s) => s.languageDaysSecond, 5, 'Poliglota em Formação'),
  A('loja-1', 'Recompensa Merecida', 'Troque moedas por uma recompensa.', '🎁', 'comum', (s) => s.purchases, 1),
  A('backup-1', 'Guardião dos Registros', 'Exporte um backup dos seus dados.', '💾', 'comum', (s) => s.backups, 1),
];

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);

export function achievementProgress(a, stats) {
  const cur = Math.min(a.target, a.metric(stats) || 0);
  return { current: cur, target: a.target, ratio: cur / a.target };
}

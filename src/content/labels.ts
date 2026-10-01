import type { BadgeId, BlockCategory, BlockQuality, CriterionStatus, FactKind, Step } from '../types';

/** Títulos cotidianos primeiro; o termo técnico aparece como complemento. */
export const FACT_KINDS: Record<FactKind, { title: string; term: string }> = {
  usuarios: { title: 'Quem vai usar', term: 'Usuários' },
  problema: { title: 'O que costuma dar errado', term: 'Problema' },
  dados: { title: 'O que precisa ser registrado', term: 'Dados' },
  regras: { title: 'Condições que precisam ser respeitadas', term: 'Regras de negócio' },
  restricoes: { title: 'Limites e cuidados', term: 'Restrições' },
  resultado: { title: 'O que a pessoa quer ver', term: 'Resultado esperado' },
  verificacao: { title: 'Como saber se funciona', term: 'Critérios de verificação' },
};

export const FACT_ORDER: FactKind[] = ['usuarios', 'problema', 'dados', 'regras', 'restricoes', 'resultado', 'verificacao'];

export const CATEGORIES: Record<BlockCategory, { title: string; term: string; hint: string; color: string }> = {
  objetivo: { title: 'O que você quer', term: 'Objetivo', hint: 'Uma frase dizendo o que a ferramenta precisa resolver.', color: 'yellow' },
  contexto: { title: 'Onde e por quê', term: 'Contexto', hint: 'Onde a ferramenta será usada e qual problema existe hoje.', color: 'lilac' },
  dados: { title: 'O que registrar', term: 'Dados', hint: 'As informações que a ferramenta precisa guardar.', color: 'teal' },
  acoes: { title: 'O que fazer em cada situação', term: 'Ações e regras', hint: 'O que a ferramenta faz e quais condições respeita.', color: 'lime' },
  restricoes: { title: 'Limites e cuidados', term: 'Restrições', hint: 'O que a ferramenta não deve fazer ou precisa respeitar.', color: 'pink' },
  resultado: { title: 'O que mostrar', term: 'Resultado esperado', hint: 'O que a pessoa precisa ver ao usar a ferramenta.', color: 'orange' },
  verificacao: { title: 'Como conferir', term: 'Verificação', hint: 'Situações concretas para testar se funciona.', color: 'blue' },
};

export const CATEGORY_ORDER: BlockCategory[] = ['objetivo', 'contexto', 'dados', 'acoes', 'restricoes', 'resultado', 'verificacao'];

export const QUALITY_LABEL: Record<BlockQuality, string> = {
  essencial: 'Essencial',
  util: 'Útil',
  vago: 'Vago',
  irrelevante: 'Não ajuda nesta missão',
  prejudicial: 'Atrapalha',
};

export const STATUS_LABEL: Record<CriterionStatus, { text: string; icon: string }> = {
  completo: { text: 'Completo', icon: '✔' },
  parcial: { text: 'Parcial', icon: '◐' },
  ausente: { text: 'Faltando', icon: '○' },
};

export const STEPS: { id: Step; label: string; tag: string }[] = [
  { id: 'briefing', label: 'Missão', tag: 'CONHECER' },
  { id: 'investigate', label: 'Investigar', tag: 'INVESTIGAR' },
  { id: 'build', label: 'Montar o pedido', tag: 'CRIAR' },
  { id: 'test', label: 'Testar', tag: 'TESTAR' },
  { id: 'result', label: 'Concluir', tag: 'CONCLUIR' },
];

export const BADGES: Record<BadgeId, { title: string; description: string; icon: string }> = {
  investigar: { title: 'Olhar de investigação', description: 'Descobriu todas as informações essenciais de uma missão.', icon: '🔍' },
  comunicar: { title: 'Pedido claro', description: 'Montou um pedido completo nos cinco critérios.', icon: '💬' },
  testar: { title: 'Teste na prática', description: 'Executou todos os testes de uma missão.', icon: '🧪' },
  melhorar: { title: 'Melhoria contínua', description: 'Revisou o pedido depois de um teste com falha e corrigiu o problema.', icon: '🔧' },
  doacoes: { title: 'Estoque em ordem', description: 'Concluiu uma missão de Doações em ordem.', icon: '📦' },
  vagas: { title: 'Vagas justas', description: 'Concluiu uma missão de Vagas para aprender.', icon: '🎓' },
  agenda: { title: 'Agenda sem choques', description: 'Concluiu uma missão de Agenda da comunidade.', icon: '📅' },
  oficina: { title: 'Oficina do Amanhã', description: 'Concluiu as seis variações.', icon: '⭐' },
};

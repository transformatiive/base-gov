/** Nome a mostrar no cumprimento do painel Hoje. */

export function greetingName(me: { first_name?: string | null; username?: string | null }): string {
  const first = (me.first_name ?? '').trim().split(/\s+/)[0];
  if (first) return first;
  const local = (me.username ?? '').split(/[\s@]/)[0];
  return local || 'Olá';
}

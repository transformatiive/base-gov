/** Um lugar ocupado = um utilizador da empresa ou um convite ainda por aceitar. */

export function occupiedSeatCount(memberCount: number, pendingInviteCount: number): number {
  return memberCount + pendingInviteCount;
}

export function seatsAtLimit(used: number, max: number): boolean {
  return used >= max;
}

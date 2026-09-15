// Shared world-simulation helpers copied verbatim across classes/oathkeeper/
// multiplayer/ranger tests. Each caller keeps its own `command` helper (its
// shape differs by file only in imports, not behavior), so `cast` is written
// against the World API directly rather than depending on it.
export const tick = (w, n = 1) => { for (let i = 0; i < n; i++) w.step(); };

export const cast = (w, p, action, extra = {}) =>
 w.command(p.id, {type: 'ability', worldId: w.id, seq: p.lastSeq + 1, action, angle: 0, ...extra});

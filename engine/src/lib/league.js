// Flaggenduell sezon takvimi: maç numarası yayın gününden hesaplanır (günde bir maç, 30 maçta bir sezon).
// Bağımlılıksızdır; hem planlama (bulut rutini) hem motor aynı numarayı bulur.
export const MATCHES_PER_SEASON = 30;
export const POINTS = [10, 7, 5, 4, 3, 2, 1];

// calendarStart: 1. sezonun 1. maçının günü (YYYY-MM-DD, İstanbul saatine göre).
export function matchFor(dateStr, calendarStart) {
  const days = Math.round((Date.parse(`${dateStr}T12:00:00Z`) - Date.parse(`${calendarStart}T12:00:00Z`)) / 86_400_000);
  if (Number.isNaN(days) || days < 0) return null;
  const match = (days % MATCHES_PER_SEASON) + 1;
  return {
    season: 1 + Math.floor(days / MATCHES_PER_SEASON),
    match,
    total: MATCHES_PER_SEASON,
    final: match === MATCHES_PER_SEASON,
    eveOfFinal: match === MATCHES_PER_SEASON - 1,
  };
}

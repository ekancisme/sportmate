export const COURT_SPORT_OPTIONS = [
  { key: 'football', label: 'Bóng đá' },
  { key: 'badminton', label: 'Cầu lông' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'basketball', label: 'Bóng rổ' },
  { key: 'volleyball', label: 'Bóng chuyền' },
] as const;

export type CourtSportKey = (typeof COURT_SPORT_OPTIONS)[number]['key'];

const COURT_SPORT_LABELS: Record<CourtSportKey, string> = Object.fromEntries(
  COURT_SPORT_OPTIONS.map((item) => [item.key, item.label]),
) as Record<CourtSportKey, string>;

export function isCourtSportKey(value: string): value is CourtSportKey {
  return value in COURT_SPORT_LABELS;
}

export function getCourtSportLabel(value: string | undefined): string {
  if (!value) return 'Khác';
  if (isCourtSportKey(value)) return COURT_SPORT_LABELS[value];
  return value;
}

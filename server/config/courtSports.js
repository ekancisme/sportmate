const SPORT_OPTIONS = [
  { key: 'football', label: 'Bóng đá' },
  { key: 'badminton', label: 'Cầu lông' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'basketball', label: 'Bóng rổ' },
  { key: 'volleyball', label: 'Bóng chuyền' },
];

const SPORT_LABEL_BY_KEY = Object.fromEntries(SPORT_OPTIONS.map((item) => [item.key, item.label]));

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalizeSportKey(raw) {
  const value = stripAccents(raw)
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!value) return '';

  const aliases = {
    football: 'football',
    soccer: 'football',
    'bong da': 'football',
    bongda: 'football',
    badminton: 'badminton',
    'cau long': 'badminton',
    caulong: 'badminton',
    tennis: 'tennis',
    pickleball: 'pickleball',
    basketball: 'basketball',
    'bong ro': 'basketball',
    bongro: 'basketball',
    volleyball: 'volleyball',
    'bong chuyen': 'volleyball',
    bongchuyen: 'volleyball',
  };

  return aliases[value] || '';
}

function isValidSportKey(value) {
  return Boolean(SPORT_LABEL_BY_KEY[String(value || '')]);
}

function getSportLabel(value) {
  const key = normalizeSportKey(value) || String(value || '');
  return SPORT_LABEL_BY_KEY[key] || 'Khác';
}

module.exports = {
  SPORT_OPTIONS,
  getSportLabel,
  isValidSportKey,
  normalizeSportKey,
};

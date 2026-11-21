export interface CountryOption {
  name: string;
  flag: string;
  dialCode: string;
}

export const VOICE_COUNTRIES: CountryOption[] = [
  { name: 'السعودية', flag: '🇸🇦', dialCode: '+966' },
  { name: 'مصر', flag: '🇪🇬', dialCode: '+20' },
  { name: 'الإمارات', flag: '🇦🇪', dialCode: '+971' },
  { name: 'الكويت', flag: '🇰🇼', dialCode: '+965' },
  { name: 'قطر', flag: '🇶🇦', dialCode: '+974' },
  { name: 'البحرين', flag: '🇧🇭', dialCode: '+973' },
  { name: 'عُمان', flag: '🇴🇲', dialCode: '+968' },
  { name: 'الأردن', flag: '🇯🇴', dialCode: '+962' },
  { name: 'العراق', flag: '🇮🇶', dialCode: '+964' },
  { name: 'الجزائر', flag: '🇩🇿', dialCode: '+213' },
  { name: 'المغرب', flag: '🇲🇦', dialCode: '+212' },
  { name: 'تونس', flag: '🇹🇳', dialCode: '+216' },
  { name: 'لبنان', flag: '🇱🇧', dialCode: '+961' },
  { name: 'سوريا', flag: '🇸🇾', dialCode: '+963' },
  { name: 'فلسطين', flag: '🇵🇸', dialCode: '+970' },
  { name: 'اليمن', flag: '🇾🇪', dialCode: '+967' },
  { name: 'السودان', flag: '🇸🇩', dialCode: '+249' },
  { name: 'ليبيا', flag: '🇱🇾', dialCode: '+218' },
  { name: 'تركيا', flag: '🇹🇷', dialCode: '+90' },
  { name: 'دولي', flag: '🌍', dialCode: '+1' },
];

/**
 * Generates a compact, offline-safe SVG data URI avatar (under 700 bytes, well within the 1024-char Firestore rule limit).
 */
export function buildVoiceAvatarSvg(gender: 'male' | 'female', seedName = ''): string {
  const isFemale = gender === 'female';
  const bg1 = isFemale ? '%23be185d' : '%231d4ed8';
  const bg2 = isFemale ? '%237c3aed' : '%230f172a';
  const accent = isFemale ? '%23fbcfe8' : '%23fbbf24';
  const ring = isFemale ? '%23f472b6' : '%2338bdf8';
  const initial = seedName.trim().slice(0, 1).toUpperCase();
  const label = initial && /^[A-Za-z0-9]$/.test(initial) ? initial : isFemale ? '♀' : '♂';

  return (
    `data:image/svg+xml;utf8,` +
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0%25' stop-color='${bg1}'/><stop offset='100%25' stop-color='${bg2}'/>` +
    `</linearGradient></defs>` +
    `<rect width='120' height='120' rx='60' fill='url(%23g)'/>` +
    `<circle cx='60' cy='60' r='54' fill='none' stroke='${ring}' stroke-width='3' opacity='0.85'/>` +
    `<circle cx='60' cy='46' r='18' fill='${accent}' opacity='0.92'/>` +
    `<path d='M28 104c4-20 18-30 32-30s28 10 32 30' fill='${accent}' opacity='0.88'/>` +
    `<text x='60' y='52' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='bold' fill='%230f172a'>${encodeURIComponent(label)}</text>` +
    `</svg>`
  );
}

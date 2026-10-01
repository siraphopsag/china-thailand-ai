/** Product identity. The brand name is never translated; only the supporting descriptions are (see locales/brand.ts). */
export const BRAND = {
  name: 'C.A.L.L.',
  full: 'Cross ASEAN Language Legal',
  title: 'C.A.L.L. — Cross ASEAN Language Legal',
} as const
/** The four concepts behind the name. Words stay in English (they spell the brand); meanings are translated. */
export const BRAND_CONCEPTS = [
  { letter: 'C', word: 'Cross', key: 'cross' },
  { letter: 'A', word: 'ASEAN', key: 'asean' },
  { letter: 'L', word: 'Language', key: 'language' },
  { letter: 'L', word: 'Legal', key: 'legal' },
] as const

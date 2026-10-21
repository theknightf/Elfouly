export const GENERAL_CATEGORY = 'general';

export interface SpecialtyCategory {
  id: string;
  label: string;
  icon: string;
}

/** The categories a player can specialize in. General is intentionally excluded. */
export const SPECIALTY_CATEGORIES: SpecialtyCategory[] = [
  { id: 'sports', label: 'رياضة', icon: '⚽' },
  { id: 'science', label: 'علوم', icon: '🔬' },
  { id: 'history', label: 'تاريخ', icon: '🏺' },
  { id: 'tech', label: 'تكنولوجيا', icon: '💻' },
  { id: 'geography', label: 'جغرافيا', icon: '🌍' },
  { id: 'arts', label: 'فنون وترفيه', icon: '🎬' },
  { id: 'food', label: 'أكل وحلويات', icon: '🍨' },
  { id: 'cars', label: 'سيارات', icon: '🚗' },
  { id: 'religion', label: 'دين وثقافة', icon: '🕌' }
];

const SPECIALTY_LABELS = new Map(
  SPECIALTY_CATEGORIES.map(category => [category.id, category.label])
);

export function categoryLabel(category: string | undefined): string {
  if (!category || category === GENERAL_CATEGORY) {
    return 'عام';
  }
  return SPECIALTY_LABELS.get(category) || category.replace(/_/g, ' ');
}

export function isGeneralCategory(category: string | undefined): boolean {
  return !category || category === GENERAL_CATEGORY;
}

export function isSpecialtyCategory(category: string | undefined): boolean {
  return Boolean(category && category !== GENERAL_CATEGORY);
}

export function specialtyIcon(category: string | undefined): string {
  return (
    SPECIALTY_CATEGORIES.find(entry => entry.id === category)?.icon || '✨'
  );
}

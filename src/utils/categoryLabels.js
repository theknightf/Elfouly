// Arabic display names for question categories (the bank stores English slugs).
const CATEGORY_LABELS = Object.freeze({
  football_post_2010: 'كرة قدم بعد 2010 ⚽',
  capitals_and_flags: 'عواصم وأعلام 🌍',
  general_knowledge: 'معلومات عامة 💡',
  reflex_trivia: 'سؤال سرعة ⚡',
  veterinary_biology: 'بيطري وبيولوجيا 🔬',
  gelato_sweets: 'جيلاتي وحلويات 🍨',
  islamic_studies: 'دراسات إسلامية 📖',
  pc_hardware_gaming: 'هاردوير وجيمنج 🖥️',
  console_pc_gaming: 'ألعاب كونسول وPC 🎮',
  gaming_tech: 'جيمنج وتقنية 🕹️',
  cybersecurity: 'أمن سيبراني 🔒',
  tech_networking: 'شبكات 🌐',
  series_breaking_bad: 'Breaking Bad 🧪',
  popular_foreign_series: 'مسلسلات أجنبية 📺',
  health_sciences_lab: 'علوم صحية ومعامل 🧪',
  dentistry: 'طب الأسنان 🦷',
  cars_mechanics: 'ميكانيكا سيارات 🏎️',
  fitness_gym: 'فيتنس وجيم 💪'
});

/** Arabic label for a known slug; anything else (already a label) is returned unchanged. */
export const categoryLabel = (value, fallback = '') => {
  if (!value) return fallback;
  return CATEGORY_LABELS[value] || value;
};

/**
 * src/game/characterBuilder.js
 *
 * Builds the character a player will use, from untrusted input. Framework-free:
 * the Socket.IO server, the Supabase provider and the lobby UI all share it, so the
 * rules (what may be chosen, how it is cleaned) are identical everywhere.
 *
 * A player's character carries:
 *   attributes  -> the categories this player knows (1 to MAX_SPECIALTIES). They drive the
 *                  "specialty" questions in Round 1 and the specialty bonus in Round 3.
 *   powerId     -> custom characters pick one of the 7 powers (built-ins keep their own).
 */
import { CHARACTERS } from '../data/characters.js';
import { POWER_BY_ID } from './powers.js';

export const MAX_SPECIALTIES = 3;

export const CATEGORY_OPTIONS = Object.freeze([
  { id: 'football_post_2010', label: 'كرة قدم بعد 2010', icon: '⚽' },
  { id: 'general_knowledge', label: 'معلومات عامة', icon: '💡' },
  { id: 'capitals_and_flags', label: 'عواصم وأعلام', icon: '🌍' },
  { id: 'reflex_trivia', label: 'أسئلة سرعة', icon: '⚡' },
  { id: 'popular_foreign_series', label: 'مسلسلات أجنبية', icon: '📺' },
  { id: 'series_breaking_bad', label: 'Breaking Bad', icon: '🧪' },
  { id: 'console_pc_gaming', label: 'ألعاب كونسول وPC', icon: '🎮' },
  { id: 'gaming_tech', label: 'جيمنج وتقنية', icon: '🕹️' },
  { id: 'pc_hardware_gaming', label: 'هاردوير وجيمنج', icon: '🖥️' },
  { id: 'tech_networking', label: 'شبكات', icon: '🌐' },
  { id: 'cybersecurity', label: 'أمن سيبراني', icon: '🔒' },
  { id: 'veterinary_biology', label: 'بيطري وبيولوجيا', icon: '🔬' },
  { id: 'health_sciences_lab', label: 'علوم صحية ومعامل', icon: '🧫' },
  { id: 'dentistry', label: 'طب الأسنان', icon: '🦷' },
  { id: 'gelato_sweets', label: 'جيلاتي وحلويات', icon: '🍨' },
  { id: 'islamic_studies', label: 'دراسات إسلامية', icon: '📖' },
  { id: 'cars_mechanics', label: 'ميكانيكا سيارات', icon: '🏎️' },
  { id: 'fitness_gym', label: 'فيتنس وجيم', icon: '💪' }
]);

export const CUSTOM_AVATARS = Object.freeze(['🦅', '🐺', '🦁', '🐯', '🦊', '🐉', '🚀', '👑', '🎮', '⚡', '🔥', '🧠', '🎯', '🛡️', '🏎️', '🎭']);
export const CUSTOM_COLORS = Object.freeze(['#4CC9F0', '#FF5C7A', '#FFC857', '#3DDC97', '#9B8CFF', '#F97316', '#EC4899', '#22D3EE']);

const CATEGORY_IDS = new Set(CATEGORY_OPTIONS.map(option => option.id));
const labelOf = (id) => {
  const option = CATEGORY_OPTIONS.find(candidate => candidate.id === id);
  return option ? `${option.label} ${option.icon}` : id;
};

// No markup, control or bidi-override characters; trimmed and capped.
export const cleanText = (value, max) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>\u0000-\u001f\u007f​-‏‪-‮]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
};

/** Unique, known categories only, at most MAX_SPECIALTIES. `fallback` is used when nothing valid is left. */
export const normalizeSpecialties = (list, fallback = []) => {
  const picked = [];
  for (const id of Array.isArray(list) ? list : []) {
    if (typeof id === 'string' && CATEGORY_IDS.has(id) && !picked.includes(id)) picked.push(id);
    if (picked.length >= MAX_SPECIALTIES) break;
  }
  return picked.length ? picked : [...fallback];
};

const buildCustom = (custom, specialties) => {
  const name = cleanText(custom.name, 20);
  if (!name) return { error: 'اسم الشخصية مطلوب.' };

  const powerId = typeof custom.powerId === 'string' ? custom.powerId : '';
  if (!POWER_BY_ID[powerId]) return { error: 'اختار قدرة خاصة للشخصية.' };

  const attributes = normalizeSpecialties(specialties ?? custom.specialties, []);
  if (!attributes.length) return { error: 'اختار تخصص واحد على الأقل (لحد 3).' };

  const avatar = CUSTOM_AVATARS.includes(custom.avatar) ? custom.avatar : CUSTOM_AVATARS[0];
  const color = CUSTOM_COLORS.includes(custom.color) ? custom.color : CUSTOM_COLORS[0];
  const power = POWER_BY_ID[powerId];

  return {
    character: {
      id: 'custom',
      isCustom: true,
      name,
      realName: name,
      nickname: name,
      avatar,
      color,
      accentColor: color,
      badge: 'شخصية مخصصة ✨',
      catchphrase: cleanText(custom.catchphrase, 60) || 'أنا هنا عشان أكسب!',
      lore: 'شخصية صنعها اللاعب بنفسه.',
      attributes,
      attributesDisplay: attributes.map(labelOf),
      powerId,
      bonus: { title: power.title, description: power.description, appliedCategories: attributes }
    }
  };
};

/**
 * @param {object} input
 * @param {string}  [input.characterId]  a built-in character id
 * @param {object}  [input.custom]       { name, avatar, color, powerId, catchphrase, specialties }
 * @param {string[]} [input.specialties] categories the player knows (overrides a built-in's defaults)
 * @returns {{character: object} | {error: string}}
 */
export function buildPlayerCharacter({ characterId, custom, specialties } = {}) {
  if (custom && typeof custom === 'object') return buildCustom(custom, specialties);

  const base = CHARACTERS.find(candidate => candidate.id === characterId);
  if (!base) return { error: 'الشخصية دي مش موجودة في الساحة! اختار شخصية تانية.' };

  const attributes = normalizeSpecialties(specialties, base.attributes);
  const changed = attributes.length !== base.attributes.length || attributes.some((id, index) => id !== base.attributes[index]);
  return {
    character: {
      ...base,
      attributes,
      attributesDisplay: changed ? attributes.map(labelOf) : base.attributesDisplay,
      bonus: { ...base.bonus, appliedCategories: attributes }
    }
  };
}

import React from 'react';
import { Check, Sparkles, UserPlus } from 'lucide-react';
import { CATEGORY_OPTIONS, CUSTOM_AVATARS, CUSTOM_COLORS, MAX_SPECIALTIES } from '../game/characterBuilder';
import { POWERS } from '../game/powers';

const POWER_LIST = Object.values(POWERS);

/**
 * Lobby editor: "the categories I know" (everyone) and "my own character" (optional).
 * Purely presentational: the Lobby owns the draft and the save button.
 */
export default function CharacterEditor({
  specialties,
  onToggleSpecialty,
  isCustom,
  onToggleCustom,
  custom,
  onCustomChange
}) {
  const limitReached = specialties.length >= MAX_SPECIALTIES;

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-5" dir="rtl">
      {/* ---------- categories ---------- */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-arena-yellow" />
            <span>المجالات اللي بتفهم فيها</span>
          </h3>
          <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${limitReached ? 'text-arena-yellow border-arena-yellow/50' : 'text-gray-300 border-white/15'}`}>
            {specialties.length}/{MAX_SPECIALTIES}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          اختار لحد {MAX_SPECIALTIES} مجالات. أسئلة التخصص بتاعتك في جولة "1 تو" هتيجي منها، وفي ركلات الجزاء الإجابة برا مجالاتك بتديك بونص.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="المجالات">
          {CATEGORY_OPTIONS.map(option => {
            const selected = specialties.includes(option.id);
            const disabled = !selected && limitReached;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onToggleSpecialty(option.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  selected
                    ? 'bg-arena-yellow/15 border-arena-yellow text-arena-yellow'
                    : disabled
                      ? 'opacity-40 border-white/10 text-gray-500 cursor-not-allowed'
                      : 'border-white/15 text-gray-200 hover:border-white/40 cursor-pointer'
                }`}
              >
                <span>{option.icon}</span>
                <span>{option.label}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- custom character ---------- */}
      <section className="space-y-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={onToggleCustom}
          aria-pressed={isCustom}
          className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border text-sm font-black transition-all cursor-pointer ${
            isCustom ? 'bg-arena-cyan/15 border-arena-cyan text-arena-cyan' : 'border-white/15 text-gray-200 hover:border-white/40'
          }`}
        >
          <span className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span>اعمل شخصيتك بنفسك ✨</span>
          </span>
          <span className="text-[11px] font-bold">{isCustom ? 'شغّال' : 'اضغط للتفعيل'}</span>
        </button>

        {isCustom && (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-gray-300">اسم الشخصية</span>
              <input
                value={custom.name}
                maxLength={20}
                onChange={event => onCustomChange({ name: event.target.value })}
                placeholder="مثال: صقر الصعيد"
                className="w-full rounded-xl bg-arena-darker border border-white/15 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-arena-cyan"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300">الأفاتار</span>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOM_AVATARS.map(avatar => (
                  <button
                    key={avatar}
                    type="button"
                    aria-pressed={custom.avatar === avatar}
                    onClick={() => onCustomChange({ avatar })}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all cursor-pointer ${
                      custom.avatar === avatar ? 'border-arena-yellow bg-arena-yellow/15 scale-105' : 'border-white/15 hover:border-white/40'
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300">اللون</span>
              <div className="flex flex-wrap gap-2">
                {CUSTOM_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`لون ${color}`}
                    aria-pressed={custom.color === color}
                    onClick={() => onCustomChange({ color })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${custom.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300">القدرة الخاصة (مرة واحدة في الماتش)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {POWER_LIST.map(power => (
                  <button
                    key={power.id}
                    type="button"
                    aria-pressed={custom.powerId === power.id}
                    onClick={() => onCustomChange({ powerId: power.id })}
                    className={`text-right rounded-xl p-2.5 border transition-all cursor-pointer ${
                      custom.powerId === power.id ? 'border-arena-yellow bg-arena-yellow/10' : 'border-white/15 hover:border-white/40'
                    }`}
                  >
                    <div className="text-xs font-black text-white">{power.icon} {power.title}</div>
                    <div className="text-[10px] text-gray-400 leading-snug mt-0.5">{power.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-gray-300">قفشتك (اختياري)</span>
              <input
                value={custom.catchphrase}
                maxLength={60}
                onChange={event => onCustomChange({ catchphrase: event.target.value })}
                placeholder="أنا هنا عشان أكسب!"
                className="w-full rounded-xl bg-arena-darker border border-white/15 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-arena-cyan"
              />
            </label>
          </div>
        )}
      </section>
    </div>
  );
}

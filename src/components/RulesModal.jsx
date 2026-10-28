import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const RULES = [
  { tone: 'text-arena-yellow', title: '1️⃣ جولة "1 تو" (Bank Mode)', body: '24 سؤال لكل فريق (دورين × 12) واللاعبين بيتبادلوا الإجابة. كل إجابة صح بتطلّع الستريك (من 100 لحد 5,000 نقطة)، وأمّن النقاط في الخزنة قبل ما تغلط وتصفّر! لو غلطت، نفس السؤال بيروح للفريق التاني فرصة سرقة بـ 100 نقطة.' },
  { tone: 'text-arena-cyan', title: '2️⃣ جولة "اديني في سري" (Password)', body: '5 بطاقات سر بالتبادل بين الفريقين. المرشد بيلمّح بكلمة واحدة من غير الـ 4 كلمات الممنوعة. كل ما فريقك يخمّن أسرع نقاطك أكتر (من 1,000 لحد 200)، والمخالفة بتخصم 300 وتنهي البطاقة.' },
  { tone: 'text-emerald-400', title: '3️⃣ جولة "حط في قريبي" (Penalties)', body: '10 ركلات (5 لكل فريق). المسدد بيجاوب في 20 ثانية، والحارس يقدر يدوس زر الصد بعد أول 10 ثواني بس. الإجابة الصح قبلها جون مضمون!' },
  { tone: 'text-purple-400', title: '4️⃣ جولة "مين يزوّد؟" (Auction)', body: 'الفرق بتزايد على عدد العناصر اللي تقدر تسمّيها. صاحب أعلى مزايدة بيسمّيها قدام الخصم: لو نجح بياخد المزايدة × 200 نقطة (×2 للفريق المتأخر)، ولو فشل بيخسر نفس القيمة. مفيش مزايدة فوق عدد الإجابات الصح.' },
  { tone: 'text-pink-400', title: '⚡ القدرات والتخصصات', body: 'كل لاعب بيختار لحد 3 مجالات بيفهم فيها (أسئلة تخصصه منها) وممكن يعمل شخصية بنفسه. كل شخصية ليها قدرة واحدة بتستخدمها مرة واحدة في الماتش، وفي جولتها بس.' },
  { tone: 'text-orange-400', title: '🏁 لو اتعادلتوا في الآخر', body: 'ركلة حسم لكل فريق، وبتتكرر لحد ما حد يتقدم في النقاط.' }
];

/**
 * Rules dialog shared by the landing page and the in-match top bar.
 * Accessible: role="dialog", Esc closes, focus moves in and returns to the opener.
 */
export default function RulesModal({ onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  // Portal: a fixed overlay must not live inside the blurred header (that would trap it).
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#0C1226] p-5 shadow-2xl space-y-3"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="إغلاق القواعد"
          className="absolute top-3 left-3 rounded-lg p-1 text-gray-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <span className="text-2xl" aria-hidden="true">📜</span>
          <h2 id="rules-title" className="font-black text-lg text-arena-yellow">قواعد كنز الفولي</h2>
          <p className="text-xs text-gray-300">ماتش 2 ضد 2.. 4 جولات ملحمية، والتعادل بيتحسم بركلات حسم</p>
        </div>

        <div className="space-y-2 text-xs">
          {RULES.map(rule => (
            <div key={rule.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span className={`mb-1 block font-bold ${rule.tone}`}>{rule.title}</span>
              <span className="text-gray-200 leading-relaxed">{rule.body}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-arena-yellow font-black text-sm text-black cursor-pointer hover:brightness-110 active:scale-95 transition-transform"
        >
          فهمت يا كابتن 👍
        </button>
      </div>
    </div>,
    document.body
  );
}

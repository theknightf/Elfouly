# تقرير QA — كنز الفولي

## افتراضات ونطاق التشغيل

- الستاك من `package.json`: React 19 + Vite 8 + JavaScript/TypeScript + Tailwind، مع Socket.IO server وSupabase Realtime provider.
- أوضاع اللعب التي ظهرت في الواجهة والكود: 1 تو (Bank)، اديني في سري (Password)، حط في قريبي (Penalty)، مين يزوّد؟ (Mazat/Auction).
- قواعد الجولة حسب الإعدادات: Bank = 48 سؤالًا (24 لكل فريق عبر جولتين)، Password = 5 بطاقات × 45 ثانية، Penalty = 10 ركلات تنظيمية × 20 ثانية ثم موت مفاجئ، Mazat = 4 موضوعات × 60 ثانية للتحدي.
- «Mazat» فُسّر على أنه جولة المزاد «مين يزوّد؟» وفق أسماء الحالات والمكونات في المشروع. يحتاج تأكيدًا إذا كان المقصود نمطًا آخر.
- الاختبار البصري لأربع جلسات لم يكتمل: المتصفح المتاح IAB واحد فقط ولا يدعم إنشاء browser contexts، وChrome المحلي غير متاح لأتمتة الصفحة. واجهة اللعبة نفسها اشترطت 4 لاعبين قبل الانطلاق؛ سجلت جلسة Lobby فعلية واحدة باسم P1 Team A والغرفة `QZ-8XFETR` ثم توقفت قبل بدء المباراة لعدم وجود باقي اللاعبين.
- لم تتوفر لقطات محفوظة: واجهة المتصفح رفضت التقاط الصورة، ولم يتوفر Playwright/Chrome CDP أو واجهة حفظ صور. لذلك لا يوجد ادعاء بوجود صور في `/qa-screenshots`، ولا أي PASS بصري بلا دليل.
- فتح المتصفح صفحة اللعبة، وأنشأت غرفة فعلية باسم P1 Team A (`QZ-8XFETR`). الـ Lobby أظهر 1/4، ورفض بدء المباراة قبل تكوين 2 ضد 2. لم أدخل P2–P4 حتى لا أخلط بين حسابات جلسات المتصفح أو أدعي أنها لاعبين مستقلين.
- خرجت من تشغيل الواجهة تحذيرات متكررة `Multiple GoTrueClient instances detected` و`[SupabaseSocket] Unhandled event: latency_report`؛ لم أختبر أثرها على مباراة لأننا لم نتمكن من دخولها.
- اختبار Socket الآلي جُرّب عبر `npm run test:r2`, `npm run test:engine`, `npm run test:integrity`, `npm run test:ui` وبـ `node --import tsx`; كلها توقفت قبل الاختبار نفسه بخطأ Node 24: `uv_os_get_passwd returned ENOMEM`. هذا فشل بيئة التشغيل، وليس assertion من اللعبة.

## خلاصة الأدلة

| الوضع | الفحص | النتيجة | الدليل |
|---|---|---|---|
| عام | stack والأوضاع | PASS | `package.json`، `src/App.jsx`، ملفات `Round1Bank`, `Round2Password`, `Round3Penalty`, `BonusAuction` |
| عام | تشغيل اللعبة | PASS جزئي | Vite على `http://localhost:5173/`، السيرفر سجّل 270 سؤالًا وSocket.IO على 3001 |
| عام | 4 لاعبين متزامنين، الأدوار، الرجوع/إعادة الدخول، الضغط المزدوج | BLOCKED | IAB جلسة واحدة، Chrome غير متاح للتحكم، ولا جلسة اختبار آلية بدأت بسبب Node ENOMEM |
| عام | RTL / الشاشات الصغيرة | PARTIAL | الصفحة الرئيسية تعرض RTL، لكن لا توجد لقطات أو viewport/mobile run محفوظ |
| Bank | سؤال/حكم/إجابة/الأزرار/حساب بنك 12×2 | BLOCKED | لم تبدأ مباراة بأربع لاعبين. إعداد المصدر يحدد 48 سؤالًا و12 سؤالًا لكل فريق في كل جولة |
| Bank | Timer 30 ثانية تلقائي | FAIL قبل الإصلاح / غير معاد اختباره | لم يوجد timer في `BankTurnView`; أضيف عرض عداد deadline وتفعيل وقت عند dispatch. اختبار runtime تعذر بسبب Node ENOMEM |
| Password | سرّية الكلمة للمرشدين فقط | BLOCKED بصريًا | واجهة التحضير ظهرت، لكن لم تُبدّل الأدوار في مباراة فعلية. منطق redaction موجود في `server/server.js` و`useTriviaRoom.ts` |
| Password | تدوير المرشدين بعد كل بطاقة، الزرين الصحيح/مخالفة/تخطي | BLOCKED | اختبار `round2Roles` موجود لكنه لم يبدأ. تدوير المرشدين للفريقين موجود في `TurnManager` واستدعاءات السيرفر |
| Password | Timer 45 ثانية | BLOCKED | الإعداد والمواعيد في `GameContext` و`PasswordDualView`; لا تشغيل مؤكد بالواجهة |
| Penalty | إخفاء السؤال/الاختيارات عن المسدد والحارس | FAIL قبل الإصلاح / غير معاد اختباره | ظهرت مشاركة سؤال الجولة داخل Controller mobile؛ عُدلت لتخفيه عن المسدد والحارس. لم يتوفر اختبار سياقين |
| Penalty | السؤال/الإجابة وأزرار الحكم | BLOCKED | لم تُلعب ركلة. المصدر يُظهر صلاحية الحكم منفصلة، ومدة 20 ثانية |
| Penalty | timer/الحسم التلقائي | FAIL / BLOCKED | عداد المكوّن موجود، لكن في اللعب online لا يوجد إثبات حسم تلقائي عند الصفر، والاختبار لم يعمل |
| Mazat | المزايدة/الانسحاب/بدء التحدي/قائمة الإجابات/النتيجة | FAIL قبل الإصلاح / غير معاد اختباره | عند قراءة الحالة phase كانت bidding ولا يوجد حدث انتقال، وزر Fold كان Toast فقط؛ أضيف `r4_end_bidding` للنقل إلى challenge/execution |
| Mazat | Timer 60 ثانية والنتيجة التلقائية | BLOCKED | لم يبدأ موضوع مزاد باللعب؛ المدة موثقة في state initialization، ولا توجد لقطة runtime |

## Bugs ظاهرة من الكود وإصلاحاتها

| العيب والخطوات | المتوقع / الفعلي قبل الإصلاح | موضع السبب | ما تغير |
|---|---|---|---|
| تكرار سؤال: ابدأ جلسة محلية، اسحب كل أسئلة الفئة ثم اطلب سؤالًا آخر. | المتوقع queue موحد لكل وضع بلا إعادة؛ الفعلي كان يعيد تكوين طابور بفئة/مرشحين أصغر عند النفاد ويختار فئة عشوائيًا خارج الترتيب. | `src/utils/localQuestionEngine.js`, `services/triviaEngine.js`, `src/game/QuestionQueue.js` | طابور الجلسة يُنشأ من بنك الوضع مرة واحدة، والسحب من الفئة يأخذ عنصرًا من نفس الترتيب، ولا يُعاد بناؤه عند نفاد العناصر. |
| Password: أنهِ بطاقة بنقطة أو تخطي أو مخالفة في جلسة محلية/Socket. | المتوقع يتبدل المرشد واللي بيخمن للفريقين عند نهاية كل سؤال؛ الفعلي كان تبديلًا غير متسق وقد تتغير أدوار فريق واحد فقط، والمخالفة لا تنهي البطاقة في Socket. | `src/game/TurnManager.js`, `src/context/GameContext.jsx`, `server/server.js`, `src/services/supabaseMultiplayerService.js` | دوران مشترك للمرشدين من الفريقين، وإنهاء البطاقة عند المخالفة في مقدمي الخدمة، وعداد `currentGiverIndex` مركزي. يحتاج اختبار Socket فعلي قبل الإغلاق النهائي. |
| Penalty: اعرض Controller للمسدد والحارس. | المتوقع المسدد لا يرى السؤال أو الحل، والحارس يستمع للسؤال بدون اختيارات؛ الفعلي كان يطبع السؤال لكليهما في Controller. | `src/components/MobileController.jsx` | إخفاء السؤال عن المسدد والحارس، وعرض اختيارات الإجابة للمسدد فقط. |
| Penalty: المسدد يختار إجابة أو ينتهي الوقت. | المتوقع feedback فوري وعدم إمكانية الإجابة مرتين؛ الفعلي كانت الإجابة online لا تُغلق محليًا إلا بعد بث الحالة. | `src/context/GameContext.jsx`, `src/components/views/PenaltyDuelView.jsx` | قفل/feedback متفائل قبل إرسال الحدث. auto-resolve عبر خدمة online لم يثبت؛ يبقى فحصًا مطلوبًا. |
| Mazat: أعلى فريق ينهي المزايدة بزر Fold. | المتوقع الانتقال لمرحلة التحدي؛ الفعلي الرسالة فقط مع بقاء `phase=bidding`، وبالتالي زر بدء العداد غير قابل للوصول في الحالة القياسية. | `src/components/views/AuctionBiddingView.jsx`, `src/context/GameContext.jsx`, `server/server.js`, `src/services/supabaseMultiplayerService.js` | Fold يرسل `r4_end_bidding`، السيرفر/خدمة Supabase يثبتان challenge/execution، وزر البدء يقبل الاسمين. |
| Bank: افتح سؤالًا جديدًا. | المتوقع timer تلقائي 30 ثانية؛ الفعلي لا يوجد timer أو endTime مستخدم في شاشة Bank. | `src/components/views/BankTurnView.jsx`, `src/context/GameContext.jsx`, `server/server.js`, `src/game/constants.js` | أضيف إعداد 30 ثانية، endTime عند إظهار السؤال، وعدّاد deadline في الشاشة، ومحاولة حسم تلقائي server-side بعد انتهاء الوقت. لم يُختبر فعليًا بسبب تعطل runner. |
| RTL / tokens | المتوقع توحيد متغيرات الثيم وتطبيقها؛ الفعلي ألوان أساسية متناثرة وبعض المقاسات الضيقة لم تكن مضبوطة. | `src/theme/tokens.js`, `src/theme/tokens.css`, `tailwind.config.js`, `src/index.css` | أضيفت CSS variables وأُحيلت القيم المتكررة في Tailwind، وحد أدنى للشاشة وoverflow-x، واتجاه RTL عام. لم يُجرِ mobile viewport test. |

## فحوص الإعادة بعد الإصلاح

- `npm run build`: PASS — Vite بنى 2054 وحدة وأنتج ملفات production. بقي تحذير حجم bundle أكبر من 500KB وتحذير import لـ `canvas-confetti`.
- `git diff --check`: لا أخطاء whitespace بعد تنظيف السطر الذي أشار إليه Git؛ بقيت تحذيرات تحويل LF/CRLF المعتادة في Windows.
- Socket integration وQA بالمتصفح: لم تتم الإعادة بسبب Node ENOMEM وعدم توفر Playwright contexts. الإصلاحات المشار إليها أعلاه لا تُعد PASS تشغيلية قبل إعادة هذه الفحوص.

## مراجعة إضافية وإصلاحات تكميلية

- Password: أزرار التحكيم كانت ظاهرة لكل مرشد رغم أن قرار النقطة/المخالفة محصور بالحكم الحالي. أصبحت تظهر للحكم فقط؛ المرشد الآخر ما زال يرى الكلمة والممنوعات حسب قاعدة النمط.
- Penalty: انتهاء العداد كان يحسم الركلة محليًا فقط. أصبح الحكم الوحيد يرسل نتيجة miss/save عند الصفر في الجلسات المتصلة، مع guard يمنع تسجيلها مرتين لنفس الركلة. يحتاج تأكيدًا بلعب متعدد فعلي.
- Bank محلي: حالة الجولة كانت تُعدّل مباشرة داخل state سابق، والمهلة لا تنتقل للسؤال التالي محليًا. أصبحت الحالة تُنسخ قبل التعديل، والانتقال يتم بعد ثانيتين من كشف انتهاء الوقت مع التحقق من token.
- أزلت إرسال `r1_timeout` غير المدعوم؛ سيرفر Socket لديه مؤقته authoritative بالفعل ويكشف انتهاء الوقت ثم ينتقل بعد ثانيتين.
- إعادة التحقق: `npm run build` PASS بعد التعديلات (2054 وحدة). تحذير bundle الكبير و`canvas-confetti` ما زالا. `git diff --check` اجتاز بدون trailing whitespace؛ تحذيرات LF/CRLF فقط. ما زال تشغيل الأربع لاعبين والـ runtime checks محجوبًا بمشكلة Node `uv_os_get_passwd returned ENOMEM` وعدم توفر أدوات contexts/لقطات الشاشة.

## المطلوب لاستكمال الـ QA

1. تشغيل الاختبارات على Node بيئة سليمة حيث يعمل `os.userInfo()`، وإعادة `npm run test:r2`, `npm run test:engine`, `npm run test:integrity`, `npm run test:ui`.
2. توفير Playwright أو Chrome CDP بأربع browser contexts حتى ندخل P1/P2 Team A وP3/P4 Team B ونختبر الرؤية والأزرار والرجوع وإعادة الدخول.
3. إعادة تشغيل الاختبارات بعد فحص بنية الجولة المباشرة؛ لقطات الشاشة لم تُنتج في هذه المحاولة.

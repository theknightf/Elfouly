/**
 * scripts/setup_and_mix_questions.mjs
 * Comprehensive Question Bank Setup, Validation, and Mixing Engine for QUIZ ARENA (ساحة الكويز)
 * 
 * Rules:
 * 1. 100% Strict Post-2010 Football (Zero pre-2010 references).
 * 2. 0 Computer Science / Programming / Tourism categories (all mapped/replaced with general_knowledge & character specialties).
 * 3. Complete coverage for all 4 game modes:
 *    - Mode 1: 1 تو (one_two_bank)
 *    - Mode 2: اديني في سري (edini_fi_seri - with 4 forbidden words)
 *    - Mode 3: حط في قريبي (hat_fi_qoraybi - with 4 randomized options)
 *    - Mode 4: مين يزوّد؟ (meen_yezawwed - with rich acceptable_answers lists)
 * 4. Full Character Specialty Alignment (Fares, El-Touny, Khaled, Ziad, Eyad, Mazen, Ali).
 * 5. Complete Fisher-Yates Random Shuffling ("Mix") across the entire dataset and inside multiple-choice options.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Helper: Calculate MD5 Hash
function calculateHash(mode, category, text) {
  const norm = `${mode}_${category}_${text}`.trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(norm, 'utf8').digest('hex');
}

// Helper: Fisher-Yates Shuffle
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper: Validate Post-2010 Football
const FOOTBALL_CATEGORY_HINTS = ['football', 'barcelona', 'ahly', 'real_madrid', 'champions'];
const PRE_2010_YEAR_PATTERN = /\b(1\d{3}|200\d)\b/;

function isFootballItem(item) {
  if (item.is_post_2010_football) return true;
  const category = String(item.category || '').toLowerCase();
  return FOOTBALL_CATEGORY_HINTS.some(hint => category.includes(hint));
}

function validateFootballPost2010(item) {
  if (!isFootballItem(item)) return true;

  if (!item.is_post_2010_football) {
    console.warn(`[Football Guardrail] REJECTED football item without is_post_2010_football flag: ${item.question_text?.substring(0, 50) || item.id}`);
    return false;
  }

  const fullText = [
    item.question_text,
    item.question,
    item.correct_answer,
    item.answer,
    item.target_word,
    item.target,
    JSON.stringify(item.options || []),
    JSON.stringify(item.acceptable_answers || []),
    JSON.stringify(item.forbidden_words || [])
  ].filter(Boolean).join(' ');
  const pre2010Match = fullText.match(PRE_2010_YEAR_PATTERN);
  if (pre2010Match) {
    console.warn(`[Football Guardrail] REJECTED question with pre-2010 year ${pre2010Match[0]}: ${item.question_text?.substring(0, 50)}`);
    return false;
  }
  return true;
}

// Load existing bank to retain already vetted items
const bankPath = path.resolve('data/questions_bank.json');
let existingQuestions = [];
if (fs.existsSync(bankPath)) {
  try {
    existingQuestions = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
    console.log(`Loaded ${existingQuestions.length} existing items from ${bankPath}`);
  } catch (err) {
    console.error('Failed reading existing bank:', err);
  }
}

// NEW HIGH-QUALITY CURATED POOL FOR EXPANSION & FULL COVERAGE
const EXPANSION_ITEMS = [
  // =========================================================================
  // ROUND 1: one_two_bank (1 تو) - EXPANDED CHARACTER SPECIALTIES
  // =========================================================================
  
  // Fares: football_post_2010, capitals_and_flags, general_knowledge
  {
    mode: 'one_two_bank',
    category: 'football_post_2010',
    question_text: 'من فاز بجائزة أفضل لاعب في كأس العالم قطر 2022 وقاد الأرجنتين لحصد اللقب؟',
    correct_answer: 'ليونيل ميسي',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'football_post_2010',
    question_text: 'أي نادٍ إنجليزي فاز بلقب الدوري الممتاز (البريميرليج) لأول مرة في تاريخه بنتيجة معجزة موسم 2015-2016؟',
    correct_answer: 'ليستر سيتي (Leicester City)',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'football_post_2010',
    question_text: 'كم عدد أهداف النجم المصري محمد صلاح القياسية في موسم 2017-2018 بالدوري الإنجليزي في موسم مكون من 38 جولة؟',
    correct_answer: '32 هدفاً',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'football_post_2010',
    question_text: 'من هو الهداف التاريخي لكأس العالم 2022 بعد تسجيله هاتريك أسطوري في المباراة النهائية أمام الأرجنتين؟',
    correct_answer: 'كيليان مبابي (8 أهداف)',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'football_post_2010',
    question_text: 'من كان حارس المرمى العملاق لريال مدريد الذي اختير أفضل لاعب في نهائي دوري أبطال أوروبا 2022 أمام ليفربول بـ 9 تصديات إعجازية؟',
    correct_answer: 'تيبو كورتوا (Thibaut Courtois)',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'football_post_2010',
    question_text: 'في أي ملعب أقيم نهائي دوري أبطال أوروبا 2024 الذي توج فيه ريال مدريد بلقبه الخامس عشر أمام بوروسيا دورتموند؟',
    correct_answer: 'ملعب ويمبلي بلندن',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'capitals_and_flags',
    question_text: 'ما هي عاصمة نيوزيلندا الرسمية؟',
    correct_answer: 'ويلينغتون (Wellington)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'capitals_and_flags',
    question_text: 'علم أي دولة عربية يتوسطه هلال ونجمة خضراء على أرضية بيضاء ونصفه الآخر أحمر؟',
    correct_answer: 'الجزائر',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'capitals_and_flags',
    question_text: 'ما هي عاصمة البرازيل التي تم بناؤها خصيصاً في الداخل لتكون العاصمة الفيدرالية؟',
    correct_answer: 'برازيليا (Brasília)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'أكمل المثل الشعبي الشهير: "اطبخ يا جارية كلف يا..."؟',
    correct_answer: 'سيدي',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'أكمل المثل الشعبي: "يا واخد القوت يا ناوي على..."؟',
    correct_answer: 'الموت',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'ما هو المشروب الساخن الشعبي المفضل في شتاء مصر والمصنوع من مسحوق درنات نبات الأوركيد مع الحليب والمكسرات؟',
    correct_answer: 'السحلب',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'ما هي العاصمة الإدارية التي تحتوي على أطول برج أيقوني في قارة إفريقيا؟',
    correct_answer: 'العاصمة الإدارية الجديدة (مصر)',
    is_post_2010_football: false
  },

  // El-Touny: veterinary_biology, gelato_sweets, islamic_studies
  {
    mode: 'one_two_bank',
    category: 'veterinary_biology',
    question_text: 'ما هو الحيوان الثديي الوحيد القادر على الطيران الحقيقي بفضل أجنحته الجلدية؟',
    correct_answer: 'الخفاش (الوطواط)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'veterinary_biology',
    question_text: 'كم عدد فقرات عنق الزرافة بالرغم من طول رقبتها الفارع (نفس عدد فقرات عنق الإنسان)؟',
    correct_answer: '7 فقرات',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'veterinary_biology',
    question_text: 'ما هو أكبر حيوان لا فقاري في العالم ويمتلك عيوناً بحجم طبق العشاء؟',
    correct_answer: 'الحبار العملاق / الحبار الضخم',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'gelato_sweets',
    question_text: 'ما هي النكهة الإيطالية الكلاسيكية للجيلاتي المصنوعة من الكريمة البيضاء وحبيبات الشوكولاتة الداكنة المقرمشة؟',
    correct_answer: 'ستراتشياتيلا (Stracciatella)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'gelato_sweets',
    question_text: 'ما هي أشهر حلوى رمضانية مصرية تصنع في قوالب مخروطية أو أسطوانية وتسقى بالشربات الساخن؟',
    correct_answer: 'الكنافة',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'gelato_sweets',
    question_text: 'حلوى أم علي المصرية التقليدية تصنع أساساً من رقائق عجينة تُعرف باسم:',
    correct_answer: 'عجينة الميل فاي (Puff Pastry / رقاق)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'islamic_studies',
    question_text: 'من هو الصحابي الجليل الملقب بأمين هذه الأمة وأحد العشرة المبشرين بالجنة؟',
    correct_answer: 'أبو عبيدة عامر بن الجراح',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'islamic_studies',
    question_text: 'في أي عام هجري وقعت غزوة بدر الكبرى (يوم الفرقان) في شهر رمضان المبارك؟',
    correct_answer: 'السنة الثانية للهجرة (2 هـ)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'islamic_studies',
    question_text: 'ما هي أطول سورة في القرآن الكريم من حيث عدد الآيات والصفحات؟',
    correct_answer: 'سورة البقرة (286 آية)',
    is_post_2010_football: false
  },

  // Khaled: veterinary_medicine, pc_hardware_gaming, series_breaking_bad, islamic_culture
  {
    mode: 'one_two_bank',
    category: 'pc_hardware_gaming',
    question_text: 'ما هي الشركة الرائدة عالمياً التي تصنع بطاقات الرسوميات الشهيرة بسلسلة GeForce RTX؟',
    correct_answer: 'إنفيديا (Nvidia)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'pc_hardware_gaming',
    question_text: 'ما هو مقياس الطاقة أو الشهادة التي تضمن كفاءة استهلاك الكهرباء بنسبة 90% أو أعلى في مزودات الطاقة (PSU)؟',
    correct_answer: 'شهادة 80 Plus Gold / Platinum',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'pc_hardware_gaming',
    question_text: 'ما هو المقبس (Socket) الذي تعتمد عليه شركة AMD في أحدث معالجات رايزن من معمارية Zen 4 و Zen 5؟',
    correct_answer: 'مقبس AM5',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'series_breaking_bad',
    question_text: 'ما هي المهنة الأصلية التي كان يمارسها والتر وايت في بداية مسلسل Breaking Bad قبل تحوله لعالم الجريمة؟',
    correct_answer: 'معلم كيمياء في مدرسة ثانوية',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'series_breaking_bad',
    question_text: 'ما هو الاسم الحقيقي للمحامي البارع ذو الإعلانات التلفزيونية الشهيرة في مسلسلي Breaking Bad و Better Call Saul؟',
    correct_answer: 'جيمي ماكغيل (Jimmy McGill)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'series_breaking_bad',
    question_text: 'ما هي السيارة الكلاسيكية المهترئة التي كان يقودها جيسي بينكمان وتحمل لوحة "THE CAPN"؟',
    correct_answer: 'شيفروليه مونت كارلو حمراء',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'islamic_culture',
    question_text: 'ما هو المسجد التاريخي بالقاهرة القديمة الذي أنشأه القائد جوهر الصقلي في العهد الفاطمي ويعد أقدم جامعة إسلامية؟',
    correct_answer: 'الجامع الأزهر الشريف',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'islamic_culture',
    question_text: 'ما هو المعلم الإسلامي البارز في القدس الشريف ذو القبة الذهبية المثمنة الأضلاع التي بناها عبد الملك بن مروان؟',
    correct_answer: 'مسجد قبة الصخرة المشرفة',
    is_post_2010_football: false
  },

  // Ziad: popular_foreign_series, football_post_2010, general_knowledge
  {
    mode: 'one_two_bank',
    category: 'popular_foreign_series',
    question_text: 'في مسلسل Game of Thrones، ما هي العبارة الشهيرة باللغة الفاليرية التي تعني "كل الرجال يجب أن يموتوا"؟',
    correct_answer: 'فالار مورغوليس (Valar Morghulis)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'popular_foreign_series',
    question_text: 'ما هو اسم العصابة الإنجليزية الشهيرة في برمنغهام بقيادة توماس شيلبي في مسلسل Peaky Blinders؟',
    correct_answer: 'بيكي بلايندرز (Peaky Blinders)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'popular_foreign_series',
    question_text: 'في المسلسل الألماني الشهير Dark، ما هي جملة السفر عبر الزمن الجوهرية التي تكررت طوال المسلسل؟',
    correct_answer: 'السؤال ليس أين، بل متى! (Wann ist Mikkel)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'popular_foreign_series',
    question_text: 'في مسلسل Stranger Things، ما هو اسم البعد الموازي المظلم والمرعب الذي تسكنه الوحوش؟',
    correct_answer: 'العالم المقلوب (The Upside Down)',
    is_post_2010_football: false
  },

  // Eyad: gaming_tech, general_knowledge, football_post_2010
  {
    mode: 'one_two_bank',
    category: 'gaming_tech',
    question_text: 'ما هو مصطلح اختبار سرعة استجابة الاتصال بين جهازك وخادم اللعبة عبر الإنترنت والمقاس بالمللي ثانية؟',
    correct_answer: 'البنج (Ping / Latency)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'gaming_tech',
    question_text: 'ما هي المنصة الرقمية الأضخم عالمياً لشراء وتشغيل ألعاب الفيديو على أجهزة الكمبيوتر والمملوكة لشركة Valve؟',
    correct_answer: 'ستيم (Steam)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'gaming_tech',
    question_text: 'ماذا تعني تقنية تتبع الأشعة الثورية في ألعاب الفيديو الحديثة لمحاكاة الإضاءة والظلال الحقيقية؟',
    correct_answer: 'راي تريسينج (Ray Tracing)',
    is_post_2010_football: false
  },

  // Mazen: health_sciences_lab, console_pc_gaming, reflex_trivia
  {
    mode: 'one_two_bank',
    category: 'health_sciences_lab',
    question_text: 'ما هي فصيلة الدم البشرية الملقبة بـ "المعطي العام" لأنها تستطيع التبرع بالدم لجميع الفصائل الأخرى؟',
    correct_answer: 'فصيلة دم O سالب (O negative)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'health_sciences_lab',
    question_text: 'ما هو التحليل المعملي الشهير الذي يقيس متوسط نسبة السكر المرتبط بالهيموجلوبين على مدار 3 أشهر ماضية؟',
    correct_answer: 'السكر التراكمي (HbA1c)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'console_pc_gaming',
    question_text: 'ما هي لعبة العالم المفتوح الملحمية التي حصدت جائزة لعبة العام (GOTY) 2022 من استوديو FromSoftware؟',
    correct_answer: 'إلدن رينج (Elden Ring)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'console_pc_gaming',
    question_text: 'من هو بطل الغرب الأمريكي والراعي الوفي لعصابة داتش في تحفة روكستار Red Dead Redemption 2؟',
    correct_answer: 'آرثر مورغان (Arthur Morgan)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'reflex_trivia',
    question_text: 'سؤال سرعة: إذا كان لديك 3 تفاحات وأخذت منها تفاحتين، كم تفاحة أصبحت في يدك الآن؟',
    correct_answer: 'تفاحتان (اللتان أخذتهما!)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'reflex_trivia',
    question_text: 'سؤال سرعة رد فعل: ما هو الرقم الذي إذا ضربته في أي رقم آخر على وجه الأرض كانت النتيجة صفراً؟',
    correct_answer: 'الصفر (0)',
    is_post_2010_football: false
  },

  // Ali: dentistry, cars_mechanics, fitness_gym
  {
    mode: 'one_two_bank',
    category: 'dentistry',
    question_text: 'ما هي الطبقة الحساسة التي تقع مباشرة تحت طبقة مينا الأسنان وتحتوي على أنابيب مجهرية تنقل الإحساس للعصب؟',
    correct_answer: 'العاج (Dentin)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'dentistry',
    question_text: 'ما هو الإجراء السني الذي يتم فيه إزالة نسيج اللب الملتهب من داخل جذور السن واستبداله بمادة حشو معقمة؟',
    correct_answer: 'علاج وحشو العصب (Root Canal)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'cars_mechanics',
    question_text: 'ما هو السائل الحيوي المسؤول عن منع ارتفاع درجة حرارة محرك السيارة ونقل الحرارة إلى الردياتير؟',
    correct_answer: 'سائل التبريد (Coolant / مياه التبريد)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'cars_mechanics',
    question_text: 'ماذا يعني اختصار نظام الأمان الشهير في مكابح السيارات ABS؟',
    correct_answer: 'نظام منع انغلاق المكابح (Anti-lock Braking System)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'fitness_gym',
    question_text: 'ما هو التمرين الأساسي الأقوى في كمال الأجسام والقوة البدنية الذي يُلقب بـ "ملك التمارين" لعضلات الجزء السفلي؟',
    correct_answer: 'السكوات (Squat / القرفصاء)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'fitness_gym',
    question_text: 'ما هو المكمل الغذائي الطبيعي الأكثر بحثاً وتأكيداً علمياً لزيادة مخازن الطاقة الخلوية (ATP) وقوة العضلات؟',
    correct_answer: 'الكرياتين مونوهيدرات (Creatine)',
    is_post_2010_football: false
  },

  // =========================================================================
  // ROUND 2: edini_fi_seri (اديني في سري - Password / Taboo)
  // =========================================================================
  {
    mode: 'edini_fi_seri',
    category: 'football_post_2010',
    question_text: 'محمد صلاح',
    correct_answer: 'محمد صلاح',
    forbidden_words: ['ليفربول', 'فخر العرب', 'مصر', 'هداف'],
    is_post_2010_football: true
  },
  {
    mode: 'edini_fi_seri',
    category: 'football_post_2010',
    question_text: 'كريستيانو رونالدو',
    correct_answer: 'كريستيانو رونالدو',
    forbidden_words: ['الدون', 'ريال مدريد', 'البرتغال', 'النصر'],
    is_post_2010_football: true
  },
  {
    mode: 'edini_fi_seri',
    category: 'football_post_2010',
    question_text: 'إيرلينغ هالاند',
    correct_answer: 'إيرلينغ هالاند',
    forbidden_words: ['مانشستر سيتي', 'النرويج', 'وحش', 'هداف'],
    is_post_2010_football: true
  },
  {
    mode: 'edini_fi_seri',
    category: 'football_post_2010',
    question_text: 'كريم بنزيما',
    correct_answer: 'كريم بنزيما',
    forbidden_words: ['كرة ذهبية', 'ريال مدريد', 'فرنسا', 'الاتحاد'],
    is_post_2010_football: true
  },
  {
    mode: 'edini_fi_seri',
    category: 'general_knowledge',
    question_text: 'حواوشي',
    correct_answer: 'حواوشي',
    forbidden_words: ['لحمة', 'عيش', 'فرن', 'مفروم'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'general_knowledge',
    question_text: 'ملوخية',
    correct_answer: 'ملوخية',
    forbidden_words: ['شوربة', 'طشة', 'أرانب', 'خضراء'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'general_knowledge',
    question_text: 'برج القاهرة',
    correct_answer: 'برج القاهرة',
    forbidden_words: ['الجزيرة', 'لوتس', 'مصر', 'مطعم دوار'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'general_knowledge',
    question_text: 'فانوس رمضان',
    correct_answer: 'فانوس رمضان',
    forbidden_words: ['شمعة', 'نور', 'صيام', 'أطفال'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'pc_hardware_gaming',
    question_text: 'كارت شاشة (GPU)',
    correct_answer: 'كارت شاشة (GPU)',
    forbidden_words: ['إنفيديا', 'جيمنج', 'فريمات', 'RTX'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'pc_hardware_gaming',
    question_text: 'معجون حراري',
    correct_answer: 'معجون حراري',
    forbidden_words: ['بروسيسور', 'تبريد', 'حرارة', 'مروحة'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'series_breaking_bad',
    question_text: 'هايزنبرغ',
    correct_answer: 'هايزنبرغ',
    forbidden_words: ['والتر وايت', 'طاقية', 'كيمياء', 'سرطان'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'popular_foreign_series',
    question_text: 'توماس شيلبي',
    correct_answer: 'توماس شيلبي',
    forbidden_words: ['بيكي بلايندرز', 'سيجارة', 'عصابة', 'إنجلترا'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'popular_foreign_series',
    question_text: 'جون سنو (Jon Snow)',
    correct_answer: 'جون سنو (Jon Snow)',
    forbidden_words: ['صراع العروش', 'الجدار', 'ذئب', 'وينترفيل'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'dentistry',
    question_text: 'تقويم الأسنان',
    correct_answer: 'تقويم الأسنان',
    forbidden_words: ['سلك', 'اعوجاج', 'ابتسامة', 'دكتور'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'cars_mechanics',
    question_text: 'شاحن تيربو (Turbo)',
    correct_answer: 'شاحن تيربو (Turbo)',
    forbidden_words: ['هواء', 'محرك', 'سرعة', 'حصان'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'fitness_gym',
    question_text: 'بنش برس (Bench Press)',
    correct_answer: 'بنش برس (Bench Press)',
    forbidden_words: ['صدر', 'بار', 'أوزان', 'جيم'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'fitness_gym',
    question_text: 'كرياتين (Creatine)',
    correct_answer: 'كرياتين (Creatine)',
    forbidden_words: ['مكمل', 'باودر', 'طاقة', 'مياه'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'gelato_sweets',
    question_text: 'جيلاتي (Gelato)',
    correct_answer: 'جيلاتي (Gelato)',
    forbidden_words: ['آيس كريم', 'إيطاليا', 'مثلج', 'بولة'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'veterinary_biology',
    question_text: 'زرافة',
    correct_answer: 'زرافة',
    forbidden_words: ['رقبة', 'طويلة', 'حيوان', 'أفريقيا'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'health_sciences_lab',
    question_text: 'ميكروسكوب',
    correct_answer: 'ميكروسكوب',
    forbidden_words: ['تكبير', 'معمل', 'عدسة', 'خلايا'],
    is_post_2010_football: false
  },

  // =========================================================================
  // ROUND 3: hat_fi_qoraybi (حط في قريبي - Penalty Speed 1v1)
  // =========================================================================
  {
    mode: 'hat_fi_qoraybi',
    category: 'football_post_2010',
    question_text: 'أي منتخب حقق لقب كأس أمم إفريقيا 2019 التي أقيمت في مصر؟',
    options: ['الجزائر', 'السنغال', 'نيجيريا', 'تونس'],
    correct_answer: 'الجزائر',
    is_post_2010_football: true
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'football_post_2010',
    question_text: 'من سجل هدف فوز ألمانيا بكأس العالم 2014 في الوقت الإضافي أمام الأرجنتين؟',
    options: ['ماريو غوتزه', 'توماس مولر', 'ميروسلاف كلوزه', 'مسعود أوزيل'],
    correct_answer: 'ماريو غوتزه',
    is_post_2010_football: true
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'football_post_2010',
    question_text: 'كم مرة توج النادي الأهلي المصري بلقب دوري أبطال إفريقيا في الفترة من 2012 حتى 2024؟',
    options: ['6 ألقاب', '4 ألقاب', '3 ألقاب', '5 ألقاب'],
    correct_answer: '6 ألقاب',
    is_post_2010_football: true
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'football_post_2010',
    question_text: 'من فاز بلقب هداف الدوري الإسباني موسم 2021-2022 وقاد ريال مدريد للتتويج بالليغا والأبطال؟',
    options: ['كريم بنزيما', 'فينيسيوس جونيور', 'إياغو أسباس', 'راؤول دي توماس'],
    correct_answer: 'كريم بنزيما',
    is_post_2010_football: true
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'general_knowledge',
    question_text: 'ما هو الكوكب الأقرب للشمس في نظامنا الشمسي؟',
    options: ['عطارد', 'الزهرة', 'المريخ', 'الأرض'],
    correct_answer: 'عطارد',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'general_knowledge',
    question_text: 'ما هي عاصمة إسبانيا؟',
    options: ['مدريد', 'برشلونة', 'إشبيلية', 'فالنسيا'],
    correct_answer: 'مدريد',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'general_knowledge',
    question_text: 'كم عدد ألوان قوس قزح؟',
    options: ['7 ألوان', '6 ألوان', '8 ألوان', '5 ألوان'],
    correct_answer: '7 ألوان',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'pc_hardware_gaming',
    question_text: 'أي شركة تصنع سلسلة معالجات Core Ultra الحديثة؟',
    options: ['Intel', 'AMD', 'Nvidia', 'Apple'],
    correct_answer: 'Intel',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'series_breaking_bad',
    question_text: 'ما هو لون الميث البلوري فائق النقاوة الذي كان ينتجه والتر وايت؟',
    options: ['أزرق ساطع', 'أخضر زمردي', 'أبيض شفاف', 'أصفر ذهبي'],
    correct_answer: 'أزرق ساطع',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'dentistry',
    question_text: 'ما هو عدد ضروس العقل الكاملة لدى الإنسان البالغ الطبيعي؟',
    options: ['4 ضروس', '2 ضرس', '6 ضروس', '8 ضروس'],
    correct_answer: '4 ضروس',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'cars_mechanics',
    question_text: 'ما هي بلد المنشأ لشركة بورشه (Porsche) العريقة لصناعة السيارات الرياضية؟',
    options: ['ألمانيا', 'إيطاليا', 'بريطانيا', 'السويد'],
    correct_answer: 'ألمانيا',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'fitness_gym',
    question_text: 'أي عضلة من العضلات التالية تقع في الذراع وتتكون من ثلاثة رؤوس؟',
    options: ['الترايسبس (Triceps)', 'البايسبس (Biceps)', 'الكتف الجانبي', 'الساعد'],
    correct_answer: 'الترايسبس (Triceps)',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'console_pc_gaming',
    question_text: 'ما هي الشركة المطورة والناشرة لسلسلة ألعاب Grand Theft Auto (GTA)؟',
    options: ['Rockstar Games', 'Ubisoft', 'Electronic Arts', 'Activision'],
    correct_answer: 'Rockstar Games',
    is_post_2010_football: false
  },

  // =========================================================================
  // ROUND 4: meen_yezawwed (مين يزوّد؟ - Blind Auction)
  // =========================================================================
  {
    mode: 'meen_yezawwed',
    category: 'football_post_2010',
    question_text: 'أندية حققت لقب الدوري الإنجليزي الممتاز (Premier League) في الفترة من 2010 حتى 2024',
    acceptable_answers: [
      'تشيلسي', 'مانشستر يونايتد', 'مانشستر سيتي', 'ليستر سيتي', 'ليفربول'
    ],
    is_post_2010_football: true
  },
  {
    mode: 'meen_yezawwed',
    category: 'football_post_2010',
    question_text: 'نجوم فازوا بجائزة الكرة الذهبية (Ballon d\'Or) لأفضل لاعب في العالم في الفترة من 2010 حتى 2024',
    acceptable_answers: [
      'ليونيل ميسي', 'كريستيانو رونالدو', 'لوكا مودريتش', 'كريم بنزيما', 'رودري'
    ],
    is_post_2010_football: true
  },
  {
    mode: 'meen_yezawwed',
    category: 'football_post_2010',
    question_text: 'منتخبات وصلت إلى المربع الذهبي (نصف النهائي) لكأس العالم في دورات (2010، 2014، 2018، 2022)',
    acceptable_answers: [
      'إسبانيا', 'هولندا', 'ألمانيا', 'أوروغواي', 'الأرجنتين',
      'البرازيل', 'فرنسا', 'كرواتيا', 'بلجيكا', 'إنجلترا', 'المغرب'
    ],
    is_post_2010_football: true
  },
  {
    mode: 'meen_yezawwed',
    category: 'general_knowledge',
    question_text: 'عواصم دول في قارة أوروبا',
    acceptable_answers: [
      'لندن', 'باريس', 'مدريد', 'روما', 'برلين', 'أمستردام', 'بروكسل',
      'فيينا', 'لشبونة', 'أثينا', 'وارسو', 'براغ', 'بودابست', 'دبلن',
      'ستوكهولم', 'أوسلو', 'كوبنهاغن', 'هلسنكي', 'برن', 'بلغراد'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'general_knowledge',
    question_text: 'أكلات ومشروبات وحلويات شعبية مصرية تقليدية',
    acceptable_answers: [
      'كشري', 'ملوخية', 'فول مدمس', 'طعمية (فلافل)', 'حواوشي', 'كباب وكفتة',
      'حمام محشي', 'فتة بالخل والثوم', 'أم علي', 'بسبوسة', 'كنافة',
      'بلح الشام', 'زلابية (لقمة القاضي)', 'سحلب', 'قصب السكر', 'كركديه', 'عرقسوس'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'pc_hardware_gaming',
    question_text: 'قطع ومكونات تجميعة الكمبيوتر المكتبي (PC Hardware & Peripherals)',
    acceptable_answers: [
      'المعالج (CPU)', 'كارت الشاشة (GPU)', 'اللوحة الأم (Motherboard)',
      'ذاكرة الوصول العشوائي (RAM)', 'وحدة التخزين (SSD NVMe)', 'مزود الطاقة (Power Supply)',
      'صندوق الحاسوب (Case)', 'المبرد المائي / الهوائي (Cooler)', 'المعجون الحراري',
      'شاشة العرض (Monitor)', 'كيبورد ميكانيكي', 'ماوس جيمنج', 'سماعة رأس'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'cars_mechanics',
    question_text: 'علامات وماركات سيارات عالمية شهيرة',
    acceptable_answers: [
      'مرسيدس بنز', 'بي إم دبليو', 'أودي', 'بورشه', 'فيراري', 'لامبورغيني',
      'تويوتا', 'هوندا', 'نيسان', 'مازدا', 'هيونداي', 'كيا', 'فولكس فاجن',
      'فورد', 'شيفروليه', 'تسلا', 'فولفو', 'لاند روفر', 'جيب', 'بيجو'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'fitness_gym',
    question_text: 'عضلات ومجموعات عضلية رئيسية في جسم الإنسان يركز عليها تدريب الجيم',
    acceptable_answers: [
      'عضلة الصدر (Pectorals)', 'عضلة الظهر واللاتس (Lats)', 'عضلة البايسبس (Biceps)',
      'عضلة الترايسبس (Triceps)', 'عضلات الكتف والدالية (Deltoids)',
      'عضلات البطن (Abs)', 'عضلات الفخذ الأمامية (Quadriceps)',
      'عضلات الفخذ الخلفية (Hamstrings)', 'عضلات السمانة (Calves)', 'عضلات الترابيس (Trapezius)'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'series_breaking_bad',
    question_text: 'شخصيات بارزة في مسلسلي Breaking Bad و Better Call Saul',
    acceptable_answers: [
      'والتر وايت', 'جيسي بينكمان', 'سول غودمان', 'غاس فرينغ', 'مايك إيرمنتروت',
      'هانك شريدر', 'سكايلر وايت', 'كيم ويكسلر', 'توكو سالامانكا', 'هيكتور سالامانكا',
      'ناتشو فارغا', 'لالو سالامانكا', 'تشاك ماكغيل', 'ماري شريدر'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'popular_foreign_series',
    question_text: 'مسلسلات أجنبية درامية شهيرة تم بثها أو اختتامها بعد عام 2010',
    acceptable_answers: [
      'Game of Thrones', 'Breaking Bad', 'Peaky Blinders', 'Stranger Things',
      'Dark', 'Succession', 'The Boys', 'Better Call Saul', 'House of the Dragon',
      'Chernobyl', 'Sherlock', 'The Last of Us', 'Vikings', 'Black Mirror'
    ],
    is_post_2010_football: false
  }
];

// Main Orchestrator
async function setupAndMix() {
  console.log('\n============================================================');
  console.log('⚡ QUIZ ARENA - COMPREHENSIVE QUESTION BANK SETUP & MIX ENGINE');
  console.log('============================================================\n');

  // 1. Clean & Convert existing questions
  const cleanedExisting = [];
  const deprecatedCategories = ['computer_science', 'programming', 'tourism_and_hospitality', 'tourism_hospitality'];
  let deprecatedCount = 0;

  for (const q of existingQuestions) {
    // If category is deprecated, convert to general_knowledge
    let cat = q.category;
    if (deprecatedCategories.includes(cat)) {
      cat = 'general_knowledge';
      deprecatedCount++;
    }

    // Check football guardrail (including missing flags on football categories)
    if (!validateFootballPost2010(q)) {
      continue;
    }

    cleanedExisting.push({
      ...q,
      category: cat
    });
  }

  console.log(`Cleaned existing questions: converted ${deprecatedCount} deprecated category references.`);

  // 2. Merge existing and expansion pools with deduplication
  const allCandidates = [...cleanedExisting, ...EXPANSION_ITEMS];
  const uniqueQuestions = [];
  const seenHashes = new Set();
  let duplicatesSkipped = 0;

  for (const item of allCandidates) {
    const rawText = item.question_text || item.correct_answer || (item.options && item.options[0]) || '';
    const hash = calculateHash(item.mode, item.category, rawText);

    if (seenHashes.has(hash)) {
      duplicatesSkipped++;
      continue;
    }
    seenHashes.add(hash);

    // If item has options (multiple choice), shuffle the options!
    let options = item.options;
    if (Array.isArray(options) && options.length > 0) {
      options = shuffle(options);
    }

    uniqueQuestions.push({
      id: item.id || crypto.randomUUID(),
      mode: item.mode,
      category: item.category,
      question_text: item.question_text || null,
      correct_answer: item.correct_answer || null,
      options: options || null,
      forbidden_words: item.forbidden_words || null,
      acceptable_answers: item.acceptable_answers || null,
      content_hash: hash,
      is_post_2010_football: !!item.is_post_2010_football,
      created_at: item.created_at || new Date().toISOString()
    });
  }

  console.log(`Deduplication: ${uniqueQuestions.length} unique questions retained (${duplicatesSkipped} duplicates skipped).`);

  // 3. THE MIX: Full Fisher-Yates Random Shuffling across the entire bank
  console.log('🎲 Mixing and shuffling the entire bank thoroughly with Fisher-Yates algorithm...');
  const thoroughlyMixed = shuffle(shuffle(uniqueQuestions));

  // 4. Verification Audits
  console.log('\nRunning strict verification checks on mixed bank:');

  // Audit A: Deprecated Categories check
  const badCats = thoroughlyMixed.filter(q => deprecatedCategories.includes(q.category));
  if (badCats.length > 0) {
    throw new Error(`CRITICAL: Found ${badCats.length} items with deprecated categories!`);
  }
  console.log('  ✅ 0 deprecated categories (100% compliant)');

  // Audit B: Football Post-2010 Strict Guardrail
  const footballItems = thoroughlyMixed.filter(isFootballItem);
  for (const fb of footballItems) {
    if (!validateFootballPost2010(fb)) {
      throw new Error(`CRITICAL: Found unsafe football content in question ID ${fb.id}!`);
    }
  }
  console.log(`  ✅ Audited ${footballItems.length} football questions: 100% Post-2010 verified.`);

  // Audit C: Mode Distribution Breakdown
  const modeCounts = {};
  for (const q of thoroughlyMixed) {
    modeCounts[q.mode] = (modeCounts[q.mode] || 0) + 1;
  }
  console.log('\n📊 Questions Bank Distribution by Game Mode:');
  console.table(modeCounts);

  // Audit D: Category Distribution Breakdown
  const catCounts = {};
  for (const q of thoroughlyMixed) {
    catCounts[q.category] = (catCounts[q.category] || 0) + 1;
  }
  console.log('📊 Questions Bank Distribution by Category:');
  console.table(catCounts);

  // 5. Persist to data/questions_bank.json
  fs.writeFileSync(bankPath, JSON.stringify(thoroughlyMixed, null, 2), 'utf8');
  console.log(`\n💾 Saved ${thoroughlyMixed.length} mixed questions cleanly to ${bankPath}`);

  console.log('\n============================================================');
  console.log('🎉 QUESTION BANK SETUP & MIXING COMPLETED SUCCESSFULLY!');
  console.log('============================================================\n');
}

setupAndMix().catch(err => {
  console.error('Fatal setup error:', err);
  process.exit(1);
});

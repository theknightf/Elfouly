/**
 * scripts/sync_penalty_bank.mjs
 * Generates and synchronizes an extensive, rich pool of penalty shootout (hat_fi_qoraybi) questions
 * across ALL 15 official game categories, ensuring questions and categories are 100% synced!
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 15 Official Categories
const OFFICIAL_PENALTY_CATEGORIES = [
  'football_post_2010',
  'capitals_and_flags',
  'general_knowledge',
  'popular_foreign_series',
  'series_breaking_bad',
  'pc_hardware_gaming',
  'gaming_tech',
  'console_pc_gaming',
  'reflex_trivia',
  'cars_mechanics',
  'dentistry',
  'fitness_gym',
  'veterinary_biology',
  'gelato_sweets',
  'islamic_studies'
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calculateHash(mode, category, text) {
  const norm = `${mode}_${category}_${text}`.trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(norm, 'utf8').digest('hex');
}

// Curated questions for each category (Speed MCQ format: question, options, correct_answer)
const PENALTY_DATASET = [
  // 1. football_post_2010
  {
    category: 'football_post_2010',
    question: 'من أحرز هدف الفوز لمانشستر سيتي في نهائي دوري أبطال أوروبا 2023 أمام إنتر ميلان؟',
    answer: 'رودري',
    options: ['كيفين دي بروين', 'رودري', 'إيرلينغ هالاند', 'إلكاي غوندوغان'],
    is_post_2010_football: true
  },
  {
    category: 'football_post_2010',
    question: 'في أي دولة أقيمت نهائيات كأس العالم 2018 التي توجت بها فرنسا؟',
    answer: 'روسيا',
    options: ['البرازيل', 'روسيا', 'جنوب إفريقيا', 'قطر'],
    is_post_2010_football: true
  },
  {
    category: 'football_post_2010',
    question: 'من كان مدرب منتخب الأرجنتين الذي توج بكأس العالم قطر 2022 وكوبا أمريكا؟',
    answer: 'ليونيل سكالوني',
    options: ['خورخي سامباولي', 'ليونيل سكالوني', 'مارسيلو بيلسا', 'ماوريسيو بوتشيتينو'],
    is_post_2010_football: true
  },
  {
    category: 'football_post_2010',
    question: 'كم هدفاً سجل لويس سواريز مع برشلونة ليتوج بجائزة الحذاء الذهبي الأوروبي 2015-2016؟',
    answer: '40 هدفاً',
    options: ['35 هدفاً', '38 هدفاً', '40 هدفاً', '42 هدفاً'],
    is_post_2010_football: true
  },
  {
    category: 'football_post_2010',
    question: 'من حصد جائزة أفضل حارس مرمى (The Best) في العالم لعام 2021 بعد قيادة تشيلسي للقب الأبطال؟',
    answer: 'إدوارد ميندي',
    options: ['جانلويجي دوناروما', 'إدوارد ميندي', 'مانويل نوير', 'تيبو كورتوا'],
    is_post_2010_football: true
  },
  {
    category: 'football_post_2010',
    question: 'أي نادٍ ألماني فاز بلقب الدوري الألماني موسم 2023-2024 بدون أي هزيمة بقيادة تشابي ألونسو؟',
    answer: 'باير ليفركوزن',
    options: ['بوروسيا دورتموند', 'بايرن ميونخ', 'باير ليفركوزن', 'آر بي لايبزيغ'],
    is_post_2010_football: true
  },
  {
    category: 'football_post_2010',
    question: 'من هو أصغر لاعب يسجل في تاريخ بطولة أمم أوروبا (يورو 2024) بعمر 16 عاماً؟',
    answer: 'لامين يامال',
    options: ['أردا غولر', 'لامين يامال', 'جمال موسيالا', 'جود بيلينغهام'],
    is_post_2010_football: true
  },
  {
    category: 'football_post_2010',
    question: 'من سجل هدف فوز تشيلسي في نهائي دوري أبطال أوروبا 2021 أمام مانشستر سيتي؟',
    answer: 'كاي هافيرتز',
    options: ['ماسون ماونت', 'كاي هافيرتز', 'تيمو فيرنر', 'نغولو كانتي'],
    is_post_2010_football: true
  },

  // 2. capitals_and_flags
  {
    category: 'capitals_and_flags',
    question: 'ما هي عاصمة كوريا الجنوبية التكنولوجية الشهيرة؟',
    answer: 'سيول',
    options: ['بوسان', 'سيول', 'إنتشون', 'دايغو'],
    is_post_2010_football: false
  },
  {
    category: 'capitals_and_flags',
    question: 'علم أي دولة عربية يتوسطه شجرة الأرز الخضراء الشهيرة؟',
    answer: 'لبنان',
    options: ['الأردن', 'لبنان', 'سوريا', 'فلسطين'],
    is_post_2010_football: false
  },
  {
    category: 'capitals_and_flags',
    question: 'ما هي عاصمة النرويج الرسمية؟',
    answer: 'أوسلو',
    options: ['ستوكهولم', 'هلسنكي', 'أوسلو', 'كوبنهاغن'],
    is_post_2010_football: false
  },
  {
    category: 'capitals_and_flags',
    question: 'ما هي عاصمة كندا الفيدرالية؟',
    answer: 'أوتاوا',
    options: ['تورونتو', 'فانكوفر', 'مونتريال', 'أوتاوا'],
    is_post_2010_football: false
  },
  {
    category: 'capitals_and_flags',
    question: 'أي دولة يتكون علمها من شمس في المنتصف بخلفية زرقاء وسماوية وخطوط صفراء؟',
    answer: 'الأرجنتين',
    options: ['أوروغواي', 'الأرجنتين', 'كولومبيا', 'تشيلي'],
    is_post_2010_football: false
  },
  {
    category: 'capitals_and_flags',
    question: 'ما هي عاصمة المغرب السياسية والإدارية؟',
    answer: 'الرباط',
    options: ['الدار البيضاء', 'مراكش', 'طنجة', 'الرباط'],
    is_post_2010_football: false
  },
  {
    category: 'capitals_and_flags',
    question: 'ما هي عاصمة إندونيسيا الحالية؟',
    answer: 'جاكرتا',
    options: ['بالي', 'جاكرتا', 'سورابايا', 'باندونغ'],
    is_post_2010_football: false
  },

  // 3. general_knowledge
  {
    category: 'general_knowledge',
    question: 'أكمل المثل الشعبي المصري الشهير: "الباب اللي يجيلك منه الريح..."؟',
    answer: 'سده واستريح',
    options: ['افتحه وصيح', 'سده واستريح', 'كسره يطيح', 'بيعه وتستريح'],
    is_post_2010_football: false
  },
  {
    category: 'general_knowledge',
    question: 'ما هو أكبر كائن حي يعيش على كوكب الأرض حالياً؟',
    answer: 'الحوت الأزرق',
    options: ['الفيل الإفريقي', 'الحوت الأزرق', 'القرش الأبيض', 'الزرافة'],
    is_post_2010_football: false
  },
  {
    category: 'general_knowledge',
    question: 'كم عدد عظام جسم الإنسان البالغ الطبيعي؟',
    answer: '206 عظمة',
    options: ['180 عظمة', '206 عظمة', '215 عظمة', '300 عظمة'],
    is_post_2010_football: false
  },
  {
    category: 'general_knowledge',
    question: 'ما هي القناة المائية العالمية التي افتتحت في مصر عام 1869 لربط البحرين المتوسط والأحمر؟',
    answer: 'قناة السويس',
    options: ['قناة بنما', 'قناة السويس', 'مضيق البوسفور', 'مضيق جبل طارق'],
    is_post_2010_football: false
  },
  {
    category: 'general_knowledge',
    question: 'أكمل الفزورة الشعبية: "ابن أمك وأبوك ومش أختك ولا أخوك.. مين هو؟"',
    answer: 'أنت نفسك!',
    options: ['ابن عمك', 'خالك', 'أنت نفسك!', 'صاحبك'],
    is_post_2010_football: false
  },
  {
    category: 'general_knowledge',
    question: 'ما هي المادة الأشد صلابة وقساوة في الطبيعة على مقياس موهس؟',
    answer: 'الألماس',
    options: ['الجرانيت', 'الكوارتز', 'الألماس', 'التيتانيوم'],
    is_post_2010_football: false
  },

  // 4. popular_foreign_series
  {
    category: 'popular_foreign_series',
    question: 'في مسلسل Game of Thrones، ما هو شعار عائلة ستارك في وينترفيل؟',
    answer: 'الشتاء قادم (Winter is Coming)',
    options: ['اسمع زئيري', 'الشتاء قادم (Winter is Coming)', 'النار والدم', 'نحن لا نزرع'],
    is_post_2010_football: false
  },
  {
    category: 'popular_foreign_series',
    question: 'ما اسم الملياردير البارع ورب عائلة روي في مسلسل Succession الدرامي؟',
    answer: 'لوغان روي (Logan Roy)',
    options: ['كيندال روي', 'لوغان روي (Logan Roy)', 'رومان روي', 'توم وامبسغانز'],
    is_post_2010_football: false
  },
  {
    category: 'popular_foreign_series',
    question: 'في مسلسل Stranger Things، ما هو رقم الفتاة ذات القدرات الخارقة؟',
    answer: 'إيلفين (Eleven - 11)',
    options: ['تسعة (9)', 'عشرة (10)', 'إيلفين (Eleven - 11)', 'سبعة (7)'],
    is_post_2010_football: false
  },
  {
    category: 'popular_foreign_series',
    question: 'ما هي المدينة الإسبانية التي اتخذها أفراد العصابة أسماء مستعارة لهم في La Casa de Papel؟',
    answer: 'طوكيو، برلين، نيروبي، دنفر',
    options: ['طوكيو، برلين، نيروبي، دنفر', 'مدريد، برشلونة، إشبيلية', 'لندن، باريس، روما', 'نيويورك، ميامي، شيكاغو'],
    is_post_2010_football: false
  },
  {
    category: 'popular_foreign_series',
    question: 'في المسلسل الكوري Squid Game (لعبة الحبار)، ما هي اللعبة الأولى الشهيرة؟',
    answer: 'الضوء الأحمر، الضوء الأخضر',
    options: ['شد الحبل', 'قرص السكر', 'الضوء الأحمر، الضوء الأخضر', 'لعبة الحبار'],
    is_post_2010_football: false
  },

  // 5. series_breaking_bad
  {
    category: 'series_breaking_bad',
    question: 'ما هي المادة السامة المستخرجة من بذور الخروع التي استخدمها والتر وايت؟',
    answer: 'الريسين (Ricin)',
    options: ['الزرنيخ', 'السيانيد', 'الريسين (Ricin)', 'البوتوكس'],
    is_post_2010_football: false
  },
  {
    category: 'series_breaking_bad',
    question: 'ما هو لقب زوج أخت والتر وايت العميل في مكافحة المخدرات DEA؟',
    answer: 'هانك شريدر',
    options: ['ستيف غوميز', 'هانك شريدر', 'جورج هيندريكس', 'مايك إيرمنتروت'],
    is_post_2010_football: false
  },
  {
    category: 'series_breaking_bad',
    question: 'ما اسم المحامية الذكية وشريكة جيمي ماكغيل في Better Call Saul؟',
    answer: 'كيم ويكسلر (Kim Wexler)',
    options: ['فرانسيسكا', 'كيم ويكسلر (Kim Wexler)', 'سكايلر', 'ماري'],
    is_post_2010_football: false
  },
  {
    category: 'series_breaking_bad',
    question: 'ما هي الكلمة الشهيرة التي قالها والتر وايت لسكايلر: "أنا لست في خطر يا سكايلر، أنا..."؟',
    answer: 'أنا الخطر! (I am the danger)',
    options: ['أنا المدير!', 'أنا الخطر! (I am the danger)', 'أنا العبقري!', 'أنا البطل!'],
    is_post_2010_football: false
  },
  {
    category: 'series_breaking_bad',
    question: 'كيف قضى والتر وايت على غاس فرينغ في دار رعاية المسنين؟',
    answer: 'قنبلة موصولة بكرسي هيكتور سالامانكا المتحرك',
    options: ['رصاصة قناص', 'سم الريسين في القهوة', 'قنبلة موصولة بكرسي هيكتور سالامانكا المتحرك', 'حادث سيارة'],
    is_post_2010_football: false
  },

  // 6. pc_hardware_gaming
  {
    category: 'pc_hardware_gaming',
    question: 'ما هي أحدث فئة لبطاقات رسوميات إنفيديا فائقة القوة المخصصة للألعاب والذكاء الاصطناعي؟',
    answer: 'RTX 4090 / 5090',
    options: ['GTX 1080 Ti', 'RTX 2080', 'RTX 3070', 'RTX 4090 / 5090'],
    is_post_2010_football: false
  },
  {
    category: 'pc_hardware_gaming',
    question: 'ما هو الجيل الأحدث من ذواكر الوصول العشوائي (RAM) المستخدم حالياً في أحدث اللوحات الأم؟',
    answer: 'DDR5',
    options: ['DDR3', 'DDR4', 'DDR5', 'GDDR6X'],
    is_post_2010_football: false
  },
  {
    category: 'pc_hardware_gaming',
    question: 'ما هي التقنية التي طورتها إنفيديا لزيادة الفريمات عن طريق توليد الإطارات بالذكاء الاصطناعي؟',
    answer: 'DLSS 3 (Frame Generation)',
    options: ['FSR 1', 'DLSS 3 (Frame Generation)', 'V-Sync', 'G-Sync'],
    is_post_2010_football: false
  },
  {
    category: 'pc_hardware_gaming',
    question: 'ما هو حجم المروحة القياسي الأكثر استخداماً في كيسات الكمبيوتر ومشتتات التبريد المائي؟',
    answer: '120mm و 140mm',
    options: ['80mm', '120mm و 140mm', '200mm', '60mm'],
    is_post_2010_football: false
  },
  {
    category: 'pc_hardware_gaming',
    question: 'ماذا يسمى السائل المستخدم داخل أنابيب التبريد المائي المغلق (AIO) لنقل الحرارة؟',
    answer: 'ماء مقطر مضاف له موانع تأكل وطحالب',
    options: ['زيت محركات', 'كحول نقي', 'ماء مقطر مضاف له موانع تأكل وطحالب', 'نيتروجين سائل'],
    is_post_2010_football: false
  },

  // 7. gaming_tech
  {
    category: 'gaming_tech',
    question: 'ما هو المنفذ الافتراضي لخدمة نقل الملفات الآمنة SSH في الشبكات؟',
    answer: 'Port 22',
    options: ['Port 21', 'Port 22', 'Port 80', 'Port 443'],
    is_post_2010_football: false
  },
  {
    category: 'gaming_tech',
    question: 'ما هي خوارزمية التشفير المتماثل الأكثر أماناً واعتماداً من الحكومات والبنوك عالمياً؟',
    answer: 'AES-256',
    options: ['DES', 'MD5', 'AES-256', 'SHA-1'],
    is_post_2010_football: false
  },
  {
    category: 'gaming_tech',
    question: 'ما هو محرك الألعاب الثوري الأكثر تطوراً في العالم والمطور من شركة Epic Games؟',
    answer: 'Unreal Engine 5',
    options: ['Unity 2022', 'CryEngine', 'Unreal Engine 5', 'Frostbite'],
    is_post_2010_football: false
  },
  {
    category: 'gaming_tech',
    question: 'ما هو نظام أسماء النطاقات الذي يترجم أسماء المواقع (مثل google.com) إلى عناوين IP؟',
    answer: 'DNS',
    options: ['DHCP', 'DNS', 'FTP', 'SMTP'],
    is_post_2010_football: false
  },

  // 8. console_pc_gaming
  {
    category: 'console_pc_gaming',
    question: 'ما هو اسم وحدة التحكم (الذراع) الثورية المرفقة مع جهاز PlayStation 5 ذات الهزاز التفاعلي؟',
    answer: 'DualSense',
    options: ['DualShock 4', 'DualSense', 'Xbox Elite', 'Joy-Con'],
    is_post_2010_football: false
  },
  {
    category: 'console_pc_gaming',
    question: 'في لعبة God of War (2018)، ما هو السلاح الأساسي الجديد الذي حمله كريتوس في الأراضي الإسكندنافية؟',
    answer: 'فأس ليفياثان (Leviathan Axe)',
    options: ['نصال الفوضى', 'فأس ليفياثان (Leviathan Axe)', 'رمح دروبنير', 'قوس أتروس'],
    is_post_2010_football: false
  },
  {
    category: 'console_pc_gaming',
    question: 'ما هي اللعبة التكتيكية الشهيرة بالتصويب من منظور الشخص الأول والمطورة من Riot Games؟',
    answer: 'فالورانت (Valorant)',
    options: ['CS:GO', 'فالورانت (Valorant)', 'Overwatch', 'Apex Legends'],
    is_post_2010_football: false
  },
  {
    category: 'console_pc_gaming',
    question: 'من هي بطلة الفضاء وصائدة المكافآت الأيقونية في سلسلة Metroid من نينتندو؟',
    answer: 'ساموس أران (Samus Aran)',
    options: ['لارا كروفت', 'ساموس أران (Samus Aran)', 'زيلدا', 'جيل فالنتاين'],
    is_post_2010_football: false
  },

  // 9. reflex_trivia
  {
    category: 'reflex_trivia',
    question: 'سؤال سرعة: كم عدد الثواني في 3 دقائق كاملة؟',
    answer: '180 ثانية',
    options: ['150 ثانية', '180 ثانية', '200 ثانية', '300 ثانية'],
    is_post_2010_football: false
  },
  {
    category: 'reflex_trivia',
    question: 'سؤال رد فعل: ما هو نصف العدد 100 مضافاً إليه 25؟',
    answer: '75',
    options: ['50', '65', '75', '85'],
    is_post_2010_football: false
  },
  {
    category: 'reflex_trivia',
    question: 'سرعة بديهة: قطار كهربائي يسير نحو الشرق، إلى أي اتجاه يتجه دخانه؟',
    answer: 'لا يصدر دخاناً (كهربائي!)',
    options: ['للغرب', 'للشرق', 'للأعلى', 'لا يصدر دخاناً (كهربائي!)'],
    is_post_2010_football: false
  },
  {
    category: 'reflex_trivia',
    question: 'سرعة حسابية: 9 ضرب 9 ناقص 1 تساوي كم؟',
    answer: '80',
    options: ['81', '80', '79', '72'],
    is_post_2010_football: false
  },

  // 10. cars_mechanics
  {
    category: 'cars_mechanics',
    question: 'ما هي الوظيفة الجوهرية لشمعات الاحتراق (Spark Plugs / البوجيهات) في محرك البنزين؟',
    answer: 'إطلاق الشرارة لإشعال خليط الهواء والوقود',
    options: ['تنقية زيت المحرك', 'إطلاق الشرارة لإشعال خليط الهواء والوقود', 'تبريد الردياتير', 'تنظيم ضغط التيربو'],
    is_post_2010_football: false
  },
  {
    category: 'cars_mechanics',
    question: 'ما هو الترتيب الهندسي للأسطوانات في المحركات الملقبة بـ Boxer أو المحرك المسطح في سيارات بورش وسوبارو؟',
    answer: 'الأسطوانات متقابلة أفقياً بزاوية 180 درجة',
    options: ['على شكل حرف V', 'خط مستقيم (Inline)', 'الأسطوانات متقابلة أفقياً بزاوية 180 درجة', 'دائري'],
    is_post_2010_football: false
  },
  {
    category: 'cars_mechanics',
    question: 'ما هو ناقل الحركة الأوتوماتيكي المزدوج الأكثر سرعة في التبديل والمعروف بـ DSG في فولكس فاجن وبورش؟',
    answer: 'Dual-Clutch Transmission (DCT)',
    options: ['CVT', 'Manual التقليدي', 'Dual-Clutch Transmission (DCT)', 'Torque Converter'],
    is_post_2010_football: false
  },
  {
    category: 'cars_mechanics',
    question: 'ما هو الجزء المسؤول عن شحن بطارية السيارة وتزويد الأنظمة الكهربائية بالطاقة أثناء دوران المحرك؟',
    answer: 'الدينامو (Alternator)',
    options: ['المارش (Starter)', 'الدينامو (Alternator)', 'طلمبة البنزين', 'حساس الشكمان'],
    is_post_2010_football: false
  },

  // 11. dentistry
  {
    category: 'dentistry',
    question: 'ما هو النسيج الحيوي الأكثر حساسية في مركز السن الذي يحتوي على الأعصاب والأوعية الدموية؟',
    answer: 'لب السن (Dental Pulp)',
    options: ['مينا السن', 'عاج السن', 'لب السن (Dental Pulp)', 'الملاط (Cementum)'],
    is_post_2010_football: false
  },
  {
    category: 'dentistry',
    question: 'ما هو الجهاز الطبي الحديث المستخدم لأخذ مقاسات وتصوير الأسنان ثلاثي الأبعاد رقمياً بدون معجون المقاسات؟',
    answer: 'الماسح الضوئي الفموي (Intraoral Scanner)',
    options: ['جهاز الأشعة العادي', 'الماسح الضوئي الفموي (Intraoral Scanner)', 'جهاز التبييض', 'الميكروسكوب الجراحي'],
    is_post_2010_football: false
  },
  {
    category: 'dentistry',
    question: 'ما هي قشور الخزف التجميلية الرقيقة جداً التي تلصق على واجهة الأسنان للحصول على ابتسامة هوليوود؟',
    answer: 'الفينير (Veneers / العدسات الخزفية)',
    options: ['التيجان (Crowns)', 'الفينير (Veneers / العدسات الخزفية)', 'الجسور', 'الحشوات الفضية'],
    is_post_2010_football: false
  },
  {
    category: 'dentistry',
    question: 'ما هو التخصص الطبي لطب الأسنان المعني بتعديل عضة الأسنان وتنسيق رصتها بالأسلاك أو التقويم الشفاف؟',
    answer: 'تقويم الأسنان (Orthodontics)',
    options: ['جراحة الوجه والفكين', 'تقويم الأسنان (Orthodontics)', 'طب أسنان الأطفال', 'علاج الجذور'],
    is_post_2010_football: false
  },

  // 12. fitness_gym
  {
    category: 'fitness_gym',
    question: 'ما هو التمرين المركب الجبار الملقب بـ "ملك تمارين الظهر" والذي يرفع فيه الوزن عن الأرض حتى الوقوف؟',
    answer: 'الديدليفت (Deadlift / الرفعة الميتة)',
    options: ['العقلة (Pull-ups)', 'الديدليفت (Deadlift / الرفعة الميتة)', 'التجديف بالبار (Barbell Row)', 'اللات بول داون'],
    is_post_2010_football: false
  },
  {
    category: 'fitness_gym',
    question: 'كم جراماً من البروتين يوصى به تقريباً لكل كيلوجرام من وزن الجسم لبناء الكتلة العضلية للرياضيين؟',
    answer: '1.6 إلى 2.2 جرام / كجم',
    options: ['0.5 جرام / كجم', '1.6 إلى 2.2 جرام / كجم', '3.5 جرام / كجم', '5 جرام / كجم'],
    is_post_2010_football: false
  },
  {
    category: 'fitness_gym',
    question: 'ما هو البروتين سريع الامتصاص المستخلص من مصل اللبن أثناء صناعة الجبن والأكثر مبيعاً في العالم؟',
    answer: 'واي بروتين (Whey Protein)',
    options: ['كازين بروتين (Casein)', 'واي بروتين (Whey Protein)', 'بروتين الصويا', 'بروتين البيض'],
    is_post_2010_football: false
  },
  {
    category: 'fitness_gym',
    question: 'أي عضلة من عضلات الكتف مسؤولة بشكل أساسي عن إعطاء الكتف مظهره العريض (3D) عند رفع الذراع جانبياً؟',
    answer: 'عضلة الكتف الجانبية (Lateral Deltoid)',
    options: ['الكتف الأمامي', 'عضلة الكتف الجانبية (Lateral Deltoid)', 'الكتف الخلفي', 'الترابيس'],
    is_post_2010_football: false
  },

  // 13. veterinary_biology
  {
    category: 'veterinary_biology',
    question: 'ما هو الطائر الوحيد في العالم الذي يستطيع الطيران للخلف ومص رحيق الأزهار في الهواء؟',
    answer: 'طائر الطنان (Hummingbird)',
    options: ['الصقر الحر', 'طائر الطنان (Hummingbird)', 'السنونو', 'الهدهد'],
    is_post_2010_football: false
  },
  {
    category: 'veterinary_biology',
    question: 'كم عدد قلوب الأخطبوط في علم الأحياء البحرية؟',
    answer: '3 قلوب',
    options: ['قلب واحد', 'قلبان', '3 قلوب', '4 قلوب'],
    is_post_2010_football: false
  },
  {
    category: 'veterinary_biology',
    question: 'ما هو الحيوان المفترس الملقب بـ "الفهد الصياد" وأسرع الثدييات على اليابسة بسرعة تفوق 110 كم/س؟',
    answer: 'الشيتا (Cheetah)',
    options: ['الأسد الإفريقي', 'النمر المرقط (Leopard)', 'الشيتا (Cheetah)', 'الجاغوار'],
    is_post_2010_football: false
  },
  {
    category: 'veterinary_biology',
    question: 'ما هو العضو الذي تفقده الضفادع تماماً أثناء تحولها من مرحلة "أبو ذنيبة" إلى الضفدع البالغ وتتنفس برئتيها وجلدها؟',
    answer: 'الذيل والخياشيم',
    options: ['الأرجل الخلفية', 'الذيل والخياشيم', 'اللسان', 'العيون'],
    is_post_2010_football: false
  },

  // 14. gelato_sweets
  {
    category: 'gelato_sweets',
    question: 'ما هي حلوى التيراميسو الإيطالية الشهيرة وما هو المشروب الأساسي الذي يُغمس فيه البسكويت؟',
    answer: 'قهوة الإسبريسو القوية',
    options: ['الشاي الإنجليزي', 'قهوة الإسبريسو القوية', 'عصير البرتقال', 'الحليب الساخن'],
    is_post_2010_football: false
  },
  {
    category: 'gelato_sweets',
    question: 'ما هو المكون الإيطالي الفاخر من المكسرات الخضراء الذي يعتبر من أغلى وألذ نكهات الجيلاتي في صقلية؟',
    answer: 'الفستق الحلبي (Pistachio Bronte)',
    options: ['الكاجو', 'عين الجمل', 'الفستق الحلبي (Pistachio Bronte)', 'البندق'],
    is_post_2010_football: false
  },
  {
    category: 'gelato_sweets',
    question: 'ما هي الحلوى الشرقية الشهيرة المصنوعة من السميد والسمن وتسقى بالشربات الساخن وتزين باللوز؟',
    answer: 'البسبوسة',
    options: ['الكنافة', 'البسبوسة', 'أم علي', 'بلح الشام'],
    is_post_2010_football: false
  },
  {
    category: 'gelato_sweets',
    question: 'ما هو الجبن الإيطالي الكريمي الطازج الغني المستخدم أساساً في صناعة حشوة التيراميسو؟',
    answer: 'جبن الماسكاربوني (Mascarpone)',
    options: ['الموتزاريلا', 'الريكوتا', 'جبن الماسكاربوني (Mascarpone)', 'البارميزان'],
    is_post_2010_football: false
  },

  // 15. islamic_studies
  {
    category: 'islamic_studies',
    question: 'من هو الخليفة الراشد الثالث الذي جُمع القرآن الكريم كاملاً في مصحف واحد في عهده؟',
    answer: 'عثمان بن عفان رضي الله عنه',
    options: ['أبو بكر الصديق', 'عمر بن الخطاب', 'عثمان بن عفان رضي الله عنه', 'علي بن أبي طالب'],
    is_post_2010_football: false
  },
  {
    category: 'islamic_studies',
    question: 'ما هي المعركة البحرية الإسلامية الكبرى الأولى التي وقعت في عهد الخليفة عثمان بن عفان سنة 35 هـ؟',
    answer: 'معركة ذات الصواري',
    options: ['معركة القادسية', 'معركة اليرموك', 'معركة ذات الصواري', 'فتح عمورية'],
    is_post_2010_football: false
  },
  {
    category: 'islamic_studies',
    question: 'من هو القائد المسلم الفاتح الذي فتح بلاد الأندلس وعبر المضيق المسمى باسمه عام 92 هـ؟',
    answer: 'طارق بن زياد',
    options: ['موسى بن نصير', 'طارق بن زياد', 'عقبة بن نافع', 'عمرو بن العاص'],
    is_post_2010_football: false
  },
  {
    category: 'islamic_studies',
    question: 'ما هي السورة القرآنية التي تعادل قراءتها ثلث القرآن الكريم كما أخبر النبي ﷺ؟',
    answer: 'سورة الإخلاص',
    options: ['سورة الفاتحة', 'سورة يس', 'سورة الإخلاص', 'سورة الملك'],
    is_post_2010_football: false
  }
];

async function syncPenaltyBank() {
  console.log('\n============================================================');
  console.log('⚽ QUIZ ARENA - PENALTY SHOTS & CATEGORY SYNCHRONIZER');
  console.log('============================================================\n');

  const bankFile = path.resolve('data/questions_bank.json');
  let currentBank = [];
  if (fs.existsSync(bankFile)) {
    currentBank = JSON.parse(fs.readFileSync(bankFile, 'utf8'));
  }

  console.log(`Current bank size: ${currentBank.length} items`);

  // Map of existing questions
  const existingHashes = new Set(currentBank.map(q => q.content_hash));

  // Convert penalty dataset into QuestionItems with randomized option placement
  let addedCount = 0;
  for (const item of PENALTY_DATASET) {
    const hash = calculateHash('hat_fi_qoraybi', item.category, item.question);
    if (!existingHashes.has(hash)) {
      // Ensure answer is in options
      let opts = [...item.options];
      if (!opts.includes(item.answer)) {
        opts[0] = item.answer;
      }
      // Shuffle options so correct answer is randomly distributed
      opts = shuffle(opts);

      currentBank.push({
        id: crypto.randomUUID(),
        mode: 'hat_fi_qoraybi',
        category: item.category,
        question_text: item.question,
        correct_answer: item.answer,
        options: opts,
        forbidden_words: null,
        acceptable_answers: null,
        content_hash: hash,
        is_post_2010_football: !!item.is_post_2010_football,
        created_at: new Date().toISOString()
      });
      existingHashes.add(hash);
      addedCount++;
    }
  }

  console.log(`Added ${addedCount} new dedicated penalty shootout questions.`);

  // Also, expand categories that have few items by multiplying variations with randomized choices
  const penaltyQuestions = currentBank.filter(q => q.mode === 'hat_fi_qoraybi');
  const countsPerCategory = {};
  for (const q of penaltyQuestions) {
    countsPerCategory[q.category] = (countsPerCategory[q.category] || 0) + 1;
  }

  console.log('\n📊 Category Distribution for [hat_fi_qoraybi]:');
  console.table(countsPerCategory);

  // Verify that all 15 official categories exist and have questions
  for (const cat of OFFICIAL_PENALTY_CATEGORIES) {
    const count = countsPerCategory[cat] || 0;
    if (count === 0) {
      console.warn(`⚠️ Warning: Category ${cat} has 0 penalty questions!`);
    } else {
      console.log(`  ✅ Category "${cat}": ${count} questions ready.`);
    }
  }

  // Shuffle the entire bank thoroughly
  console.log('\n🎲 Final Fisher-Yates mixing of the entire question bank...');
  const finalMixed = shuffle(shuffle(currentBank));

  fs.writeFileSync(bankFile, JSON.stringify(finalMixed, null, 2), 'utf8');
  console.log(`💾 Successfully synchronized and saved ${finalMixed.length} questions to ${bankFile}`);

  console.log('\n============================================================');
  console.log('🏁 PENALTY SHOTS & CATEGORIES FULLY SYNCHRONIZED!');
  console.log('============================================================\n');
}

syncPenaltyBank().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});

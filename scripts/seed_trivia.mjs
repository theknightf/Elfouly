import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const SEED_DATA = [
  // ==========================================
  // MODE: one_two_bank (1 تو)
  // ==========================================
  // 1. General Knowledge & Egyptian Party Trivia (Fares, Ziad, Eyad)
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'أكمل المثل الشعبي الشهير: "اقلب القدرة على فمها تطلع..."؟',
    correct_answer: 'البنت لأمها',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'ما هو أطول نهر في العالم ويمر بجمهورية مصر العربية؟',
    correct_answer: 'نهر النيل',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'أكمل المثل الشعبي: "اللي اختشوا..."؟',
    correct_answer: 'ماتوا',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'ما هو المعدن الوحيد الذي يتواجد في الحالة السائلة في درجة حرارة الغرفة الطبيعية؟',
    correct_answer: 'الزئبق',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'general_knowledge',
    question_text: 'ما هي الأكلة الشعبية المصرية المكونة من مكرونة وأرز وعدس وبصل محمر وصلصة ودقة؟',
    correct_answer: 'الكشري',
    is_post_2010_football: false
  },

  // 2. Barcelona Football (POST-2010 ONLY - Fares, El-Touny, Eyad)
  {
    mode: 'one_two_bank',
    category: 'barcelona_post_2010',
    question_text: 'في نهائي دوري أبطال أوروبا 2011 في ويمبلي، من كان ثلاثي هجوم برشلونة (MVP) الذين سجلوا ثلاثية الفوز أمام مانشستر يونايتد؟',
    correct_answer: 'ميسي، فيا، وبيدرو',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'barcelona_post_2010',
    question_text: 'في ريمونتادا برشلونة التاريخية 6-1 أمام باريس سان جيرمان عام 2017، من أحرز هدف التأهل القاتل في الدقيقة 95؟',
    correct_answer: 'سيرجي روبيرتو',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'barcelona_post_2010',
    question_text: 'من كان مدرب برشلونة الذي حقق الثلاثية التاريخية الثانية للنادي في موسم 2014-2015؟',
    correct_answer: 'لويس إنريكي',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'barcelona_post_2010',
    question_text: 'كم هدفاً سجل الأسطورة ليونيل ميسي في سنة 2012 الميلادية ليكسر الرقم القياسي العالمي لجيرد مولر؟',
    correct_answer: '91 هدفاً',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'barcelona_post_2010',
    question_text: 'في نهائي دوري أبطال أوروبا 2015 ببرلين، من سجل الهدف الثالث لبرشلونة أمام يوفنتوس في آخر هجمة بالمباراة؟',
    correct_answer: 'نيمار دا سيلفا',
    is_post_2010_football: true
  },

  // 3. Capitals & Flags (Fares)
  {
    mode: 'one_two_bank',
    category: 'capitals_and_flags',
    question_text: 'ما هي عاصمة أستراليا الفيدرالية الرسمية؟',
    correct_answer: 'كانبرا',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'capitals_and_flags',
    question_text: 'الدولة الوحيدة في العالم التي لا يتخذ علمها شكلاً رباعي الأضلاع هي:',
    correct_answer: 'نيبال',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'capitals_and_flags',
    question_text: 'ما هي عاصمة كندا؟',
    correct_answer: 'أوتاوا',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'capitals_and_flags',
    question_text: 'ما هي الدولة التي يحتوي علمها على صورة ورقة شجر القيقب الحمراء؟',
    correct_answer: 'كندا',
    is_post_2010_football: false
  },

  // 4. Veterinary & Biology (El-Touny, Khaled)
  {
    mode: 'one_two_bank',
    category: 'veterinary_biology',
    question_text: 'كم عدد الحجرات في معدة الحيوانات المجترة مثل الأبقار والأغنام؟',
    correct_answer: '4 حجرات',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'veterinary_biology',
    question_text: 'ما هو العضو الداخلي الوحيد القادر على تجديد خلاياه وإعادة بناء نفسه إذا استُؤصل جزء منه؟',
    correct_answer: 'الكبد',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'veterinary_biology',
    question_text: 'الحيوان الذي يملك أكبر عيون مقارنة بحجم جسمه بين جميع الكائنات الحية هو:',
    correct_answer: 'الحبار العملاق',
    is_post_2010_football: false
  },

  // 5. Gelato & Desserts (El-Touny)
  {
    mode: 'one_two_bank',
    category: 'gelato_and_desserts',
    question_text: 'ما هو الفارق الجوهري بين الجيلاتي الإيطالي والآيس كريم الأمريكي التقليدي؟',
    correct_answer: 'نسبة هواء ودهون زبدية أقل في الجيلاتي',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'gelato_and_desserts',
    question_text: 'حلوى التيراميسو الإيطالية الشهيرة تُصنع أساساً باستخدام بسكويت يُعرف بـ:',
    correct_answer: 'ليدي فينجرز (Savoiardi)',
    is_post_2010_football: false
  },

  // 6. Al Ahly & African Football (POST-2010 ONLY - El-Touny, Khaled, Eyad)
  {
    mode: 'one_two_bank',
    category: 'ahly_post_2010',
    question_text: 'في نهائي القرن الأفريقي 2020، في أي دقيقة سجل محمد مجدي قفشة هدفه التاريخي الشهير "القاضية ممكن"؟',
    correct_answer: 'الدقيقة 85 (85:45)',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'ahly_post_2010',
    question_text: 'في كأس العالم للأندية 2021 في قطر، حصد الأهلي الميدالية البرونزية بعد الفوز بركلات الترجيح على أي بطل لاتيني؟',
    correct_answer: 'بالميراس البرازيلي',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'ahly_post_2010',
    question_text: 'من سجل هدف فوز الأهلي برأسية ذهبية في نهائي دوري أبطال أفريقيا 2023 أمام الوداد في مركب محمد الخامس بالدار البيضاء؟',
    correct_answer: 'محمد عبد المنعم',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'ahly_post_2010',
    question_text: 'من كان المدير الفني السويسري الذي قاد الأهلي لاكتساح بطولات موسم 2022-2023 والتتويج بالخماسية التاريخية؟',
    correct_answer: 'مارسيل كولر',
    is_post_2010_football: true
  },

  // 7. PC Hardware Assembly (Khaled)
  {
    mode: 'one_two_bank',
    category: 'pc_hardware',
    question_text: 'ما هي المادة التي توضع بين المعالج (CPU) ومشتت التبريد لملء الفراغات الميكروسكوبية؟',
    correct_answer: 'المعجون الحراري (Thermal Paste)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'pc_hardware',
    question_text: 'أي نوع من وحدات التخزين هو الأسرع حالياً في سرعة القراءة المتتابعة التي تتجاوز 14,000 ميجابايت/ث؟',
    correct_answer: 'PCIe Gen 5 NVMe M.2 SSD',
    is_post_2010_football: false
  },

  // 8. Foreign TV Series / Breaking Bad (Khaled, Ziad)
  {
    mode: 'one_two_bank',
    category: 'foreign_tv_series',
    question_text: 'في مسلسل Breaking Bad، ما هو الاسم المستعار الذي اتخذه والتر وايت في عالم الجريمة؟',
    correct_answer: 'هايزنبرغ (Heisenberg)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'foreign_tv_series',
    question_text: 'ما هو اسم سلسلة مطاعم الدجاج المقلي الشهيرة التي كان يديرها غاس فرينغ كواجهة لعملياته؟',
    correct_answer: 'Los Pollos Hermanos',
    is_post_2010_football: false
  },

  // 9. Real Madrid (POST-2010 ONLY - Khaled, Ziad)
  {
    mode: 'one_two_bank',
    category: 'real_madrid_post_2010',
    question_text: 'في نهائي العاشرة التاريخي 2014، في أي دقيقة أحرز سيرجيو راموس رأسية التعادل القاتلة أمام أتلتيكو مدريد؟',
    correct_answer: 'الدقيقة 92:48 (93)',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'real_madrid_post_2010',
    question_text: 'من كان مدرب ريال مدريد الذي حقق إنجاز الثلاثية المتتالية في دوري أبطال أوروبا (2016، 2017، 2018)؟',
    correct_answer: 'زين الدين زيدان',
    is_post_2010_football: true
  },
  {
    mode: 'one_two_bank',
    category: 'real_madrid_post_2010',
    question_text: 'من سجل هدف فوز ريال مدريد بلقب دوري أبطال أوروبا الرابع عشر أمام ليفربول في نهائي باريس 2022؟',
    correct_answer: 'فينيسيوس جونيور',
    is_post_2010_football: true
  },

  // 10. Cybersecurity & Networks (Eyad)
  {
    mode: 'one_two_bank',
    category: 'cybersecurity',
    question_text: 'ما هو الهجوم الذي يقوم فيه المهاجم بإغراق الخادم بسيل هائل من الطلبات الوهمية لإخراجه عن الخدمة؟',
    correct_answer: 'هجوم حجب الخدمة الموزع (DDoS)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'cybersecurity',
    question_text: 'ما هو رقم المنفذ الافتراضي (Port) المستخدم لبروتوكول الويب الآمن والمشفر HTTPS؟',
    correct_answer: 'Port 443',
    is_post_2010_football: false
  },

  // 11. Health Sciences & Lab (Mazen)
  {
    mode: 'one_two_bank',
    category: 'health_sciences_lab',
    question_text: 'ما هو الاسم العلمي الشائع للتحليل المعملي المختصر بـ CBC؟',
    correct_answer: 'صورة الدم الكاملة (Complete Blood Count)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'health_sciences_lab',
    question_text: 'ما هو الجهاز المعملي الذي يدور بآلاف الدورات في الدقيقة لفصل البلازما عن كرات الدم؟',
    correct_answer: 'جهاز الطرد المركزي (Centrifuge)',
    is_post_2010_football: false
  },

  // 12. Dentistry (Ali Turbo)
  {
    mode: 'one_two_bank',
    category: 'dentistry',
    question_text: 'ما هي أصلب مادة في جسم الإنسان بالكامل (أصلب حتى من العظام)؟',
    correct_answer: 'مينا الأسنان (Enamel)',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'dentistry',
    question_text: 'كم عدد الأسنان الدائمة لدى الإنسان البالغ مكتمل النمو شاملة ضروس العقل؟',
    correct_answer: '32 سناً',
    is_post_2010_football: false
  },

  // 13. Cars & Mechanics (Ali Turbo)
  {
    mode: 'one_two_bank',
    category: 'cars_and_engine_mechanics',
    question_text: 'ما هي الوظيفة الأساسية للشاحن التوربيني (Turbocharger) في محرك السيارة؟',
    correct_answer: 'ضغط الهواء الداخل لغرفة الاحتراق لزيادة القوة الحصانية',
    is_post_2010_football: false
  },
  {
    mode: 'one_two_bank',
    category: 'cars_and_engine_mechanics',
    question_text: 'ماذا يرمز حرف V في محركات السيارات الشهيرة مثل V6 أو V8؟',
    correct_answer: 'ترتيب أسطوانات المحرك على شكل زاوية V',
    is_post_2010_football: false
  },

  // ==========================================
  // MODE: edini_fi_seri (اديني في سري)
  // ==========================================
  {
    mode: 'edini_fi_seri',
    category: 'egyptian_culture',
    question_text: 'كشري',
    correct_answer: 'كشري',
    forbidden_words: ['عدس', 'صلصة', 'مكرونة', 'دقة'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'football_legends_post_2010',
    question_text: 'ليونيل ميسي',
    correct_answer: 'ليونيل ميسي',
    forbidden_words: ['أرجنتين', 'قطر', 'كرة ذهبية', 'رونالدو'],
    is_post_2010_football: true
  },
  {
    mode: 'edini_fi_seri',
    category: 'foreign_tv_series',
    question_text: 'بريكينج باد (Breaking Bad)',
    correct_answer: 'بريكينج باد (Breaking Bad)',
    forbidden_words: ['والتر وايت', 'هايزنبرغ', 'كيمياء', 'مخدرات'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'tech_networking',
    question_text: 'واي فاي (Wi-Fi)',
    correct_answer: 'واي فاي (Wi-Fi)',
    forbidden_words: ['راوتر', 'إنترنت', 'باسورد', 'سلك'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'cars_and_engine_mechanics',
    question_text: 'توربو (Turbo)',
    correct_answer: 'توربو (Turbo)',
    forbidden_words: ['محرك', 'سرعة', 'هواء', 'سيارة'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'ahly_post_2010',
    question_text: 'محمد مجدي قفشة',
    correct_answer: 'محمد مجدي قفشة',
    forbidden_words: ['القاضية', 'الأهلي', 'زمالك', 'نهائي'],
    is_post_2010_football: true
  },
  {
    mode: 'edini_fi_seri',
    category: 'dentistry',
    question_text: 'ضرس العقل',
    correct_answer: 'ضرس العقل',
    forbidden_words: ['خلع', 'فك', 'ألم', 'أخير'],
    is_post_2010_football: false
  },
  {
    mode: 'edini_fi_seri',
    category: 'gaming_consoles',
    question_text: 'بلايستيشن 5 (PlayStation 5)',
    correct_answer: 'بلايستيشن 5 (PlayStation 5)',
    forbidden_words: ['سوني', 'ذراع', 'كونسول', 'فيفا'],
    is_post_2010_football: false
  },

  // ==========================================
  // MODE: hat_fi_qoraybi (حط في قريبي - Penalty 1v1)
  // ==========================================
  {
    mode: 'hat_fi_qoraybi',
    category: 'barcelona_post_2010',
    question_text: 'من فاز بجائزة هداف الدوري الإسباني (البيتشيتشي) مع برشلونة في موسم 2015-2016 برصيد 40 هدفاً؟',
    options: ['ليونيل ميسي', 'لويس سواريز', 'نيمار', 'دافيد فيا'],
    correct_answer: 'لويس سواريز',
    is_post_2010_football: true
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'real_madrid_post_2010',
    question_text: 'في نهائي دوري أبطال أوروبا 2018 في كييف، من سجل الهدف الأكروباتي الدبل-كيك التاريخي لريال مدريد؟',
    options: ['كريستيانو رونالدو', 'غاريث بيل', 'كريم بنزيما', 'مارسيلو'],
    correct_answer: 'غاريث بيل',
    is_post_2010_football: true
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'capitals_and_flags',
    question_text: 'ما هي عاصمة اليابان الحالية؟',
    options: ['كيوتو', 'أوساكا', 'طوكيو', 'يوكوهاما'],
    correct_answer: 'طوكيو',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'pc_hardware',
    question_text: 'ما هي الشركة المصنعة لمعالجات Ryzen ومعالجات Threadripper؟',
    options: ['Intel', 'AMD', 'Nvidia', 'Qualcomm'],
    correct_answer: 'AMD',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'cybersecurity',
    question_text: 'ماذا تسمى البرمجيات الخبيثة التي تشفر ملفات النظام وتطلب فدية لفك التشفير؟',
    options: ['Spyware', 'Ransomware (برامج الفدية)', 'Adware', 'Trojan Horse'],
    correct_answer: 'Ransomware (برامج الفدية)',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'cars_and_engine_mechanics',
    question_text: 'ما هي العلامة الإيطالية للسيارات الخارقة التي تتخذ علامتها التجارية رمز الثور الهائج؟',
    options: ['فيراري', 'لامبورغيني', 'مازيراتي', 'بوغاتي'],
    correct_answer: 'لامبورغيني',
    is_post_2010_football: false
  },
  {
    mode: 'hat_fi_qoraybi',
    category: 'dentistry',
    question_text: 'ما هو المعدن الطبيعي الذي يُضاف لمعجون الأسنان ومياه الشرب لمقاومة تسوس الأسنان؟',
    options: ['الكالسيوم', 'الفلورايد (Fluoride)', 'المغنيسيوم', 'الزنك'],
    correct_answer: 'الفلورايد (Fluoride)',
    is_post_2010_football: false
  },

  // ==========================================
  // MODE: meen_yezawwed (مين يزوّد - Blind Auction)
  // ==========================================
  {
    mode: 'meen_yezawwed',
    category: 'european_champions_post_2010',
    question_text: 'أندية فازت بدوري أبطال أوروبا في الفترة من 2010 حتى 2024',
    acceptable_answers: [
      'إنتر ميلان (2010)',
      'برشلونة (2011، 2015)',
      'تشيلسي (2012، 2021)',
      'بايرن ميونخ (2013، 2020)',
      'ريال مدريد (2014، 2016، 2017، 2018، 2022، 2024)',
      'ليفربول (2019)',
      'مانشستر سيتي (2023)'
    ],
    is_post_2010_football: true
  },
  {
    mode: 'meen_yezawwed',
    category: 'capitals_and_flags',
    question_text: 'عواصم دول عربية في قارتي آسيا وأفريقيا',
    acceptable_answers: [
      'القاهرة', 'الرياض', 'أبوظبي', 'الدوحة', 'الكويت', 'المنامة', 'مسقط',
      'بغداد', 'دمشق', 'بيروت', 'عمان', 'القدس', 'صنعاء', 'طرابلس',
      'تونس', 'الجزائر', 'الرباط', 'نواكشوط', 'الخرطوم', 'مقديشو', 'جيبوتي'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'cars_and_engine_mechanics',
    question_text: 'ماركات سيارات عالمية معروفة',
    acceptable_answers: [
      'تويوتا', 'مرسيدس', 'بي إم دبليو', 'فيراري', 'بورشه', 'هوندا',
      'نيسان', 'فورد', 'شيفروليه', 'أودي', 'هيونداي', 'كيا',
      'لامبورغيني', 'فولكس فاجن', 'تسلا', 'مازدا', 'ميتسوبيشي', 'بيجو',
      'رينو', 'سوبارو', 'لكزس', 'فولفو', 'لاند روفر', 'جيب'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'general_knowledge',
    question_text: 'أشهر معالم وأماكن تاريخية وسياحية في جمهورية مصر العربية',
    acceptable_answers: [
      'أهرامات الجيزة وأبو الهول', 'برج القاهرة', 'قلعة صلاح الدين الأيوبي', 'خان الخليلي',
      'المتحف المصري الكبير', 'معبد أبو سمبل', 'معبد الكرنك', 'وادي الملوك بالأقصر',
      'معبد فيلة بأسوان', 'السد العالي', 'مكتبة الإسكندرية', 'قلعة قايتباي بالإسكندرية',
      'دير سانت كاترين', 'مسجد محمد علي', 'المتحف القومي للحضارة المصرية'
    ],
    is_post_2010_football: false
  },
  {
    mode: 'meen_yezawwed',
    category: 'foreign_tv_series',
    question_text: 'شخصيات من عالم مسلسلي Breaking Bad و Better Call Saul',
    acceptable_answers: [
      'والتر وايت', 'جيسي بينكمان', 'سول غودمان', 'غاس فرينغ', 'مايك إيرمنتروت',
      'هانك شريدر', 'سكايلر وايت', 'كيم ويكسلر', 'توكو سالامانكا', 'هيكتور سالامانكا',
      'ناتشو فارغا', 'لالو سالامانكا', 'ماري شريدر', 'تود', 'جاك ويلكر'
    ],
    is_post_2010_football: false
  }
];

// Helper hash
export function calculateHash(mode, category, text) {
  const norm = `${mode}_${category}_${text}`.trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(norm, 'utf8').digest('hex');
}

// Strict post-2010 football validation
export function validatePost2010Football(item) {
  if (!item.is_post_2010_football) return true;
  const str = `${item.question_text || ''} ${item.correct_answer || ''} ${JSON.stringify(item.options || [])} ${JSON.stringify(item.acceptable_answers || [])}`;
  // Reject 1900-2009
  const pre2010Match = str.match(/\b(19\d\d|200\d)\b/);
  if (pre2010Match) {
    console.warn(`[Validation Warning] Football question rejected due to pre-2010 year: ${pre2010Match[0]}`);
    return false;
  }
  return true;
}

// Main execution
async function main() {
  console.log('⚡ QUIZ ARENA (ساحة الكويز) - Mass Trivia Ingestion Pipeline');
  console.log(`Processing ${SEED_DATA.length} initial structured trivia records...`);

  const validQuestions = [];
  const hashes = new Set();

  for (const item of SEED_DATA) {
    if (!validatePost2010Football(item)) {
      continue;
    }

    const textToHash = item.question_text || item.correct_answer || '';
    const hash = calculateHash(item.mode, item.category, textToHash);

    if (hashes.has(hash)) {
      continue;
    }
    hashes.add(hash);

    validQuestions.push({
      id: crypto.randomUUID(),
      mode: item.mode,
      category: item.category,
      question_text: item.question_text || null,
      correct_answer: item.correct_answer || null,
      options: item.options || null,
      forbidden_words: item.forbidden_words || null,
      acceptable_answers: item.acceptable_answers || null,
      content_hash: hash,
      is_post_2010_football: !!item.is_post_2010_football,
      created_at: new Date().toISOString()
    });
  }

  // Save to local JSON bank
  const outputJson = path.resolve('data/questions_bank.json');
  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(validQuestions, null, 2), 'utf-8');

  console.log(`✅ Successfully generated & validated ${validQuestions.length} production questions.`);
  console.log(`📁 Saved to: ${outputJson}`);

  // Summary by mode
  const byMode = {};
  for (const q of validQuestions) {
    byMode[q.mode] = (byMode[q.mode] || 0) + 1;
  }
  console.log('Breakdown by Game Mode:', byMode);
}

main().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});

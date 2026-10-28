// Extensive trivia bank tailored to characters and game modes

export const TRIVIA_BANK = [
  // Computer Science & Programming (Fares)
  {
    id: 'cs_1',
    category: 'computer_science',
    categoryName: 'علوم الحاسب والبرمجة',
    question: 'ما هو التعقيد الزمني (Time Complexity) لعملية البحث الثنائي (Binary Search) في مصفوفة مرتبة؟',
    answer: 'O(log n)',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    funFact: 'البحث الثنائي يقلص نطاق البحث إلى النصف في كل خطوة، فلو عندك مليار عنصر بتلاقيه في 30 خطوة بس!'
  },
  {
    id: 'cs_2',
    category: 'computer_science',
    categoryName: 'علوم الحاسب والبرمجة',
    question: 'في لغات البرمجة الحديثة مثل جافاسكريبت، ماذا تُرجع المقارنة: typeof null ؟',
    answer: 'object',
    options: ['undefined', 'null', 'object', 'number'],
    funFact: 'هذا يعتبر أشهر خطأ تاريخي (bug) معتمد في جافاسكريبت منذ نشأتها عام 1995 ولم يُغير للحفاظ على التوافق!'
  },
  {
    id: 'cs_3',
    category: 'computer_science',
    categoryName: 'علوم الحاسب والبرمجة',
    question: 'ما هو البروتوكول المسؤول عن تحويل أسماء النطاقات (مثل google.com) إلى عناوين IP؟',
    answer: 'DNS',
    options: ['DHCP', 'DNS', 'HTTP', 'FTP'],
    funFact: 'الـ DNS هو دليل الهاتف للإنترنت بالكامل، بدونه كان لازم تحفظ أرقام الـ IP لكل موقع بتزوره!'
  },
  {
    id: 'cs_4',
    category: 'computer_science',
    categoryName: 'علوم الحاسب والبرمجة',
    question: 'أي هيكل بيانات (Data Structure) يتبع مبدأ "من يدخل أولاً يخرج أولاً" (FIFO)؟',
    answer: 'الطابور (Queue)',
    options: ['المكدس (Stack)', 'الطابور (Queue)', 'الشجرة (Tree)', 'الرسم البياني (Graph)'],
    funFact: 'طابور الفرن في مصر هو التطبيق العملي المثالي للـ Queue، مين بيقف الأول ياخد العيش الأول!'
  },

  // Barcelona & European Football (Fares, El-Touny, Eyad)
  {
    id: 'barca_1',
    category: 'barcelona_european_football',
    categoryName: 'برشلونة والكرة الأوروبية',
    question: 'من قاد برشلونة للفوز بالثلاثية (الدوري والكأس ودوري الأبطال) في موسم 2014-2015؟',
    answer: 'لويس إنريكي',
    options: ['بيب غوارديولا', 'لويس إنريكي', 'إرنستو فالفيردي', 'تيتو فيلانوفا'],
    funFact: 'لويس إنريكي حقق الثلاثية في أول موسم له مع الفريق الأول، بقيادة ميسي وسواريز ونيمار.',
    is_post_2010_football: true
  },
  {
    id: 'barca_2',
    category: 'barcelona_european_football',
    categoryName: 'برشلونة والكرة الأوروبية',
    question: 'في ريمونتادا برشلونة التاريخية 6-1 أمام باريس سان جيرمان 2017، من سجل هدف التأهل في الدقيقة 95؟',
    answer: 'سيرجي روبيرتو',
    options: ['نيمار', 'ليونيل ميسي', 'سيرجي روبيرتو', 'لويس سواريز'],
    funFact: 'عرضية نيمار الساحرة في آخر ثانية حولها سيرجي روبيرتو بطيران تاريخي هز ملعب الكامب نو!',
    is_post_2010_football: true
  },
  {
    id: 'barca_3',
    category: 'barcelona_european_football',
    categoryName: 'برشلونة والكرة الأوروبية',
    question: 'من سجل هدف برشلونة الأول في نهائي دوري أبطال أوروبا 2015 أمام يوفنتوس؟',
    answer: 'إيفان راكيتيتش',
    options: ['ليونيل ميسي', 'إيفان راكيتيتش', 'لويس سواريز', 'نيمار'],
    funFact: 'راكيتيتش افتتح التسجيل في الدقيقة الرابعة، وانتهى النهائي بفوز برشلونة 3-1.',
    is_post_2010_football: true
  },

  // Capitals & Flags (Fares)
  {
    id: 'cap_1',
    category: 'capitals_and_flags',
    categoryName: 'عواصم وأعلام الدول',
    question: 'ما هي عاصمة أستراليا الفيدرالية الرسمية؟',
    answer: 'كانبرا',
    options: ['سيدني', 'ملبورن', 'كانبرا', 'بريزبان'],
    funFact: 'تم اختيار كانبرا كحل وسط للنزاع التاريخي الشرس بين سيدني وملبورن على من تكون العاصمة!'
  },
  {
    id: 'cap_2',
    category: 'capitals_and_flags',
    categoryName: 'عواصم وأعلام الدول',
    question: 'الدولة الوحيدة في العالم التي لا يتخذ علمها شكلاً رباعي الأضلاع (مستطيل أو مربع) هي:',
    answer: 'نيبال',
    options: ['سويسرا', 'الفاتيكان', 'نيبال', 'بوتان'],
    funFact: 'علم نيبال مكون من مثلثين متداخلين يرمزان إلى قمم جبال الهيمالايا!'
  },
  {
    id: 'cap_3',
    category: 'capitals_and_flags',
    categoryName: 'عواصم وأعلام الدول',
    question: 'ما هي عاصمة كندا؟',
    answer: 'أوتاوا',
    options: ['تورونتو', 'مونتريال', 'فانكوفر', 'أوتاوا'],
    funFact: 'الملكة فيكتوريا هي من اختارت أوتاوا عاصمة لكندا عام 1857 لحمايتها من أي غزو محتمل.'
  },

  // Veterinary & Biology (El-Touny, Khaled)
  {
    id: 'vet_1',
    category: 'veterinary_biology',
    categoryName: 'البيولوجيا والطب البيطري',
    question: 'كم عدد الحجرات في معدة الحيوانات المجترة مثل الأبقار والأغنام؟',
    answer: '4 حجرات',
    options: ['حجرتان', '3 حجرات', '4 حجرات', 'حجرة واحدة'],
    funFact: 'الحجرات الأربع هي: الكرش (Rumen)، القلنسوة (Reticulum)، أم التلافيف (Omasum)، والأنفحة (Abomasum)!'
  },
  {
    id: 'vet_2',
    category: 'veterinary_biology',
    categoryName: 'البيولوجيا والطب البيطري',
    question: 'ما هو العضو الوحيد في جسم الإنسان والحيوان القادر على تجديد خلاياه وإعادة بناء نفسه لو قُطع جزء منه؟',
    answer: 'الكبد',
    options: ['القلب', 'الكبد', 'البنكرياس', 'الطحال'],
    funFact: 'الكبد يمكنه النمو مجدداً حتى لو تم استئصال ما يصل إلى 75% من حجمه!'
  },
  {
    id: 'vet_3',
    category: 'veterinary_biology',
    categoryName: 'البيولوجيا والطب البيطري',
    question: 'الحيوان الذي يملك أكبر عيون مقارنة بحجم جسمه بين كل المخلوقات الحية هو:',
    answer: 'الحبار العملاق',
    options: ['الحوت الأزرق', 'الحبار العملاق', 'البومة', 'النعامة'],
    funFact: 'عين الحبار العملاق قد يصل قطرها إلى 27 سنتيمتراً، بحجم طبق طعام كامل لاصطياد الضوء في أعماق المحيط!'
  },

  // Gelato & Desserts (El-Touny)
  {
    id: 'gelato_1',
    category: 'gelato_and_desserts',
    categoryName: 'الجيلاتي وفنون الحلويات',
    question: 'ما هو الفرق الجوهري الأساسي بين الجيلاتي الإيطالي (Gelato) والآيس كريم الأمريكي التقليدي؟',
    answer: 'نسبة دهون وهواء أقل',
    options: ['الجيلاتي مجمد أكثر', 'نسبة دهون وهواء أقل', 'الجيلاتي يستخدم البيض فقط', 'لا يوجد فرق'],
    funFact: 'الجيلاتي يحتوي على هواء أقل بكثير (Overrun) ونسبة دهن زبدية أقل (4-9% مقارنة بـ 14-25%) مما يمنحه قواماً كثيفاً ونكهة أغنى بكثير!'
  },
  {
    id: 'gelato_2',
    category: 'gelato_and_desserts',
    categoryName: 'الجيلاتي وفنون الحلويات',
    question: 'حلوى التيراميسو الإيطالية الشهيرة تُصنع أساساً باستخدام بسكويت يُعرف بـ:',
    answer: 'ليدي فينجرز (Savoiardi)',
    options: ['بسكويت دايجستف', 'ليدي فينجرز (Savoiardi)', 'أوريو', 'بسكويت الشوفان'],
    funFact: 'اسم Tiramisù في الإيطالية يعني حرفياً "ارفع معنوياتي" أو "شد حيلك" بسبب جرعة القهوة والكاكاو والسكر!'
  },

  // Al Ahly & Real Madrid (El-Barbakh, El-Fondoqy, El-Touny, Eyad)
  {
    id: 'ahly_1',
    category: 'real_madrid_al_ahly',
    categoryName: 'الأهلي وريال مدريد',
    question: 'من فاز بلقب دوري أبطال إفريقيا 2020 في النهائي المصري أمام الزمالك؟',
    answer: 'الأهلي',
    options: ['الزمالك', 'الأهلي', 'الترجي', 'الوداد'],
    funFact: 'حسم الأهلي النهائي بهدف محمد مجدي أفشة في الدقيقة 86 ليحصد اللقب التاسع في تاريخه.',
    is_post_2010_football: true
  },
  {
    id: 'ahly_2',
    category: 'real_madrid_al_ahly',
    categoryName: 'الأهلي وريال مدريد',
    question: 'من سجل هدف ريال مدريد الحاسم في نهائي دوري أبطال أوروبا 2014 أمام أتلتيكو مدريد؟',
    answer: 'غاريث بيل',
    options: ['كريستيانو رونالدو', 'غاريث بيل', 'سيرجيو راموس', 'كريم بنزيما'],
    funFact: 'هدف بيل في الوقت الإضافي منح ريال مدريد التقدم بعد هدف راموس القاتل في الدقيقة 93.',
    is_post_2010_football: true
  },
  {
    id: 'ahly_3',
    category: 'real_madrid_al_ahly',
    categoryName: 'الأهلي وريال مدريد',
    question: 'في نصف نهائي كأس العالم للأندية 2023 بين الأهلي وريال مدريد، من أحرز هدف الأهلي الوحيد؟',
    answer: 'علي معلول',
    options: ['محمد شريف', 'حسين الشحات', 'علي معلول', 'بيرسي تاو'],
    funFact: 'علي معلول وضع ركلة الجزاء ببرود أعصاب معتاد على يمين حارس الميرنجي أندري لونين.',
    is_post_2010_football: true
  },

  // Foreign TV Series (Breaking Bad, etc. - Khaled, El-Fondoqy)
  {
    id: 'bb_1',
    category: 'foreign_tv_series',
    categoryName: 'المسلسلات الأجنبية وBreaking Bad',
    question: 'في مسلسل Breaking Bad، ما هو الاسم المستعار السري الذي اتخذه والتر وايت؟',
    answer: 'هايزنبرغ (Heisenberg)',
    options: ['سول غودمان', 'هايزنبرغ (Heisenberg)', 'غاس فرينغ', 'كابن كوك'],
    funFact: 'اختار الاسم تيمناً بعالم الفيزياء الألماني فرنر هايزنبرغ صاحب مبدأ عدم التأكد في ميكانيكا الكم!'
  },
  {
    id: 'bb_2',
    category: 'foreign_tv_series',
    categoryName: 'المسلسلات الأجنبية وBreaking Bad',
    question: 'ما هو اسم سلسلة مطاعم الدجاج المقلي الشهيرة التي كان يديرها غاس فرينغ كواجهة في Breaking Bad؟',
    answer: 'Los Pollos Hermanos',
    options: ['El Pollo Loco', 'Los Pollos Hermanos', 'Pollos Del Norte', 'Twisters Fast Food'],
    funFact: 'المطعم تم تصويره في مطعم حقيقي بمدينة ألباكيركي اسمه Twisters وما زال يزوره آلاف العشاق سنوياً.'
  },
  {
    id: 'bb_3',
    category: 'foreign_tv_series',
    categoryName: 'المسلسلات الأجنبية وBreaking Bad',
    question: 'في مسلسل Peaky Blinders، ما هي المدينة الإنجليزية التي تدور فيها أحداث العصابة؟',
    answer: 'برمنغهام',
    options: ['لندن', 'مانشستر', 'ليفربول', 'برمنغهام'],
    funFact: 'العصابة كانت تخفي شفرات الحلاقة داخل قبعاتهم لتسديد ضربات مباغتة للخصوم بأمر من توماس شيلبي!'
  },

  // PC Hardware & Hardware Assembly (Khaled)
  {
    id: 'pc_1',
    category: 'pc_hardware_assembly',
    categoryName: 'تجميعات PC وهاردوير',
    question: 'ما هي المادة التي توضع بين المعالج (CPU) ومشتت الحرارة لسد الفراغات الميكروسكوبية؟',
    answer: 'المعجون الحراري (Thermal Paste)',
    options: ['سائل السيليكون', 'المعجون الحراري (Thermal Paste)', 'غراء الإيبوكسي', 'رقاقة ألومنيوم'],
    funFact: 'نقطة صغيرة بحجم حبة البازلاء في منتصف المعالج كافية لتخفيض درجة الحرارة بأكثر من 15 درجة مئوية!'
  },
  {
    id: 'pc_2',
    category: 'pc_hardware_assembly',
    categoryName: 'تجميعات PC وهاردوير',
    question: 'أي نوع من وحدات التخزين التالية هو الأسرع على الإطلاق في سرعة القراءة والكتابة؟',
    answer: 'NVMe M.2 PCIe Gen 5 SSD',
    options: ['HDD SATA', 'SATA SSD 2.5', 'NVMe M.2 PCIe Gen 5 SSD', 'eMMC'],
    funFact: 'سرعات PCIe Gen 5 تصل إلى أكثر من 14,000 ميجابايت في الثانية.. أسرع بـ 100 مرة من الهارد القديم!'
  },

  // Tourism & Hospitality (El-Fondoqy)
  {
    id: 'tour_1',
    category: 'tourism_hospitality',
    categoryName: 'السياحة وإدارة الفنادق',
    question: 'في قطاع الضيافة الفندقية، ماذا يعني مصطلح "Concierge" (الكونسيرج)؟',
    answer: 'مسؤول تلبية طلبات النزلاء الخاصة وتنسيق الجولات والحجوزات',
    options: ['مدير الحسابات الفندقية', 'مسؤول تلبية طلبات النزلاء الخاصة وتنسيق الجولات والحجوزات', 'رئيس الطهاة', 'مشرف نظافة الغرف'],
    funFact: 'الكلمة فرنسية الأصل وتعني حارس المفاتيح، والكونسيرج المحترف يستطيع حجز طاولة في مطعم محجوز بالكامل لسنة!'
  },
  {
    id: 'tour_2',
    category: 'tourism_hospitality',
    categoryName: 'السياحة وإدارة الفنادق',
    question: 'أي مدينة تضم أكبر عدد من الفنادق ذات تصنيف 5 نجوم في العالم؟',
    answer: 'لندن (وتنافسها دبي وماكاو)',
    options: ['باريس', 'لندن (وتنافسها دبي وماكاو)', 'نيويورك', 'طوكيو'],
    funFact: 'لندن تتصدر المدن العالمية في عدد الفنادق الحاصلة على 5 نجوم بتقييم فوربس ودليل ميشلان!'
  },

  // Cybersecurity & Networking (Eyad)
  {
    id: 'sec_1',
    category: 'cybersecurity',
    categoryName: 'الأمن السيبراني والشبكات',
    question: 'ما هو الهجوم الذي يقوم فيه المهاجم بإغراق السيرفر بسيل هائل من الطلبات لإخراجه عن الخدمة؟',
    answer: 'هجوم حجب الخدمة الموزع (DDoS)',
    options: ['Man-in-the-Middle', 'هجوم حجب الخدمة الموزع (DDoS)', 'SQL Injection', 'Phishing'],
    funFact: 'أكبر هجوم DDoS في التاريخ تجاوز 3.47 تيرابت في الثانية، حيث جُندت ملايين أجهزة الـ IoT المخترقة!'
  },
  {
    id: 'sec_2',
    category: 'cybersecurity',
    categoryName: 'الأمن السيبراني والشبكات',
    question: 'ما هو المنفذ الافتراضي (Port) المستخدم لبروتوكول تصفح الويب الآمن المشفر HTTPS؟',
    answer: 'Port 443',
    options: ['Port 80', 'Port 443', 'Port 22', 'Port 8080'],
    funFact: 'المنفذ 80 مخصص لـ HTTP غير المشفر، بينما 443 يعتمد تشفير SSL/TLS لمنع التجسس على بياناتك!'
  },

  // Health Sciences & Laboratory (Mazen)
  {
    id: 'lab_1',
    category: 'health_sciences_lab',
    categoryName: 'العلوم الصحية والتحاليل المعملية',
    question: 'ما هو التحليل المعملي المختصر بـ CBC الذي يُطلب لتقييم صحة خلايا الدم الكاملة؟',
    answer: 'Complete Blood Count (صورة دم كاملة)',
    options: ['Complete Blood Count (صورة دم كاملة)', 'Cell Blood Check', 'Cardiac Blood Concentration', 'Central Bone Calcium'],
    funFact: 'تحليل CBC يقيس كرات الدم الحمراء والبيضاء والصفائح الدموية والهيموجلوبين في نقطة دم واحدة!'
  },
  {
    id: 'lab_2',
    category: 'health_sciences_lab',
    categoryName: 'العلوم الصحية والتحاليل المعملية',
    question: 'جهاز المعمل الذي يدور بسرعة فائقة لفصل مكونات الدم (البلازما عن الخلايا) يُسمى:',
    answer: 'جهاز الطرد المركزي (Centrifuge)',
    options: ['الميكروسكوب الإلكتروني', 'جهاز الطرد المركزي (Centrifuge)', 'التحليل الطيفي', 'الحاضنة المعملية'],
    funFact: 'جهاز الطرد المركزي يدور بآلاف الدورات في الدقيقة ليولد قوة جاذبية تدفع الأثقل للأسفل وتترك البلازما الصفراء بالأعلى!'
  },

  // Console & PC Gaming & Reflex (Mazen, Khaled)
  {
    id: 'game_1',
    category: 'console_pc_gaming',
    categoryName: 'ألعاب الفيديو والكونسول',
    question: 'ما هي اللعبة الأكثر مبيعاً في تاريخ ألعاب الفيديو على الإطلاق بأكثر من 300 مليون نسخة؟',
    answer: 'Minecraft',
    options: ['GTA V', 'Minecraft', 'Tetris', 'Wii Sports'],
    funFact: 'ماينكرافت طورها ماركوس بيرسون لوحده عام 2009 قبل أن تشتريها مايكروسوفت بمبلغ 2.5 مليار دولار!'
  },
  {
    id: 'game_2',
    category: 'console_pc_gaming',
    categoryName: 'ألعاب الفيديو والكونسول',
    question: 'في لعبة Dark Souls، ما هي العبارة الشهيرة التي تظهر باللون الأحمر الفاقع عند موت شخصيتك؟',
    answer: 'YOU DIED',
    options: ['GAME OVER', 'WASTED', 'YOU DIED', 'MISSION FAILED'],
    funFact: 'عشاق سلسلة السولز رأوا هذه الشاشة مئات الملايين من المرات وهي رمز التحدي الأسطوري للعبة!'
  },

  // Dentistry (Ali Turbo)
  {
    id: 'dent_1',
    category: 'dentistry',
    categoryName: 'طب وجراحة الأسنان',
    question: 'ما هي أصلب مادة في جسم الإنسان بالكامل (أصلب حتى من العظام)؟',
    answer: 'مينا الأسنان (Enamel)',
    options: ['عظام الجمجمة', 'مينا الأسنان (Enamel)', 'عاج السن (Dentin)', 'عظمة الفخذ'],
    funFact: 'مينا الأسنان تتكون من 96% معادن هيدروكسي أباتيت، وهي تقاوم قوى ضغط تصل لمئات الكيلوجرامات!'
  },
  {
    id: 'dent_2',
    category: 'dentistry',
    categoryName: 'طب وجراحة الأسنان',
    question: 'كم عدد الأسنان الدائمة لدى الإنسان البالغ مكتمل النمو (شاملاً ضروس العقل)؟',
    answer: '32 سناً',
    options: ['28 سناً', '30 سناً', '32 سناً', '34 سناً'],
    funFact: '16 سناً في الفك العلوي و16 في الفك السفلي، وكثير من البشر يخضعون لجراحة خلع ضرس العقل لضيق الفك!'
  },

  // Cars, Engines & Mechanics (Ali Turbo)
  {
    id: 'car_1',
    category: 'cars_and_engine_mechanics',
    categoryName: 'ميكانيكا السيارات والمحركات',
    question: 'ما هي وظيفة الشاحن التوربيني (Turbocharger) في محرك السيارة؟',
    answer: 'ضغط الهواء الداخل لغرفة الاحتراق لزيادة القوة الحصانية',
    options: ['تبريد سائل الردياتير', 'ضغط الهواء الداخل لغرفة الاحتراق لزيادة القوة الحصانية', 'تنقية زيت المحرك', 'زيادة سرعة دوران الدينامو'],
    funFact: 'التوربو يستغل غازات العادم المطرودة لتدوير توربينة تدفع كمية أكبر من الأكسجين، فيعطي قوة محرك أكبر بدون تكبير حجمه!'
  },
  {
    id: 'car_2',
    category: 'cars_and_engine_mechanics',
    categoryName: 'ميكانيكا السيارات والمحركات',
    question: 'ماذا يرمز حرف "V" في محركات السيارات مثل V6 أو V8؟',
    answer: 'ترتيب أسطوانات المحرك على شكل حرف V',
    options: ['Velocity (السرعة)', 'ترتيب أسطوانات المحرك على شكل حرف V', 'Volume (السعة اللترية)', 'Variable Timing'],
    funFact: 'شكل الـ V بزاوية 60 أو 90 درجة يتيح وضع أسطوانات أكثر في حيز ميكانيكي مدمج ومتوازن!'
  },

  // Fitness & Gym (Ali Turbo)
  {
    id: 'fit_1',
    category: 'fitness_gym',
    categoryName: 'الفيتنس والجيم',
    question: 'أي من التمارين التالية يعتبر من الثلاثة الكبار الأساسية (The Big Three) في رياضة الباورليفتنج؟',
    answer: 'الاسكوات (Squat)',
    options: ['البايسيبس كيرل', 'الاسكوات (Squat)', 'اللات بول داون', 'السيد ليترال رايز'],
    funFact: 'الثلاثة الكبار هم: السكوات (Squat)، البنش برس (Bench Press)، والديدليفت (Deadlift) وهي معيار القوة الخام!'
  },

  // Islamic Studies & Culture (El-Touny, Khaled)
  {
    id: 'islam_1',
    category: 'islamic_studies',
    categoryName: 'الدراسات والثقافة الإسلامية',
    question: 'ما هي أطول سورة في القرآن الكريم من حيث عدد الآيات والكلمات؟',
    answer: 'سورة البقرة',
    options: ['سورة آل عمران', 'سورة البقرة', 'سورة النساء', 'سورة المائدة'],
    funFact: 'سورة البقرة تقع في 286 آية وتضم أعظم آية في كتاب الله: آية الكرسي!'
  },
  {
    id: 'islam_2',
    category: 'islamic_studies',
    categoryName: 'الدراسات والثقافة الإسلامية',
    question: 'من هو الصحابي الجليل الملقب بـ "أمين هذه الأمة"؟',
    answer: 'أبو عبيدة بن الجراح',
    options: ['عثمان بن عفان', 'أبو عبيدة بن الجراح', 'سلمان الفارسي', 'معاذ بن جبل'],
    funFact: 'قال عنه النبي ﷺ: "إن لكل أمة أميناً، وإن أميننا أيتها الأمة أبو عبيدة بن الجراح".'
  }
];

// ROUND 2: "اديني في سري" (Password Mode)
// Secret target words with 4 forbidden words each ("ممنوع تقول")
export const PASSWORD_WORDS = [
  {
    id: 'pw_1',
    target: 'كشري',
    category: 'أكلات شعبية مصرية',
    forbidden: ['عدس', 'صلصة', 'مكرونة', 'دقة'],
    clueIdea: 'أشهر طبق مصري في الزمان والمكان عند أبو طارق!'
  },
  {
    id: 'pw_2',
    target: 'ليونيل ميسي',
    category: 'أساطير كرة القدم',
    forbidden: ['أرجنتين', 'برشلونة', 'كرة ذهبية', 'رونالدو'],
    clueIdea: 'البرغوث الساحر بطل العالم في قطر!'
  },
  {
    id: 'pw_3',
    target: 'بريكينج باد (Breaking Bad)',
    category: 'مسلسلات أسطورية',
    forbidden: ['والتر وايت', 'هايزنبرغ', 'مخدرات', 'كيمياء'],
    clueIdea: 'مدرس دخل عالم الجريمة بالبدلة الصفراء الشهيرة!'
  },
  {
    id: 'pw_4',
    target: 'جيلاتي',
    category: 'حلويات وانتعاش',
    forbidden: ['آيس كريم', 'إيطاليا', 'مثلج', 'بولة'],
    clueIdea: 'مزاج التوني بيلافيتا المنعش في الصيف!'
  },
  {
    id: 'pw_5',
    target: 'واي فاي (Wi-Fi)',
    category: 'تكنولوجيا وشبكات',
    forbidden: ['راوتر', 'إنترنت', 'باسورد', 'سلك'],
    clueIdea: 'أول حاجة بتسأل عنها لما تدخل كافيه أو عند صحبك!'
  },
  {
    id: 'pw_6',
    target: 'برج القاهرة',
    category: 'معالم ومزارات',
    forbidden: ['زمالك', 'طويل', 'لوتس', 'تلسكوب'],
    clueIdea: 'أيقونة العاصمة بتشوف من فوقها النيل كله!'
  },
  {
    id: 'pw_7',
    target: 'توربو (Turbo)',
    category: 'سيارات وميكانيكا',
    forbidden: ['محرك', 'سرعة', 'هواء', 'سيارة'],
    clueIdea: 'لقب علي المفضل عشان بيحب طيران العجل!'
  },
  {
    id: 'pw_8',
    target: 'الأهلي',
    category: 'نوادي مصرية',
    forbidden: ['أحمر', 'نادي القرن', 'زمالك', 'الجزيرة'],
    clueIdea: 'نادي البطولات والتاسعة والقاضية ممكن!'
  },
  {
    id: 'pw_9',
    target: 'ضرس العقل',
    category: 'طب أسنان',
    forbidden: ['خلع', 'فك', 'ألم', 'أخير'],
    clueIdea: 'بيطلع في أواخر العشرينات وبيعكنن على صاحب العيادة!'
  },
  {
    id: 'pw_10',
    target: 'بلايستيشن (PlayStation)',
    category: 'جيمنج وسهر',
    forbidden: ['سوني', 'ذراع', 'فيفا', 'كونسول'],
    clueIdea: 'جهاز مازن وخالد في السهرة لحد الفجر!'
  }
];

// ROUND 3: "حط في قريبي" (Penalty Shootouts)
// Random category generated first -> Teams select their duelists -> 1v1 speed shootout
export const PENALTY_CATEGORIES = [
  { id: 'football_post_2010', name: 'كرة قدم حديثة (بعد 2010)', icon: '⚽', hint: 'تخصص: حفيد الفولي، إياد الأسد، التوني، البربخ' },
  { id: 'capitals_and_flags', name: 'عواصم العالم والأعلام', icon: '🌍', hint: 'تخصص: حفيد الفولي' },
  { id: 'general_knowledge', name: 'معلومات عامة وأمثال وفوازير', icon: '💡', hint: 'تخصص: حفيد الفولي، زياد الفندقي، إياد الأسد' },
  { id: 'popular_foreign_series', name: 'المسلسلات والدراما العالمية', icon: '🎬', hint: 'تخصص: زياد الفندقي، خالد البربخ' },
  { id: 'series_breaking_bad', name: 'مسلسل Breaking Bad وهايزنبرغ', icon: '🧪', hint: 'تخصص: خالد البربخ' },
  { id: 'pc_hardware_gaming', name: 'تجميعات PC وهاردوير وجيمنج', icon: '🖥️', hint: 'تخصص: خالد البربخ' },
  { id: 'gaming_tech', name: 'الأمن السيبراني والشبكات والتقنية', icon: '🛡️', hint: 'تخصص: إياد الأسد' },
  { id: 'console_pc_gaming', name: 'جيمنج وكونسول وبي سي', icon: '🕹️', hint: 'تخصص: مازن الجيمر' },
  { id: 'reflex_trivia', name: 'أسئلة سرعة ورد فعل 240Hz', icon: '⚡', hint: 'تخصص: مازن الجيمر' },
  { id: 'cars_mechanics', name: 'السيارات ومحركات التوربو', icon: '🏎️', hint: 'تخصص: علي التوربو' },
  { id: 'dentistry', name: 'طب وجراحة الأسنان', icon: '🦷', hint: 'تخصص: علي التوربو' },
  { id: 'fitness_gym', name: 'فيتنس وكمال أجسام', icon: '💪', hint: 'تخصص: علي التوربو' },
  { id: 'veterinary_biology', name: 'الطب البيطري والأحياء', icon: '🐾', hint: 'تخصص: التوني بيلافيتا' },
  { id: 'gelato_sweets', name: 'الجيلاتي وفنون الحلويات', icon: '🍨', hint: 'تخصص: التوني بيلافيتا' },
  { id: 'islamic_studies', name: 'تاريخ وحضارة إسلامية', icon: '🕌', hint: 'تخصص: التوني، البربخ' }
];

export const PENALTY_QUESTIONS = [
  {
    id: 'pen_fb_1',
    category: 'football_post_2010',
    kickerHint: 'كرة قدم بعد 2010',
    question: 'من فاز بجائزة أفضل لاعب في كأس العالم قطر 2022 وقاد الأرجنتين لحصد اللقب؟',
    answer: 'ليونيل ميسي',
    options: ['كيليان مبابي', 'ليونيل ميسي', 'لوكا مودريتش', 'أنطوان غريزمان'],
    is_post_2010_football: true
  },
  {
    id: 'pen_cap_1',
    category: 'capitals_and_flags',
    kickerHint: 'عواصم وأعلام',
    question: 'ما هي عاصمة اليابان الحالية؟',
    answer: 'طوكيو',
    options: ['طوكيو', 'كيوتو', 'أوساكا', 'يوكوهاما'],
    is_post_2010_football: false
  },
  {
    id: 'pen_gk_1',
    category: 'general_knowledge',
    kickerHint: 'معلومات عامة',
    question: 'ما هو الكوكب الأقرب للشمس في نظامنا الشمسي؟',
    answer: 'عطارد',
    options: ['الزهرة', 'عطارد', 'المريخ', 'الأرض'],
    is_post_2010_football: false
  },
  {
    id: 'pen_series_1',
    category: 'popular_foreign_series',
    kickerHint: 'مسلسلات عالمية',
    question: 'ما اسم العصابة الإنجليزية الشهيرة في برمنغهام بقيادة توماس شيلبي؟',
    answer: 'Peaky Blinders',
    options: ['Peaky Blinders', 'Sons of Anarchy', 'The Sopranos', 'Vikings'],
    is_post_2010_football: false
  },
  {
    id: 'pen_bb_1',
    category: 'series_breaking_bad',
    kickerHint: 'Breaking Bad',
    question: 'ما اسم شريك والتر وايت الشاب في مسلسل Breaking Bad؟',
    answer: 'جيسي بينكمان',
    options: ['هانك شريدر', 'جيسي بينكمان', 'تود', 'سكينّي بيت'],
    is_post_2010_football: false
  },
  {
    id: 'pen_pc_1',
    category: 'pc_hardware_gaming',
    kickerHint: 'هاردوير وPC',
    question: 'ما هي الشركة المصنعة لمعالجات Ryzen الشهيرة؟',
    answer: 'AMD',
    options: ['Intel', 'AMD', 'Nvidia', 'Qualcomm'],
    is_post_2010_football: false
  },
  {
    id: 'pen_tech_1',
    category: 'gaming_tech',
    kickerHint: 'أمن سيبراني وتقنية',
    question: 'ماذا يسمى البرمجيات الخبيثة التي تشفر ملفات الضحية وتطلب فدية لفكها؟',
    answer: 'برامج الفدية (Ransomware)',
    options: ['Spyware', 'برامج الفدية (Ransomware)', 'Adware', 'Keylogger'],
    is_post_2010_football: false
  },
  {
    id: 'pen_console_1',
    category: 'console_pc_gaming',
    kickerHint: 'جيمنج وكونسول',
    question: 'ما هي لعبة العالم المفتوح الملحمية التي حصدت جائزة لعبة العام (GOTY) 2022؟',
    answer: 'إلدن رينج (Elden Ring)',
    options: ['God of War Ragnarok', 'إلدن رينج (Elden Ring)', 'Horizon Forbidden West', 'Cyberpunk 2077'],
    is_post_2010_football: false
  },
  {
    id: 'pen_reflex_1',
    category: 'reflex_trivia',
    kickerHint: 'سرعة 240Hz',
    question: 'إذا كان لديك 3 تفاحات وأخذت منها تفاحتين، كم تفاحة أصبحت في يدك الآن؟',
    answer: 'تفاحتان',
    options: ['تفاحة واحدة', 'تفاحتان', '3 تفاحات', 'صفر'],
    is_post_2010_football: false
  },
  {
    id: 'pen_cars_1',
    category: 'cars_mechanics',
    kickerHint: 'سيارات وميكانيكا',
    question: 'ما هي السيارة الإيطالية الخارقة التي تتخذ علامتها التجارية رمز الحصان الواقف؟',
    answer: 'فيراري (Ferrari)',
    options: ['لامبورغيني', 'فيراري (Ferrari)', 'مازيراتي', 'ألفا روميو'],
    is_post_2010_football: false
  },
  {
    id: 'pen_dent_1',
    category: 'dentistry',
    kickerHint: 'طب أسنان',
    question: 'ما هو المعدن الطبيعي الذي يُضاف لمعجون الأسنان ومياه الشرب لمقاومة التسوس؟',
    answer: 'الفلورايد (Fluoride)',
    options: ['الكالسيوم', 'الفلورايد (Fluoride)', 'المغنيسيوم', 'الزنك'],
    is_post_2010_football: false
  },
  {
    id: 'pen_fit_1',
    category: 'fitness_gym',
    kickerHint: 'فيتنس وجيم',
    question: 'ما هو التمرين الأساسي الأقوى للجزء السفلي والملقب بـ "ملك التمارين" في الجيم؟',
    answer: 'السكوات (Squat)',
    options: ['السكوات (Squat)', 'الليج بريس', 'الديدليفت الروماني', 'اللانجز'],
    is_post_2010_football: false
  },
  {
    id: 'pen_bio_1',
    category: 'veterinary_biology',
    kickerHint: 'بيولوجيا وبيطري',
    question: 'ما هو الحيوان الثديي الوحيد القادر على الطيران الحقيقي بفضل أجنحته؟',
    answer: 'الخفاش (الوطواط)',
    options: ['السنجاب الطائر', 'الخفاش (الوطواط)', 'طائر البطريق', 'النعامة'],
    is_post_2010_football: false
  },
  {
    id: 'pen_gel_1',
    category: 'gelato_sweets',
    kickerHint: 'جيلاتي وحلويات',
    question: 'ما هي النكهة الإيطالية الكلاسيكية للجيلاتي المصنوعة من الكريمة وقطع الشوكولاتة الداكنة؟',
    answer: 'ستراتشياتيلا (Stracciatella)',
    options: ['بيستاشيو', 'ستراتشياتيلا (Stracciatella)', 'تيراميسو', 'بافانا'],
    is_post_2010_football: false
  },
  {
    id: 'pen_isl_1',
    category: 'islamic_studies',
    kickerHint: 'تاريخ إسلامي',
    question: 'من كان أول مؤذن في الإسلام وصاحب الصوت الندي على ظهر الكعبة المشرفة؟',
    answer: 'بلال بن رباح رضي الله عنه',
    options: ['عبد الله بن أم مكتوم', 'بلال بن رباح رضي الله عنه', 'أبو هريرة', 'عمار بن ياسر'],
    is_post_2010_football: false
  }
];

// BONUS ROUND: "مين يزوّد؟" (Blind Auction)
// Bidding topics where teams wager how many items they can name!
export const AUCTION_TOPICS = [
  {
    id: 'auc_1',
    topic: 'أندية فازت بدوري أبطال أوروبا من 2010 حتى 2024',
    category: 'football_post_2010',
    minBid: 3,
    maxPossible: 7,
    validItems: [
      'ريال مدريد', 'برشلونة', 'إنتر ميلان', 'تشيلسي',
      'بايرن ميونخ', 'ليفربول', 'مانشستر سيتي'
    ],
    hint: 'كل الأندية دي رفعت الكأس في الفترة من 2010 لـ 2024!',
    is_post_2010_football: true
  },
  {
    id: 'auc_2',
    topic: 'عواصم دول عربية آسيوية وأفريقية',
    category: 'جغرافيا وسياسة',
    minBid: 4,
    maxPossible: 22,
    validItems: [
      'القاهرة', 'الرياض', 'أبوظبي', 'الدوحة', 'الكويت', 'المنامة', 'مسقط',
      'بغداد', 'دمشق', 'بيروت', 'عمان', 'القدس', 'صنعاء', 'طرابلس',
      'تونس', 'الجزائر', 'الرباط', 'نواكشوط', 'الخرطوم', 'مقديشو', 'جيبوتي', 'موروني'
    ],
    hint: 'من المحيط إلى الخليج.. العواصم الكبرى!'
  },
  {
    id: 'auc_3',
    topic: 'ماركات سيارات عالمية مشهورة',
    category: 'سيارات ومحركات',
    minBid: 5,
    maxPossible: 24,
    validItems: [
      'تويوتا', 'مرسيدس', 'بي إم دبليو', 'فيراري', 'بورشه', 'هوندا',
      'نيسان', 'فورد', 'شيفروليه', 'أودي', 'هيونداي', 'كيا',
      'لامبورغيني', 'فولكس فاجن', 'تسلا', 'مازدا', 'ميتسوبيشي', 'بيجو',
      'رينو', 'سوبارو', 'لكزس', 'فولفو', 'لاند روفر', 'جيب'
    ],
    hint: 'الألماني والياباني والأمريكي والإيطالي!'
  },
  {
    id: 'auc_4',
    topic: 'لغات برمجة معتمدة في هندسة البرمجيات',
    category: 'علوم حاسب وتطوير',
    minBid: 4,
    maxPossible: 14,
    validItems: [
      'بايثون (Python)', 'جافاسكريبت (JavaScript)', 'سي بلس بلس (C++)', 'جافا (Java)',
      'سي شارب (C#)', 'بي إتش بي (PHP)', 'تايب سكريبت (TypeScript)', 'روبي (Ruby)',
      'سويفت (Swift)', 'كوتلن (Kotlin)', 'جو (Go)', 'رست (Rust)', 'دارت (Dart)', 'إس كيو إل (SQL)'
    ],
    hint: 'من لغات الويب والموبايل والأنظمة والذكاء الاصطناعي!'
  },
  {
    id: 'auc_5',
    topic: 'شخصيات من عالم مسلسلي Breaking Bad و Better Call Saul',
    category: 'مسلسلات أجنبية',
    minBid: 3,
    maxPossible: 15,
    validItems: [
      'والتر وايت', 'جيسي بينكمان', 'سول غودمان', 'غاس فرينغ', 'مايك إيرمنتروت',
      'هانك شريدر', 'سكايلر وايت', 'كيم ويكسلر', 'توكو سالامانكا', 'هيكتور سالامانكا',
      'ناتشو فارغا', 'لالو سالامانكا', 'ماري شريدر', 'تود', 'جاك ويلكر'
    ],
    hint: 'كارتل المخدرات ووكلاء مكافحة المخدرات في نيو مكسيكو!'
  }
];

export const CHARACTERS = [
  {
    id: 'fares_elfouly',
    name: 'حفيد الفولي',
    realName: 'فارس الفولي',
    nickname: 'Hafeed El-Foly',
    avatar: '⚡',
    color: '#00F2FE',
    accentColor: '#008f97',
    badge: 'كبير العيلة ومبرمج الساحة',
    catchphrase: 'الفولي كودها.. والبارسا في القلب والقمة!',
    lore: 'حفيد الفولي الأصلي، يحل أعقد كود في ثانية، ويسمع تشكيلة برشلونة في المنام، وجغرافيا العالم في جيبه.',
    attributes: ['computer_science', 'barcelona_european_football', 'capitals_and_flags'],
    attributesDisplay: ['علوم حاسب وبرمجة 💻', 'برشلونة والكرة الأوروبية ⚽', 'عواصم وأعلام الدول 🌍'],
    bonus: {
      title: 'بونص الفولي +20%',
      description: 'مضاعف +20% على أسئلة الجغرافيا وأكواد البرمجة السريعة',
      multiplier: 1.2,
      appliedCategories: ['capitals_and_flags', 'computer_science']
    }
  },
  {
    id: 'abdelrahman_eltouny',
    name: 'التوني بيلافيتا',
    realName: 'عبد الرحمن التوني',
    nickname: 'Bella Vita',
    avatar: '🍦',
    color: '#FFD200',
    accentColor: '#b39200',
    badge: 'دكتور الحبايب وخبير الجيلاتي',
    catchphrase: 'بيلا فيتا يا عيوني.. الجيلاتي مظبوط والتشريح بالفيمتو ثانية!',
    lore: 'طبيب بيطري فنان في الجيلاتي والحلويات، عاشق للأهلي والبارسا ومرجع إسلامي معتمد في السهرة.',
    attributes: ['veterinary_biology', 'gelato_and_desserts', 'al_ahly_barca', 'islamic_studies'],
    attributesDisplay: ['بيولوجيا وبيطري 🔬', 'جيلاتي وحلويات 🍨', 'الأهلي والبارسا 🔴🔵', 'دراسات وتاريخ إسلامي 📖'],
    bonus: {
      title: 'حماية الستريك البيلافيتا',
      description: 'درع حماية ضد كسر الستريك في أسئلة التاريخ الإسلامي والبيولوجيا',
      streakShield: true,
      appliedCategories: ['islamic_studies', 'veterinary_biology']
    }
  },
  {
    id: 'khaled_elbarbakh',
    name: 'البربخ',
    realName: 'خالد',
    nickname: 'El-Barbakh',
    avatar: '🛡️',
    color: '#FF4B4B',
    accentColor: '#b32828',
    badge: 'حائط الصد ومستر بريكينج باد',
    catchphrase: 'البربخ مسيطر.. مفيش شوتة ولا جون بيعدي من هنا!',
    lore: 'بيطري، مجمّع هاردوير احترافي، بطل الفيفا، حافظ بريكينج باد كلمة بكلمة، والريال والأهلي في دمه.',
    attributes: ['veterinary_medicine', 'pc_hardware_assembly', 'fifa_gaming', 'foreign_tv_series', 'real_madrid_al_ahly', 'islamic_culture'],
    attributesDisplay: ['طب بيطري 🐾', 'تجميعات PC وهاردوير 🖥️', 'فيفا وجيمنج 🎮', 'مسلسلات أجنبية (Breaking Bad) 📺', 'ريال مدريد والأهلي ⚪🦅', 'ثقافة إسلامية 🕌'],
    bonus: {
      title: 'حائط صد البربخ',
      description: 'أعلى فرصة إنقاذ واعتراض (Intercept) كرات ترجيحية في جولة حط في قريبي',
      interceptBonus: true,
      appliedCategories: ['real_madrid_al_ahly', 'fifa_gaming', 'foreign_tv_series']
    }
  },
  {
    id: 'ziad_elfondoqy',
    name: 'الفندقي',
    realName: 'زياد',
    nickname: 'El-Fondoqy',
    avatar: '🛎️',
    color: '#EC4899',
    accentColor: '#be185d',
    badge: 'خبير الضيافة ودراما البرايم تايم',
    catchphrase: 'خدمة 5 نجوم وبرايم تايم دراما مفيش تفاهم!',
    lore: 'ملك الفندقة والسياحة الفاخرة، ناقد دراما عالمي ومدريدي أهلاوي للنخاع، يدير الغرفة بروقان تام.',
    attributes: ['tourism_hospitality', 'international_drama_series', 'real_madrid_al_ahly'],
    attributesDisplay: ['سياحة وفندقة 5 نجوم 🛎️', 'دراما ومسلسلات عالمية 🎭', 'ريال مدريد والأهلي 👑'],
    bonus: {
      title: 'تجميد الوقت الفندقي',
      description: 'خاصية تجميد الوقت +10 ثواني كاملة في الجولات السريعة (Time Freeze)',
      timeFreeze: 10,
      appliedCategories: ['tourism_hospitality', 'international_drama_series']
    }
  },
  {
    id: 'eyad_amr',
    name: 'إياد الأسد',
    realName: 'إياد عمرو',
    nickname: 'Cyber El-Assad',
    avatar: '🦁',
    color: '#00E676',
    accentColor: '#009e52',
    badge: 'صائد الثغرات وحامي الشبكات',
    catchphrase: 'سيرفراتنا مشفرة والتأمين حديدي.. إياد جاهز للافتراس!',
    lore: 'وحش أمن المعلومات وهندسة الشبكات والأنظمة، كتالوني وأهلاوي شرس على كل الجبهات.',
    attributes: ['it_systems_networking', 'cybersecurity', 'barca_al_ahly'],
    attributesDisplay: ['شبكات وأنظمة IT 🌐', 'أمن سيبراني واختراق أخلاقي 🔒', 'برشلونة والأهلي ⚽'],
    bonus: {
      title: 'جدار الحماية السيبراني',
      description: 'حماية مضاعف الستريك وتأمين نقاط الفريق من أي خصم أو عقوبة',
      firewallProtection: true,
      appliedCategories: ['cybersecurity', 'it_systems_networking']
    }
  },
  {
    id: 'mazen_elgamer',
    name: 'مازن الجيمر',
    realName: 'مازن',
    nickname: 'El-Gamer / السايبر',
    avatar: '🕹️',
    color: '#8B5CF6',
    accentColor: '#5b21b6',
    badge: 'سيد السايبر وسرعة 240Hz',
    catchphrase: 'رد فعلي أسرع من الـ 240Hz.. البزر محجوز لي يا كباتن!',
    lore: 'متخصص معامل وعلوم صحية، بطل منصات الكونسول والبي سي، وحش الأسئلة السريعة والـ Reflex.',
    attributes: ['health_sciences_lab', 'console_pc_gaming', 'reflex_trivia'],
    attributesDisplay: ['علوم صحية وتحاليل 🧪', 'ألعاب كونسول وبي سي 🎮', 'أسئلة سرعة ورد فعل ⚡'],
    bonus: {
      title: 'بزر السايبر فائق السرعة',
      description: 'أفضلية +5 ثواني في الضغط على البزر وأولوية في أسئلة الجيمنج والتحاليل',
      fastBuzzer: true,
      appliedCategories: ['console_pc_gaming', 'reflex_trivia', 'health_sciences_lab']
    }
  },
  {
    id: 'ali_ahmed',
    name: 'علي التوربو',
    realName: 'علي أحمد',
    nickname: 'Ali Turbo',
    avatar: '🏎️',
    color: '#F97316',
    accentColor: '#c2410c',
    badge: 'طبيب الأسنان وميكانيكي الفورمولا',
    catchphrase: 'توربو شغال على أعلى RPM وعضلات ناشفة وابتسامة هوليود!',
    lore: 'طبيب أسنان متألق، موسوعة في ميكانيكا محركات السيارات، وحش الجيم ورفع الأوزان الثقيلة.',
    attributes: ['dentistry', 'cars_and_engine_mechanics', 'fitness_gym'],
    attributesDisplay: ['طب وجراحة أسنان 🦷', 'ميكانيكا سيارات ومحركات 🏎️', 'فيتنس وكمال أجسام 💪'],
    bonus: {
      title: 'دفعة التوربو السريعة',
      description: '+15% بونص نقاط إضافية إذا جاوبت في أول 5 ثواني من السؤال!',
      speedBonus: 1.15,
      appliedCategories: ['cars_and_engine_mechanics', 'fitness_gym', 'dentistry']
    }
  }
];

export const TEAMS = [
  { id: 'team_a', name: 'فريق الحيتان (Team A)', color: '#00F2FE', score: 0, bank: 0 },
  { id: 'team_b', name: 'فريق الوحوش (Team B)', color: '#FF4B4B', score: 0, bank: 0 }
];

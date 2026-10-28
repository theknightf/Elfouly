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
    lore: 'حفيد الفولي الأصلي، يحل أعقد فزورة في ثانية، ويسمع تشكيلة برشلونة في المنام، وجغرافيا العالم ومعلوماتها في جيبه.',
    attributes: ['football_post_2010', 'capitals_and_flags', 'general_knowledge'],
    attributesDisplay: ['كرة قدم بعد 2010 ⚽', 'عواصم وأعلام الدول 🌍', 'معلومات عامة ومنوعات 💡'],
    bonus: {
      title: 'بوصلة الفولي: غيّر السؤال',
      description: 'بدّل السؤال الحالي بسؤال جديد (جولة 1 أو 3) — مرة واحدة في الماتش.',
      categoryPeek: true,
      appliedCategories: ['capitals_and_flags', 'general_knowledge', 'football_post_2010']
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
    badge: 'طبيب الحبايب وخبير الجيلاتي',
    catchphrase: 'بيلا فيتا يا عيوني.. الجيلاتي مظبوط والتشريح بالفيمتو ثانية!',
    lore: 'طبيب بيطري فنان في الجيلاتي والحلويات، عاشق للأهلي والكرة الحديثة ومرجع إسلامي معتمد في السهرة.',
    attributes: ['veterinary_biology', 'gelato_sweets', 'football_post_2010', 'islamic_studies'],
    attributesDisplay: ['بيولوجيا وبيطري 🔬', 'جيلاتي وحلويات 🍨', 'كرة قدم بعد 2010 ⚽', 'دراسات إسلامية 📖'],
    bonus: {
      title: 'درع بيلافيتا',
      description: 'أول إجابة غلط في جولة 1 بعد التفعيل متكلّفكش ستريك ولا سرقة — مرة واحدة.',
      streakShield: true,
      appliedCategories: ['islamic_studies', 'veterinary_biology', 'gelato_sweets']
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
    lore: 'بيطري، مجمّع هاردوير احترافي، حافظ بريكينج باد كلمة بكلمة، والريال والأهلي في دمه.',
    attributes: ['veterinary_biology', 'pc_hardware_gaming', 'series_breaking_bad', 'football_post_2010', 'islamic_studies'],
    attributesDisplay: ['طب بيطري 🐾', 'هاردوير وجيمنج 🖥️', 'مسلسل Breaking Bad 🧪', 'كرة قدم بعد 2010 ⚽', 'ثقافة إسلامية 🕌'],
    bonus: {
      title: 'حائط البربخ: صد فوري',
      description: 'اعترض الركلة فورًا من غير ما تستنى 10 ثواني (جولة 3) — مرة واحدة.',
      interceptBonus: true,
      appliedCategories: ['football_post_2010', 'pc_hardware_gaming', 'series_breaking_bad']
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
    badge: 'خبير المسلسلات والمعلومات الروشة',
    catchphrase: 'خدمة 5 نجوم وبرايم تايم دراما مفيش تفاهم!',
    lore: 'ناقد مسلسلات ودراما عالمية، كروي مدريدي حتى النخاع، وموسوعة معلومات عامة تدير الغرفة بروقان.',
    attributes: ['popular_foreign_series', 'football_post_2010', 'general_knowledge'],
    attributesDisplay: ['مسلسلات أجنبية شهيرة 📺', 'كرة قدم بعد 2010 ⚽', 'معلومات عامة ومنوعات 💡'],
    bonus: {
      title: 'تجميد الوقت الفندقي',
      description: 'زوّد +10 ثواني على بطاقة "اديني في سري" الحالية — مرة واحدة.',
      timeFreeze: 10,
      appliedCategories: ['popular_foreign_series', 'general_knowledge', 'football_post_2010']
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
    badge: 'الأسد الكروي وموسوعة الأمثال',
    catchphrase: 'إياد جاهز للافتراس.. الكورة في المقص والمعلومة في الجيب!',
    lore: 'عاشق للكرة الحديثة بعد 2010، بطل الجيمنج والتقنية، وحافظ لأشهر الأمثال الشعبية والمعلومات العامة.',
    attributes: ['football_post_2010', 'general_knowledge', 'gaming_tech'],
    attributesDisplay: ['كرة قدم بعد 2010 ⚽', 'معلومات عامة وأمثال 💡', 'جيمنج وتقنية 🎮'],
    bonus: {
      title: 'جدار الأسد',
      description: 'بيلغي أول خصم نقاط (مخالفة جولة 2 أو مزاد فاشل جولة 4) — مرة واحدة.',
      firewallProtection: true,
      appliedCategories: ['football_post_2010', 'general_knowledge', 'gaming_tech']
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
      title: 'قفل السايبر',
      description: 'امنع الفريق الخصم من المزايدة 10 ثواني في جولة 4 — مرة واحدة.',
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
    attributes: ['dentistry', 'cars_mechanics', 'fitness_gym'],
    attributesDisplay: ['طب وجراحة أسنان 🦷', 'ميكانيكا سيارات ومحركات 🏎️', 'فيتنس وكمال أجسام 💪'],
    bonus: {
      title: 'توربو علي ×1.5',
      description: 'أول بطاقة سر صح أو مزاد ناجح بعد التفعيل بيدفع ×1.5 — مرة واحدة.',
      speedBonus: 1.15,
      appliedCategories: ['cars_mechanics', 'fitness_gym', 'dentistry']
    }
  }
];

export const TEAMS = [
  { id: 'team_a', name: 'فريق الحيتان', color: '#00F2FE', score: 0, bank: 0 },
  { id: 'team_b', name: 'فريق الوحوش', color: '#FF4B4B', score: 0, bank: 0 }
];

export const TEAM_PRESETS = [
  { id: 'whales_sharks', nameA: 'فريق الحيتان 🐬', nameB: 'فريق القروش 🦈', label: 'الحيتان والقروش' },
  { id: 'pharaohs_legends', nameA: 'فريق الفراعنة 👑', nameB: 'فريق الأساطير ⚡', label: 'الفراعنة والأساطير' },
  { id: 'falcons_eagles', nameA: 'صقور الأرينا 🦅', nameB: 'نسور الجيزة 🦅', label: 'الصقور والنسور' },
  { id: 'derby', nameA: 'الأهلي 🔴', nameB: 'الزمالك ⚪', label: 'ديربي القمة' },
  { id: 'wolves_tigers', nameA: 'ذئاب المعادي 🐺', nameB: 'نمور المنيا 🐯', label: 'الذئاب والنمور' },
  { id: 'classic_ab', nameA: 'تيم أ 🔵', nameB: 'تيم ب 🔴', label: 'تيم أ وتيم ب' }
];


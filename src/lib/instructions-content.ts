import type { TestId } from "@/lib/session-manager";

export interface InstructionContent {
  title: string;
  subtitle: string;
  objectiveLabel: string;
  objective: string;
  instructionsLabel: string;
  steps: string[];
  exampleLabel: string;
  example: string[];
  durationLabel: string;
  duration: string;
  startButton: string;
  rereadButton: string;
  progressLabel: (current: number, total: number) => string;
  countdownLabel: string;
  waitHint: (s: number) => string;
}

type Content = Record<"fr" | "ar", Record<TestId, InstructionContent>>;

export const INSTRUCTIONS: Content = {
  fr: {
    simon: {
      title: "Tâche de Simon",
      subtitle: "Contrôle Inhibiteur & Temps de Réaction",
      objectiveLabel: "Objectif",
      objective:
        "Mesurer ta capacité à répondre selon la COULEUR d'un stimulus, en ignorant sa position sur l'écran.",
      instructionsLabel: "Instructions",
      steps: [
        "L'écran est divisé en deux zones fixes : Zone GAUCHE = bouton ROUGE, Zone DROITE = bouton VERT.",
        "Un cercle coloré (rouge ou vert) apparaît soit à gauche, soit à droite.",
        "Appuie sur la zone qui correspond à la COULEUR du cercle, pas à l'endroit où il apparaît.",
        "Essais congruents : le cercle rouge apparaît à gauche (facile). Essais incongruents : le cercle rouge apparaît à droite (résiste à l'instinct !).",
      ],
      exampleLabel: "Exemple",
      example: [
        "Cercle ROUGE à DROITE → appuie sur la zone GAUCHE (ROUGE) ✓",
        "Cercle VERT à GAUCHE → appuie sur la zone DROITE (VERT) ✓",
      ],
      durationLabel: "Durée",
      duration: "~8 minutes · ~60 essais (entraînement inclus)",
      startButton: "Démarrer le Test",
      rereadButton: "Relire",
      progressLabel: (c, t) => `Test ${c} sur ${t}`,
      countdownLabel: "Préparation…",
      waitHint: (s) => `Prends le temps de bien lire (${s}s)`,
    },
    nback: {
      title: "N-Back 2",
      subtitle: "Mémoire de Travail",
      objectiveLabel: "Objectif",
      objective:
        "Mesurer ta capacité à retenir et mettre à jour des informations en temps réel.",
      instructionsLabel: "Instructions",
      steps: [
        "Une séquence de lettres apparaît à l'écran, une à la fois.",
        "Pour chaque nouvelle lettre, demande-toi : est-ce la même lettre qu'il y a 2 positions ?",
        "Si OUI → appuie sur OUI. Si NON → appuie sur NON.",
        "Une phase d'entraînement avec feedback précède le test réel. Pendant le test réel, il n'y aura plus de feedback.",
      ],
      exampleLabel: "Exemple",
      example: [
        "Séquence : A → R → A",
        "Quand le 3ème apparaît (A), appuie OUI car il correspond à la position -2.",
      ],
      durationLabel: "Durée",
      duration: "~6 minutes · ~40 essais (entraînement inclus)",
      startButton: "Démarrer le Test",
      rereadButton: "Relire",
      progressLabel: (c, t) => `Test ${c} sur ${t}`,
      countdownLabel: "Préparation…",
      waitHint: (s) => `Prends le temps de bien lire (${s}s)`,
    },
    tmt: {
      title: "Trail Making Test",
      subtitle: "Flexibilité Cognitive",
      objectiveLabel: "Objectif",
      objective:
        "Partie A : mesurer ton attention visuelle et ta vitesse de traitement. Partie B : mesurer ta flexibilité cognitive (alterner entre deux règles mentales).",
      instructionsLabel: "Instructions",
      steps: [
        "Partie A : des chiffres de 1 à 25 sont dispersés sur l'écran. Relie-les dans l'ordre croissant : 1 → 2 → 3 … → 25.",
        "Partie B : des chiffres ET des lettres sont dispersés. Alterne strictement : 1 → A → 2 → B → 3 → C …",
        "En cas d'erreur, le nœud clignotera en rouge — corrige et continue.",
        "Le prochain élément attendu est toujours affiché en haut de l'écran. Reste alerte !",
      ],
      exampleLabel: "Exemple",
      example: [
        "Partie A : 1 → 2 → 3 → 4 → 5 …",
        "Partie B : 1 → A → 2 → B → 3 → C …",
      ],
      durationLabel: "Durée",
      duration: "~6 minutes · Partie A + Partie B (entraînement inclus)",
      startButton: "Démarrer le Test",
      rereadButton: "Relire",
      progressLabel: (c, t) => `Test ${c} sur ${t}`,
      countdownLabel: "Préparation…",
      waitHint: (s) => `Prends le temps de bien lire (${s}s)`,
    },
  },
  ar: {
    simon: {
      title: "مهمة سايمون",
      subtitle: "التحكم التثبيطي وزمن الاستجابة",
      objectiveLabel: "الهدف",
      objective:
        "قياس قدرتك على الاستجابة وفقاً للون المحفز، بغض النظر عن موضعه على الشاشة.",
      instructionsLabel: "التعليمات",
      steps: [
        "الشاشة مقسّمة إلى منطقتين ثابتتين: المنطقة اليسرى = زر أحمر، المنطقة اليمنى = زر أخضر.",
        "ستظهر دائرة ملونة (حمراء أو خضراء) على اليسار أو اليمين.",
        "اضغط على المنطقة التي تتوافق مع لون الدائرة، وليس مع موضعها.",
        "المحاولات المتوافقة: الدائرة الحمراء تظهر على اليسار (سهل). المحاولات غير المتوافقة: الدائرة الحمراء تظهر على اليمين (قاوم الغريزة!).",
      ],
      exampleLabel: "مثال",
      example: [
        "دائرة حمراء على اليمين ← اضغط المنطقة اليسرى (الأحمر) ✓",
        "دائرة خضراء على اليسار ← اضغط المنطقة اليمنى (الأخضر) ✓",
      ],
      durationLabel: "المدة",
      duration: "~8 دقائق · ~60 محاولة (يشمل التدريب)",
      startButton: "ابدأ الاختبار",
      rereadButton: "إعادة القراءة",
      progressLabel: (c, t) => `الاختبار ${c} من ${t}`,
      countdownLabel: "التحضير…",
      waitHint: (s) => `خذ وقتك للقراءة جيداً (${s}ث)`,
    },
    nback: {
      title: "N-Back 2",
      subtitle: "الذاكرة العاملة",
      objectiveLabel: "الهدف",
      objective: "قياس قدرتك على الاحتفاظ بالمعلومات وتحديثها في الوقت الفعلي.",
      instructionsLabel: "التعليمات",
      steps: [
        "ستظهر سلسلة من الحروف على الشاشة، حرفاً واحداً في كل مرة.",
        "لكل حرف جديد، تساءل: هل هو نفس الحرف الذي ظهر قبل موضعين؟",
        "إذا نعم ← اضغط نعم. إذا لا ← اضغط لا.",
        "تسبق مرحلة التدريب مع التغذية الراجعة الاختبار الحقيقي. خلال الاختبار الحقيقي لن تكون هناك تغذية راجعة.",
      ],
      exampleLabel: "مثال",
      example: [
        "التسلسل: A ← R ← A",
        "عندما يظهر الحرف الثالث (A)، اضغط نعم لأنه يتطابق مع الموضع -2.",
      ],
      durationLabel: "المدة",
      duration: "~6 دقائق · ~40 محاولة (يشمل التدريب)",
      startButton: "ابدأ الاختبار",
      rereadButton: "إعادة القراءة",
      progressLabel: (c, t) => `الاختبار ${c} من ${t}`,
      countdownLabel: "التحضير…",
      waitHint: (s) => `خذ وقتك للقراءة جيداً (${s}ث)`,
    },
    tmt: {
      title: "اختبار تتبع المسار",
      subtitle: "المرونة المعرفية",
      objectiveLabel: "الهدف",
      objective:
        "الجزء أ: قياس انتباهك البصري وسرعة معالجتك. الجزء ب: قياس مرونتك المعرفية (التبديل بين قاعدتين ذهنيتين).",
      instructionsLabel: "التعليمات",
      steps: [
        "الجزء أ: أرقام من 1 إلى 25 مبعثرة على الشاشة. اربطها بالترتيب التصاعدي: 1 ← 2 ← 3 … ← 25.",
        "الجزء ب: أرقام وحروف مبعثرة. بدّل بدقة: 1 ← A ← 2 ← B ← 3 ← C …",
        "في حال الخطأ، ستومض العقدة باللون الأحمر — صحّح واستمر.",
        "العنصر التالي المطلوب معروض دائماً في أعلى الشاشة. ابقَ يقظاً!",
      ],
      exampleLabel: "مثال",
      example: [
        "الجزء أ: 1 ← 2 ← 3 ← 4 ← 5 …",
        "الجزء ب: 1 ← A ← 2 ← B ← 3 ← C …",
      ],
      durationLabel: "المدة",
      duration: "~6 دقائق · الجزء أ + الجزء ب (يشمل التدريب)",
      startButton: "ابدأ الاختبار",
      rereadButton: "إعادة القراءة",
      progressLabel: (c, t) => `الاختبار ${c} من ${t}`,
      countdownLabel: "التحضير…",
      waitHint: (s) => `خذ وقتك للقراءة جيداً (${s}ث)`,
    },
  },
};

/**
 * Gentle yoga pose library.
 *
 * Pose names, Sanskrit names, and expertise levels are factual metadata from the
 * public `omergoshen/yoga_poses` dataset (Hugging Face). That dataset ships no
 * license and its photos are Pocket Yoga's copyrighted artwork, so no images
 * are used here. Figures in this app are original hand-drawn SVG stick
 * figures, and all guidance below is original, general-wellbeing wording.
 */

export type PoseLevel = "Beginner";

export interface YogaPose {
  id: string;
  name: string;
  sanskrit: string;
  level: PoseLevel;
  guidance: string[];
  alternative: string;
  /** Joint coordinates in a 200 x 200 viewBox (ground around y=170). */
  joints: Record<string, [number, number]>;
  guidanceEs?: string[];
  guidanceFr?: string[];
  guidanceAr?: string[];
  alternativeEs?: string;
  alternativeFr?: string;
  alternativeAr?: string;
}

export const YOGA_POSES: YogaPose[] = [
  {
    id: "mountain",
    name: "Mountain Pose",
    sanskrit: "Tadasana",
    level: "Beginner",
    guidance: [
      "Stand with feet hip-width apart, weight even on both feet.",
      "Let your arms rest by your sides, palms facing forward.",
      "Breathe slowly and feel your feet grounded, as if roots into the floor.",
    ],
    alternative: "Sit tall in a chair with feet flat on the floor instead.",
    joints: {
      head: [100, 35], neck: [100, 55],
      shoulderL: [88, 62], shoulderR: [112, 62],
      elbowL: [84, 100], elbowR: [116, 100],
      handL: [86, 138], handR: [114, 138],
      hipL: [94, 105], hipR: [106, 105],
      kneeL: [93, 140], kneeR: [107, 140],
      footL: [92, 168], footR: [108, 168],
    },
    guidanceEs: [
              "Ponte de pie con los pies a la altura de las caderas y el peso repartido.",
              "Deja los brazos a los lados, con las palmas hacia adelante.",
              "Respira despacio y siente los pies arraigados, como raíces en el suelo.",
            ],
  guidanceFr: [
              "Debout, pieds à hauteur des hanches, poids réparti.",
              "Laissez les bras le long du corps, paumes vers l'avant.",
              "Respirez lentement et sentez vos pieds enracinés, comme des racines dans le sol.",
            ],
  guidanceAr: [
              "قف بوقوف مع قدمين بعرض الوركين والوزن موزّع بشكل متساوٍ.",
              "اترك ذراعيك بجانب جسدك مع توجيه راحتي يديك إلى الأمام.",
              "تنفس ببطء واشعر بقدميك ثابتتين كالجذور في الأرض.",
            ],
  alternativeEs: "Siéntate erguido en una silla con los pies planos en el suelo.",
  alternativeFr: "Asseyez-vous bien droit sur une chaise, pieds à plat au sol.",
  alternativeAr: "اجلس مستقيما على كرسي مع قدمين مسطحتين على الأرض.",},
  {
    id: "tree",
    name: "Tree Pose",
    sanskrit: "Vrikshasana",
    level: "Beginner",
    guidance: [
      "From Mountain, shift weight to one leg and rest the other foot on your inner calf or thigh, never the knee.",
      "Bring palms together at your chest, or open arms wide like branches.",
      "Keep eyes soft on a fixed spot; wobbling is normal.",
    ],
    alternative: "Stand beside a wall or chair for support, or keep one foot on the floor.",
    joints: {
      head: [100, 38], neck: [100, 56],
      shoulderL: [88, 63], shoulderR: [112, 63],
      elbowL: [92, 85], elbowR: [108, 85],
      handL: [100, 74], handR: [100, 74],
      hipL: [94, 105], hipR: [106, 105],
      kneeL: [93, 140], kneeR: [128, 115],
      footL: [92, 168], footR: [102, 110],
    },
    guidanceEs: [
              "Desde la postura de la montaña, pasa el peso a una pierna y apoya el otro pie en la pantorrilla o el muslo interior, nunca en la rodilla.",
              "Junta las palmas frente al pecho, o abre los brazos como ramas.",
              "Mantén la mirada suave en un punto fijo; tambalearse es normal.",
            ],
  guidanceFr: [
              "Depuis la posture de la montagne, transférez le poids sur une jambe et posez l'autre pied contre le mollet ou l'intérieur de la cuisse, jamais le genou.",
              "Joignez les paumes devant la poitrine, ou ouvrez les bras comme des branches.",
              "Gardez le regard doux sur un point fixe ; vaciller est normal.",
            ],
  guidanceAr: [
              "من وضعية الجبل، انقل وزنك إلى ساق واحدة وضع القدم الأخرى على باطن الساق أو الفخذ الداخلي، وليس الركبة أبداً.",
              "اجمع راحتي يديك أمام صدرك، أو افتح ذراعيك كأغصان.",
              "أبقِ نظرك ناعماً على نقطة ثابتة؛ التمايل طبيعي.",
            ],
  alternativeEs: "Apóyate en una pared o silla, o mantén un pie en el suelo.",
  alternativeFr: "Appuyez-vous contre un mur ou une chaise, ou gardez un pied au sol.",
  alternativeAr: "استند إلى جدار أو كرسي، أو أبقِ قدماً واحدة على الأرض.",},
  {
    id: "chair",
    name: "Chair Pose",
    sanskrit: "Utkatasana",
    level: "Beginner",
    guidance: [
      "Feet together, arms reaching up with palms facing each other.",
      "Sit your hips back and down as if lowering onto an invisible chair, knees together.",
      "Keep breathing; use only the depth that feels comfortable.",
    ],
    alternative: "Do a shallow version while holding a chair for support.",
    joints: {
      head: [100, 45], neck: [100, 63],
      shoulderL: [88, 70], shoulderR: [112, 70],
      elbowL: [84, 38], elbowR: [116, 38],
      handL: [83, 12], handR: [117, 12],
      hipL: [92, 108], hipR: [108, 108],
      kneeL: [85, 135], kneeR: [115, 135],
      footL: [95, 168], footR: [105, 168],
    },
    guidanceEs: [
              "Pies juntos y brazos hacia arriba con las palmas enfrentadas.",
              "Siéntate hacia atrás y abajo como si te sentaras en una silla invisible, con las rodillas juntas.",
              "Sigue respirando; usa solo la profundidad que te resulte cómoda.",
            ],
  guidanceFr: [
              "Pieds ensemble, bras levés paumes face à face.",
              "Asseyez vos hanches vers l'arrière et le bas comme sur une chaise invisible, genoux joints.",
              "Continuez de respirer ; n'allez que dans la profondeur confortable.",
            ],
  guidanceAr: [
              "القدمون معاً والذراعان مرفوعتان للأعلى والراحتان متقابلتان.",
              "اجلس بوركيك للخلف وللأسفل كأنك تجلس على كرسي خفي، والركبتان معاً.",
              "واصل التنفس؛ واستخدم فقط العمق المريح لك.",
            ],
  alternativeEs: "Haz una versión somera apoyándote en una silla.",
  alternativeFr: "Faites une version peu profonde en vous tenant à une chaise.",
  alternativeAr: "قم بنسخة ضحلة مع الاستناد إلى كرسي.",},
  {
    id: "warrior2",
    name: "Warrior II",
    sanskrit: "Virabhadrasana B",
    level: "Beginner",
    guidance: [
      "Step feet wide; turn the front foot out and bend the front knee slightly.",
      "Extend arms at shoulder height, gaze over the front hand.",
      "Breathe steadily and keep the torso upright.",
    ],
    alternative: "Keep the front leg straight, or narrow the stance.",
    joints: {
      head: [118, 40], neck: [115, 57],
      shoulderL: [125, 64], shoulderR: [105, 64],
      elbowL: [150, 64], elbowR: [80, 64],
      handL: [168, 64], handR: [62, 64],
      hipL: [112, 105], hipR: [96, 105],
      kneeL: [138, 135], kneeR: [78, 140],
      footL: [150, 168], footR: [60, 168],
    },
    guidanceEs: [
              "Separa los pies; gira el pie delantero hacia afuera y flexiona ligeramente la rodilla delantera.",
              "Extiende los brazos a la altura de los hombros y mira sobre la mano delantera.",
              "Respira con calma y mantén el torso erguido.",
            ],
  guidanceFr: [
              "Écartez les pieds ; tournez le pied avant vers l'extérieur et pliez légèrement le genou avant.",
              "Étendez les bras à hauteur d'épaules et regardez au-delà de la main avant.",
              "Respirez régulièrement et gardez le buste droit.",
            ],
  guidanceAr: [
              "باعد بين القدمين؛ أدِر القدم الأمامية إلى الخارج واثنِ الركبة الأمامية قليلاً.",
              "مدّ ذراعيك على ارتفاع الكتفين وانظر إلى ما بعد اليد الأمامية.",
              "تنفس بثبات وحافظ على جذعك عمودياً.",
            ],
  alternativeEs: "Mantén la pierna delantera recta o acorta la postura.",
  alternativeFr: "Gardez la jambe avant tendue ou resserrez l'écartement.",
  alternativeAr: "أبقِ الساق الأمامية مستقيمة أو قلّل المسافة بين القدمين.",},
  {
    id: "triangle",
    name: "Triangle Pose",
    sanskrit: "Utthita Trikonasana",
    level: "Beginner",
    guidance: [
      "From Warrior II, straighten the front leg and reach toward the front shin, ankle, or a block.",
      "Open the chest toward the ceiling and extend the upper arm skyward.",
      "If you feel dizzy, return to standing and skip this pose.",
    ],
    alternative: "Rest the front hand on your thigh or a chair instead of reaching down.",
    joints: {
      head: [120, 70], neck: [112, 86],
      shoulderL: [104, 92], shoulderR: [104, 92],
      elbowL: [122, 120], elbowR: [85, 70],
      handL: [135, 150], handR: [72, 45],
      hipL: [100, 110], hipR: [100, 110],
      kneeL: [140, 140], kneeR: [72, 140],
      footL: [152, 168], footR: [55, 168],
    },
    guidanceEs: [
              "Desde el guerrero II, estira la pierna delantera y alcanza la espinilla, el tobillo o un bloque.",
              "Abre el pecho hacia el techo y extiende el brazo superior hacia el cielo.",
              "Si te mareas, vuelve a ponerte de pie y omite esta postura.",
            ],
  guidanceFr: [
              "Depuis Guerrier II, tendez la jambe avant et descendez vers le tibia, la cheville ou une brique.",
              "Ouvrez la poitrine vers le plafond et levez le bras supérieur vers le ciel.",
              "Si vous avez le tournis, revenez debout et sautez cette posture.",
            ],
  guidanceAr: [
              "من وضعية المحارب الثاني، افرد الساق الأمامية ومدّ يدك نحو الساق أو الكاحل أو قطعة دعم.",
              "افتح صدرك نحو السقف ومدّ الذراع العلوية نحو السماء.",
              "إذا شعرت بالدوخة، عُد إلى الوقوف وتخطَّ هذه الوضعية.",
            ],
  alternativeEs: "Apoya la mano delantera en el muslo o en una silla en lugar de bajar.",
  alternativeFr: "Posez la main avant sur la cuisse ou une chaise au lieu de descendre.",
  alternativeAr: "ضع اليد الأمامية على الفخذ أو كرسي بدلاً من النزول.",},
  {
    id: "side-angle",
    name: "Extended Side Angle",
    sanskrit: "Utthita Parshvakonasana",
    level: "Beginner",
    guidance: [
      "From Warrior II, bring the front forearm onto the front thigh.",
      "Reach the top arm over the ear to lengthen the side of the body.",
      "Keep the chest open and breathe slowly.",
    ],
    alternative: "Keep the top hand on your hip instead of reaching over the ear.",
    joints: {
      head: [118, 78], neck: [110, 92],
      shoulderL: [102, 98], shoulderR: [102, 98],
      elbowL: [128, 125], elbowR: [82, 80],
      handL: [106, 132], handR: [66, 96],
      hipL: [100, 110], hipR: [100, 110],
      kneeL: [138, 136], kneeR: [74, 140],
      footL: [150, 168], footR: [58, 168],
    },
    guidanceEs: [
              "Desde el guerrero II, lleva el antebrazo delantero sobre el muslo delantero.",
              "Estira el brazo superior sobre la oreja para alargar el costado del cuerpo.",
              "Mantén el pecho abierto y respira despacio.",
            ],
  guidanceFr: [
              "Depuis Guerrier II, posez l'avant-bras avant sur la cuisse avant.",
              "Étirez le bras supérieur au-dessus de l'oreille pour allonger le flanc.",
              "Gardez la poitrine ouverte et respirez lentement.",
            ],
  guidanceAr: [
              "من وضعية المحارب الثاني، ضع الساعد الأمامي على الفخذ الأمامي.",
              "مدّ الذراع العلوية فوق الأذن لإطالة جانب الجسد.",
              "أبقِ الصدر مفتوحاً وتنفس ببطء.",
            ],
  alternativeEs: "Mantén la mano superior en la cadera en lugar de estirarla sobre la oreja.",
  alternativeFr: "Gardez la main supérieure sur la hanche au lieu de l'étirer au-dessus de l'oreille.",
  alternativeAr: "أبقِ اليد العلوية على الورك بدلاً من مدّها فوق الأذن.",},
  {
    id: "forward-bend",
    name: "Standing Forward Bend",
    sanskrit: "Uttanasana",
    level: "Beginner",
    guidance: [
      "Stand with feet hip-width apart and bend forward from the hips, not the waist.",
      "Let your arms hang loosely and your head rest — gently nodding 'yes' and 'no' is fine.",
      "Keep knees soft; come up slowly if you feel light-headed.",
    ],
    alternative: "Place hands on your thighs and keep the fold shallow.",
    joints: {
      head: [100, 122], neck: [100, 105],
      shoulderL: [90, 112], shoulderR: [110, 112],
      elbowL: [92, 140], elbowR: [108, 140],
      handL: [94, 166], handR: [106, 166],
      hipL: [95, 72], hipR: [105, 72],
      kneeL: [94, 120], kneeR: [106, 120],
      footL: [92, 168], footR: [108, 168],
    },
    guidanceEs: [
              "De pie con los pies a la altura de las caderas, inclínate hacia adelante desde las caderas, no desde la cintura.",
              "Deja que los brazos cuelguen y la cabeza descanse — asentir suavemente está bien.",
              "Mantén las rodillas suaves; incorpórate despacio si te mareas.",
            ],
  guidanceFr: [
              "Debout, pieds à hauteur des hanches, penchez-vous depuis les hanches, pas depuis la taille.",
              "Laissez les bras pendre et la tête se reposer — hocher doucement la tête est ok.",
              "Gardez les genoux souples ; remontez lentement si vous avez la tête qui tourne.",
            ],
  guidanceAr: [
              "قف بوقوف مع قدمين بعرض الوركين وانحناءِ من الوركين لا من الخصر.",
              "دع ذراعيك تتدليان ورأسك يستريح — تحريك الرأس بلطف لا بأس به.",
              "أبقِ الركبتين مرنتين؛ وانهض ببطء إذا شعرت بالدوار.",
            ],
  alternativeEs: "Apoya las manos en los muslos y mantén la inclinación ligera.",
  alternativeFr: "Posez les mains sur les cuisses et gardez la flexion légère.",
  alternativeAr: "ضع يديك على فخذيك وحافظ على انحناء خفيف.",},
  {
    id: "easy-seated",
    name: "Easy Seated Pose",
    sanskrit: "Sukhasana",
    level: "Beginner",
    guidance: [
      "Sit on the floor or a cushion and cross your legs loosely.",
      "Rest hands on your knees and let the spine lengthen gently.",
      "This is a rest pose — stay as long as you like and breathe.",
    ],
    alternative: "Sit in a chair with feet flat — same breathing, same calm.",
    joints: {
      head: [100, 60], neck: [100, 80],
      shoulderL: [86, 86], shoulderR: [114, 86],
      elbowL: [80, 112], elbowR: [120, 112],
      handL: [88, 132], handR: [112, 132],
      hipL: [96, 140], hipR: [104, 140],
      kneeL: [60, 155], kneeR: [140, 155],
      footL: [108, 162], footR: [92, 162],
    },
    guidanceEs: [
              "Siéntate en el suelo o en un cojín y cruza las piernas sin forzar.",
              "Apoya las manos en las rodillas y deja que la columna se alargue suavemente.",
              "Esta es una postura de descanso — quédate todo lo que quieras y respira.",
            ],
  guidanceFr: [
              "Asseyez-vous au sol ou sur un coussin et croisez les jambes sans forcer.",
              "Posez les mains sur les genoux et laissez la colonne s'allonger doucement.",
              "C'est une posture de repos — restez aussi longtemps que vous voulez et respirez.",
            ],
  guidanceAr: [
              "اجلس على الأرض أو على وسادة وقم بترتيب ساقيك دون إجهاد.",
              "ضع يديك على ركبتيك ودع العمود الفقري يطول بلطف.",
              "هذه وضعية راحة — ابقَ كما تشاء وتنفس.",
            ],
  alternativeEs: "Siéntate en una silla con los pies planos — la misma respiración, la misma calma.",
  alternativeFr: "Asseyez-vous sur une chaise, pieds à plat — même respiration, même calme.",
  alternativeAr: "اجلس على كرسي مع قدمين مسطحتين — نفس التنفس ونفس الهدوء.",},
  {
    id: "bound-angle",
    name: "Bound Angle Pose",
    sanskrit: "Baddha Konasana",
    level: "Beginner",
    guidance: [
      "Seated, bring the soles of your feet together and let knees fall open.",
      "Hold your feet or ankles lightly and sit tall.",
      "Let the outer thighs soften downward; never force the knees.",
    ],
    alternative: "Place cushions under your knees for support.",
    joints: {
      head: [100, 64], neck: [100, 82],
      shoulderL: [86, 88], shoulderR: [114, 88],
      elbowL: [80, 115], elbowR: [120, 115],
      handL: [100, 130], handR: [100, 130],
      hipL: [96, 142], hipR: [104, 142],
      kneeL: [68, 150], kneeR: [132, 150],
      footL: [100, 142], footR: [100, 142],
    },
    guidanceEs: [
              "Sentado, junta las plantas de los pies y deja caer las rodillas hacia afuera.",
              "Sujeta los pies o tobillos con suavidad y mantente erguido.",
              "Deja que los muslos externos se relajen hacia abajo; nunca fuerces las rodillas.",
            ],
  guidanceFr: [
              "Assis, joignez les plantes des pieds et laissez les genoux s'ouvrir.",
              "Tenez doucement vos pieds ou chevilles et gardez-vous droit.",
              "Laissez les cuisses externes se relâcher vers le bas ; ne forcez jamais les genoux.",
            ],
  guidanceAr: [
              "جالساً، اجمع باطني قدميك ودع ركبتيك تفتحان للخارج.",
              "أمسك قدميك أو كاحليك بلطف واجلس مستقيماً.",
              "دع الفخذين الخارجيين يسترخيان للأسفل؛ لا تُجبر الركبتين أبداً.",
            ],
  alternativeEs: "Coloca cojines bajo las rodillas para apoyarte.",
  alternativeFr: "Placez des coussins sous vos genoux pour soutenir.",
  alternativeAr: "ضع وسائد تحت ركبتيك للدعم.",},
  {
    id: "childs",
    name: "Child's Pose",
    sanskrit: "Balasana",
    level: "Beginner",
    guidance: [
      "Kneel and sit back toward your heels, then fold forward.",
      "Extend arms forward and rest your forehead on the floor or a cushion.",
      "Breathe into your back; this is a resting pose, not a stretch to push.",
    ],
    alternative: "Use a pillow under your torso, or stay seated and fold only a little.",
    joints: {
      head: [62, 142], neck: [76, 138],
      shoulderL: [86, 136], shoulderR: [86, 136],
      elbowL: [116, 138], elbowR: [116, 138],
      handL: [148, 140], handR: [148, 140],
      hipL: [58, 125], hipR: [58, 125],
      kneeL: [46, 122], kneeR: [46, 122],
      footL: [46, 156], footR: [46, 156],
    },
    guidanceEs: [
              "Arrodíllate y sienta tu peso hacia los talones, luego inclínate hacia adelante.",
              "Extiende los brazos hacia adelante y apoya la frente en el suelo o en un cojín.",
              "Respira hacia la espalda; esta es una postura de descanso, no un estiramiento para forzar.",
            ],
  guidanceFr: [
              "Agenouillez-vous et asseyez-vous vers vos talons, puis penchez-vous en avant.",
              "Étendez les bras devant vous et posez le front au sol ou sur un coussin.",
              "Respirez dans le dos ; c'est une posture de repos, pas un étirement à forcer.",
            ],
  guidanceAr: [
              "اركع واجلس نحو كعبيك ثم انحناءٍ للأمام.",
              "مدّ ذراعيك للأمام وأرح جبهتك على الأرض أو على وسادة.",
              "تنفس في ظهرك؛ هذه وضعية راحة لا تمدداً لتجبره.",
            ],
  alternativeEs: "Usa una almohada bajo el torso, o siéntate e inclínate solo un poco.",
  alternativeFr: "Utilisez un coussin sous le buste, ou restez assis et penchez-vous un peu.",
  alternativeAr: "استخدم وسادة تحت جذعك أو ابقَ جالساً وانحناءٍ قليلاً فقط.",},
  {
    id: "supine-twist",
    name: "Supine Spinal Twist",
    sanskrit: "Supta Matsyendrasana",
    level: "Beginner",
    guidance: [
      "Lie on your back with knees bent and feet flat.",
      "Let both knees drop gently to one side while arms open wide.",
      "Rest here and breathe; switch sides halfway through if you like.",
    ],
    alternative: "Keep the top knee propped on a cushion instead of dropping freely.",
    joints: {
      head: [40, 162], neck: [55, 160],
      shoulderL: [62, 158], shoulderR: [62, 158],
      elbowL: [86, 148], elbowR: [86, 168],
      handL: [114, 146], handR: [114, 170],
      hipL: [84, 160], hipR: [84, 160],
      kneeL: [102, 138], kneeR: [102, 138],
      footL: [120, 156], footR: [120, 156],
    },
    guidanceEs: [
              "Túmbate boca arriba con las rodillas flexionadas y los pies planos.",
              "Deja caer ambas rodillas suavemente a un lado mientras los brazos se abren.",
              "Descansa aquí y respira; cambia de lado a mitad si te gusta.",
            ],
  guidanceFr: [
              "Allongez-vous sur le dos, genoux pliés, pieds à plat.",
              "Laissez les deux genoux tomber doucement d'un côté, les bras grands ouverts.",
              "Reposez-vous ici et respirez ; changez de côté à mi-chemin si vous voulez.",
            ],
  guidanceAr: [
              "استلقِ على ظهرك مع ركبتين مثنيتين وقدمين مسطحتين.",
              "دع الركبتين تسقطان بلطف إلى جانب واحد بينما تنفتح الذراعان.",
              "استلِقِ هنا وتنفس؛ وبدّل الجانب في منتصف الطريق إذا رغبت.",
            ],
  alternativeEs: "Apoya la rodilla superior en un cojín en lugar de dejarla caer libremente.",
  alternativeFr: "Posez le genou supérieur sur un coussin au lieu de le laisser tomber librement.",
  alternativeAr: "أرح الركبة العلوية على وسادة بدلاً من إسقاطها بحرية.",},
  {
    id: "corpse",
    name: "Corpse Pose",
    sanskrit: "Shavasana",
    level: "Beginner",
    guidance: [
      "Lie flat on your back, legs long, arms resting by your sides, palms up.",
      "Let your whole body become heavy and still.",
      "Rest here and breathe without doing anything at all — this is the pose.",
    ],
    alternative: "Bend your knees with feet flat if your back feels better that way.",
    joints: {
      head: [40, 163], neck: [58, 164],
      shoulderL: [66, 158], shoulderR: [66, 168],
      elbowL: [84, 152], elbowR: [84, 174],
      handL: [102, 150], handR: [102, 176],
      hipL: [110, 164], hipR: [110, 164],
      kneeL: [128, 164], kneeR: [128, 164],
      footL: [152, 164], footR: [152, 164],
    },
    guidanceEs: [
              "Túmbate boca arriba, piernas largas, brazos junto al cuerpo, palmas hacia arriba.",
              "Deja que todo tu cuerpo se vuelva pesado e inmóvil.",
              "Descansa aquí y respira sin hacer nada — esta es la postura.",
            ],
  guidanceFr: [
              "Allongez-vous sur le dos, jambes tendues, bras le long du corps, paumes vers le haut.",
              "Laissez tout votre corps devenir lourd et immobile.",
              "Reposez-vous ici et respirez sans rien faire — c'est la posture.",
            ],
  guidanceAr: [
              "استلقِ على ظهرك، ساقاك ممدودتان، وذراعاك بجانب جسدك وراحتا يديك للأعلى.",
              "دع جسمك كله يصبح ثقيلاً وساكناً.",
              "استلِقِ هنا وتنفس دون فعل أي شيء — هذه هي الوضعية.",
            ],
  alternativeEs: "Flexiona las rodillas con los pies planos si tu espalda se siente mejor así.",
  alternativeFr: "Pliez les genoux, pieds à plat, si votre dos se sent mieux ainsi.",
  alternativeAr: "اثنِ ركبتيك مع قدمين مسطحتين إذا شعر ظهرك بتحسن هكذا.",},
];

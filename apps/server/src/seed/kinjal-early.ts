import type { SampleMemory } from './kinjal-types';

const MOM = { name: 'Mom', said: ['Mom', 'my mom', 'Mummy'], relationship: 'mother' };
const DAD = { name: 'Dad', said: ['Dad', 'my dad', 'Papa'], relationship: 'father' };
const NANI = { name: 'Nani', said: ['Nani', 'my nani'], relationship: 'grandmother' };
const ARJUN = { name: 'Arjun', said: ['Arjun', 'my brother'], relationship: 'brother' };

export const EARLY: SampleMemory[] = [
  {
    key: 'nani-garden',
    title: "Nani's tomatoes",
    raw: "okay so I was maybe four and it was summer in Gwalior at Nani's house and she had this garden behind the kitchen with tomatoes and um chillies and some other stuff I don't remember and she let me pick the tomatoes which felt like a really big deal like a grown up job. she wiped one on her do patta and gave it to me and I ate it right there, it was warm from the sun which is a weird thing to remember but I really do remember that it was warm. I felt so happy honestly and like kind of trusted",
    story:
      "I was about four, spending the summer at Nani's house in Gwalior. Behind the kitchen she had a garden with tomatoes and chillies, and she let me pick the tomatoes, which felt like a grown-up job.\n\nShe wiped one on her dupatta and handed it to me, and I ate it right there. It was still warm from the sun. It's a strange detail to keep for twenty years, but I remember it clearly, and I remember feeling happy and trusted.",
    summary:
      'Picking warm tomatoes in Nani’s garden in Gwalior, and feeling trusted with a grown-up job.',
    when: { ages: [4, 4], season: 'summer' },
    time: { kind: 'one moment', hint: 'one afternoon that summer' },
    places: ['Gwalior, India'],
    people: [{ ...NANI, role: 'central' }],
    feelings: [
      ['happy', 'then'],
      ['loved', 'then'],
      ['nostalgic', 'now'],
    ],
    themes: [['Being cared for', 'Nani trusted you with a real job and fed you from her garden.']],
    questions: [
      [
        'Do you know what else Nani grew there?',
        'Chillies for sure, and mint. She made chutney with it.',
      ],
      ['Did you go back to that garden later?', null],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 410,
  },
  {
    key: 'power-cuts',
    title: 'Antakshari in the power cuts',
    raw: "in Gurgaon the power used to go out like almost every evening in the summer, I think I was five or six, and mom would light candles and we would play antakshari, which is the song game where you sing a song starting with the last letter of the last song. mom always won because she knew like every old Hindi song and dad would pretend he didn't know any and then suddenly sing really loud. I actually loved the power cuts which is funny because everyone else hated them",
    story:
      "When I was five or six, the power in Gurgaon went out almost every summer evening. Mom would light candles and we'd play antakshari, the game where you sing a song starting with the last letter of the one before.\n\nMom always won because she knew every old Hindi song. Dad pretended he didn't know any, then suddenly sang one at full volume. Everyone else hated the power cuts. I loved them.",
    summary: 'Summer power cuts in Gurgaon, when the family played antakshari by candlelight.',
    when: { ages: [5, 6], season: 'summer' },
    time: { kind: 'kept happening', hint: 'most summer evenings for a couple of years' },
    places: ['Gurgaon, India'],
    people: [
      { ...MOM, role: 'central' },
      { ...DAD, role: 'supporting' },
    ],
    feelings: [
      ['happy', 'then'],
      ['nostalgic', 'now'],
    ],
    themes: [['Being cared for', 'Your parents turned the blackouts into a game.']],
    sourceKind: 'speech',
    recordedDaysAgo: 395,
  },
  {
    key: 'kindergarten',
    title: 'First day of school in Gurgaon',
    raw: "My first day of school was in July 2008 in Gurgaon. I had a water bottle with a cartoon elephant on it and I refused to let anyone else touch it. Ma'am Sharma had a really loud voice. I cried when Mom left but by lunch I had traded half my paratha for someone's chips so I guess I was fine.",
    story:
      "My first day of school was in July 2008 in Gurgaon. I had a water bottle with a cartoon elephant on it and wouldn't let anyone else touch it. Ma'am Sharma had a very loud voice.\n\nI cried when Mom left, but by lunch I had traded half my paratha for someone's chips, so I suppose I was fine.",
    summary:
      'Crying at the gate on the first day of school, then trading paratha for chips by lunch.',
    when: { month: '2008-07' },
    time: { kind: 'one day', hint: 'the first day of school' },
    places: ['Gurgaon, India'],
    people: [
      { ...MOM, role: 'supporting' },
      { name: 'Ma’am Sharma', said: ["Ma'am Sharma"], role: 'mentioned', relationship: 'teacher' },
    ],
    feelings: [
      ['scared', 'then'],
      ['relieved', 'then'],
    ],
    milestone: 'Started school',
    sourceKind: 'typing',
    recordedDaysAgo: 380,
  },
  {
    key: 'train-gwalior',
    title: 'The night train with Dad',
    raw: "when I was six Dad and I took the overnight train to Gwalior just the two of us because mom had work. I had the top bunk and I was so proud of that. at like five in the morning at some station Dad bought chai from the window and let me have some even though mom said I wasn't allowed and he said don't tell her. it was the first secret I had with him",
    story:
      'When I was six, Dad and I took the overnight train to Gwalior on our own because Mom had work. I had the top bunk and was very proud of it.\n\nAround five in the morning, at some station, Dad bought chai through the window and let me have some, even though Mom had said I wasn\'t allowed. "Don\'t tell her," he said. It was the first secret I had with him.',
    summary:
      'An overnight train to Gwalior with Dad, and a cup of chai that became their first secret.',
    when: { ages: [6, 6] },
    time: { kind: 'one day', hint: 'one overnight trip' },
    places: ['Gwalior, India'],
    people: [
      { ...DAD, role: 'central' },
      { ...MOM, role: 'mentioned' },
    ],
    feelings: [
      ['excited', 'then'],
      ['proud', 'then'],
      ['loved', 'now'],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 360,
  },
  {
    key: 'leaving-gurgaon',
    title: 'Leaving Gurgaon',
    raw: "we left for New York on August 14 2010, I was seven. the airport was so bright at night. Nani came to the airport from Gwalior even though her knees were bad and she held my face with both hands and didn't say anything which was scarier than if she had cried. I kept asking dad if we were coming back for Diwali and he kept saying we'll see, which I now know means no",
    story:
      "We left for New York on August 14, 2010. I was seven. The airport was very bright, even at night.\n\nNani came all the way from Gwalior even though her knees were bad. She held my face in both hands and didn't say anything, which scared me more than if she had cried. I kept asking Dad if we'd be back for Diwali. He kept saying \"we'll see,\" which I now know means no.",
    summary: 'Saying goodbye to Nani at the airport the night the family moved to New York.',
    when: { date: '2010-08-14' },
    time: { kind: 'one day', hint: 'the night we flew out' },
    places: ['Gurgaon, India', 'New York'],
    people: [
      { ...NANI, role: 'central' },
      { ...DAD, role: 'supporting' },
    ],
    feelings: [
      ['confused', 'then'],
      ['scared', 'then'],
      ['sad', 'now'],
    ],
    themes: [['Leaving home', 'The night you left India and Nani behind.']],
    milestone: 'Moved to New York',
    sourceKind: 'speech',
    recordedDaysAgo: 350,
  },
  {
    key: 'first-snow',
    title: 'First snow in Queens',
    raw: "the first time I saw snow was the day after Christmas 2010, there was a huge blizzard in Queens and the snow was taller than me by the car. Dad didn't have proper boots so he wore plastic bags over his shoes and we laughed so hard. I ate snow and it tasted like nothing which was disappointing",
    story:
      "I saw snow for the first time the day after Christmas in 2010. A huge blizzard hit Queens, and the drift by our car was taller than me.\n\nDad didn't have proper boots, so he wore plastic bags over his shoes, and we laughed until we couldn't breathe. I ate some snow. It tasted like nothing, which was disappointing.",
    summary:
      'The blizzard of 2010 in Queens, Dad in plastic-bag boots, and snow that tasted like nothing.',
    when: { date: '2010-12-26' },
    time: { kind: 'one day', hint: 'the day after Christmas' },
    places: ['Queens, New York'],
    people: [{ ...DAD, role: 'central' }],
    feelings: [
      ['excited', 'then'],
      ['happy', 'then'],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 340,
  },
  {
    key: 'lunch-table',
    title: 'Nobody to sit with',
    raw: "in second grade in Queens I didn't really speak english well yet and the first few weeks I ate lunch alone at the end of the table and pretended to read the back of my juice box. then a girl named Mei sat across from me and just started talking about her hamster like we were already friends. I didn't understand half of it but I nodded a lot",
    story:
      "In second grade in Queens my English wasn't good yet. For the first few weeks I ate lunch alone at the end of the table and pretended to read the back of my juice box.\n\nThen a girl named Mei sat down across from me and started talking about her hamster as if we were already friends. I understood maybe half of it, but I nodded a lot.",
    summary: 'Eating lunch alone in a new country until Mei sat down and started talking.',
    when: { ages: [7, 7], season: 'autumn' },
    time: { kind: 'weeks or months', hint: 'the first weeks of second grade' },
    places: ['Queens, New York'],
    people: [{ name: 'Mei', said: ['Mei'], role: 'central', relationship: 'friend' }],
    feelings: [
      ['lonely', 'then'],
      ['relieved', 'then'],
      ['grateful', 'now'],
    ],
    themes: [['Belonging', 'Mei made room for you before you had the words.']],
    sourceKind: 'typing',
    recordedDaysAgo: 330,
  },
  {
    key: 'short-hair',
    title: 'The short hair years',
    raw: 'from like age nine to twelve mom kept my hair really short, she took me to the cheap place on Roosevelt every month because it was easier for her with work and Arjun being a baby. I hated it. kids at school asked if I was a boy and I started wearing a hairband to look more like a girl which made it worse. I asked to grow it out maybe a hundred times and the answer was always when you can take care of it yourself. I get it now, she was exhausted, but I still kind of wish she had let me try',
    story:
      'From about nine to twelve, Mom kept my hair very short. Every month she took me to the cheap salon on Roosevelt Avenue, because it was easier with her work and Arjun still a baby.\n\nI hated it. Kids at school asked if I was a boy, so I started wearing a hairband to look more like a girl, which only made it worse. I must have asked to grow it out a hundred times, and the answer was always "when you can take care of it yourself."\n\nI understand now that she was exhausted. I still wish she had let me try.',
    summary:
      'Years of monthly haircuts Kinjal didn’t want, and asking again and again to grow it out.',
    when: { ages: [9, 12] },
    time: { kind: 'kept happening', hint: 'every month for about three years' },
    places: ['Queens, New York'],
    people: [
      { ...MOM, role: 'central' },
      { ...ARJUN, role: 'mentioned' },
    ],
    feelings: [
      ['embarrassed', 'then'],
      ['frustrated', 'then'],
      ['resentful', 'now'],
    ],
    themes: [
      ['Wanting control over my own body', 'You asked over and over to choose your own hair.'],
      ['Feeling unheard', 'The answer never changed, however you asked.'],
    ],
    questions: [
      [
        'When did you finally grow it out?',
        'The summer before eighth grade, after we moved. Mom just stopped booking the appointments.',
      ],
      ['Have you ever talked to your mom about it?', null],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 120,
  },
  {
    key: 'holding-arjun',
    title: 'Holding Arjun',
    raw: "Arjun was born on June 2 2012 really early in the morning, like five am. Dad woke me up and drove me to the hospital still in my pajamas. when I held him he grabbed my finger and didn't let go and I decided right then I was going to be the best big sister",
    story:
      "Arjun was born on June 2, 2012, around five in the morning. Dad woke me and drove me to the hospital still in my pajamas.\n\nWhen I held him, he grabbed my finger and didn't let go. I decided right then that I was going to be the best big sister.",
    summary: 'Meeting her baby brother Arjun at five in the morning, still in pajamas.',
    when: { date: '2012-06-02' },
    time: { kind: 'one moment', hint: 'early that morning' },
    places: ['Queens, New York'],
    people: [
      { ...ARJUN, role: 'central' },
      { ...DAD, role: 'supporting' },
    ],
    feelings: [
      ['happy', 'then'],
      ['proud', 'then'],
    ],
    milestone: 'My brother Arjun was born',
    sourceKind: 'speech',
    recordedDaysAgo: 300,
  },
  {
    key: 'quiet-house',
    title: 'The quiet house',
    raw: "that same night the house felt weird. mom and dad stayed at the hospital and our neighbour aunty Mehta stayed with me and made khichdi. I was kind of confused about where I fit now and I didn't get why I felt left out on such a good day",
    story:
      "That night the house felt strange. Mom and Dad stayed at the hospital, and our neighbour, Mehta Aunty, stayed with me and made khichdi.\n\nI was confused about where I fit now, and I didn't understand why I felt left out on such a good day.",
    summary: 'The night after Arjun was born, feeling left out on a happy day.',
    when: { date: '2012-06-02' },
    time: { kind: 'one day', hint: 'that night' },
    places: ['Queens, New York'],
    people: [
      {
        name: 'Mehta Aunty',
        said: ['aunty Mehta', 'Mehta Aunty'],
        role: 'supporting',
        relationship: 'neighbour',
      },
      { ...MOM, role: 'mentioned' },
      { ...DAD, role: 'mentioned' },
    ],
    feelings: [
      ['confused', 'then'],
      ['lonely', 'then'],
    ],
    themes: [['Belonging', 'You wondered where you fit once the baby arrived.']],
    sourceKind: 'speech',
    recordedDaysAgo: 298,
  },
  {
    key: 'sandy',
    title: 'Hurricane Sandy',
    raw: 'when Sandy hit in october 2012 our power was out for four days. Arjun was a tiny baby and mom was so stressed about keeping him warm. dad filled the bathtub with water and we all slept in the living room under every blanket we had. I read Harry Potter with a flashlight and honestly it was kind of the best',
    story:
      'When Hurricane Sandy hit in October 2012, our power was out for four days. Arjun was a tiny baby and Mom was frantic about keeping him warm. Dad filled the bathtub with water and we all slept in the living room under every blanket we owned.\n\nI read Harry Potter by flashlight. Honestly, it was kind of the best.',
    summary:
      'Four days without power during Hurricane Sandy, reading by flashlight under every blanket.',
    when: { date: '2012-10-29' },
    time: { kind: 'a few days', hint: 'four days without power' },
    places: ['Queens, New York'],
    people: [
      { ...MOM, role: 'supporting' },
      { ...DAD, role: 'supporting' },
      { ...ARJUN, role: 'mentioned' },
    ],
    feelings: [
      ['peaceful', 'then'],
      ['nostalgic', 'now'],
    ],
    sound: 'rain',
    soundCaption: 'Wind and rain that week',
    sourceKind: 'speech',
    recordedDaysAgo: 290,
  },
  {
    key: 'dad-job',
    title: 'The winter Dad lost his job',
    raw: "I was ten so it was 2013 and dad lost his job at the logistics company. I only knew because I heard him on the phone with Nani at night in Hindi saying it's fine it's fine like five times. the next morning he made us pancakes like it was a weekend. later he told me failing isn't the end, quitting is the end. I didn't really get it, I thought he was talking about tests",
    story:
      'In the winter of 2013, when I was ten, Dad lost his job at the logistics company. I only knew because I heard him on the phone with Nani late at night, saying "it\'s fine, it\'s fine" in Hindi, five or six times.\n\nThe next morning he made us pancakes as if it were a weekend. Later he told me, "Failing isn\'t the end. Quitting is the end." I didn\'t really understand. I thought he was talking about tests.',
    summary:
      'Overhearing Dad after he lost his job, and his line that failing isn’t the end, quitting is.',
    when: { ages: [10, 10], season: 'winter' },
    time: { kind: 'weeks or months', hint: 'that winter' },
    places: ['Queens, New York'],
    people: [
      { ...DAD, role: 'central' },
      { ...NANI, role: 'mentioned' },
    ],
    feelings: [
      ['confused', 'then'],
      ['scared', 'then'],
      ['grateful', 'now'],
    ],
    themes: [['Family expectations', 'Dad kept a brave face so the family wouldn’t worry.']],
    questions: [
      [
        'How long was he out of work?',
        'About five months. He drove for a delivery company for a while.',
      ],
      [
        'Did that line about failing stay with you?',
        'Yes, but I only really understood it in college.',
      ],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 150,
  },
  {
    key: 'recital',
    title: 'Freezing at the recital',
    raw: "my piano recital when I was eleven, May 2014. Mrs Okafor gave me a Clementi sonatina which I could play fine at home. but on stage I saw dad in the second row with his phone held up recording and I just froze in the middle, like my hands knew it but my brain went white. I started the line again twice. people clapped anyway and that was almost worse. Mrs Okafor said everyone freezes once, it means you care. I didn't play in front of anyone for a long time after",
    story:
      "My piano recital was in May 2014, when I was eleven. Mrs. Okafor had given me a Clementi sonatina that I could play fine at home.\n\nOn stage, I saw Dad in the second row holding his phone up to record, and I froze in the middle of the piece. My hands knew it, but my mind went blank. I restarted the line twice. People clapped anyway, which was almost worse.\n\nAfterwards Mrs. Okafor said everyone freezes once, and that it means you care. I didn't play in front of anyone for a long time after that.",
    summary: 'Freezing mid-piece at a piano recital with Dad filming from the second row.',
    when: { date: '2014-05-17' },
    time: { kind: 'one moment', hint: 'a few seconds on stage' },
    places: ['Queens, New York'],
    people: [
      {
        name: 'Mrs. Okafor',
        said: ['Mrs Okafor', 'Mrs. Okafor'],
        role: 'supporting',
        relationship: 'piano teacher',
      },
      { ...DAD, role: 'supporting' },
    ],
    feelings: [
      ['nervous', 'then'],
      ['embarrassed', 'then'],
    ],
    themes: [['Facing a fear', 'Being watched made your mind go blank.']],
    sound: 'piano',
    soundCaption: 'The sonatina, practised at home',
    sourceKind: 'speech',
    recordedDaysAgo: 260,
  },
  {
    key: 'promise',
    title: "Mom's promise",
    raw: "Um, so in sixth grade, around age 12, summer vacation had just started. I finished all my assignments in four days because Mom promised she'd take us somewhere. Then Mom said we weren't going anywhere. I felt so hurt and I argued with Mom.",
    story:
      "In sixth grade, when I was about twelve, summer vacation had just started. I finished all my assignments in four days because Mom had promised to take us somewhere.\n\nThen she said we weren't going anywhere. I felt so hurt, and I argued with her.",
    summary: 'Rushing through summer homework for a promised trip that never happened.',
    when: { ages: [12, 12], season: 'summer' },
    time: { kind: 'a few days', hint: 'the start of summer break' },
    places: ['Queens, New York'],
    people: [{ ...MOM, role: 'central' }],
    feelings: [
      ['disappointed', 'then'],
      ['hurt', 'then'],
      ['angry', 'then'],
    ],
    themes: [['Feeling unheard', 'You did your part and the plan fell through anyway.']],
    sourceKind: 'speech',
    recordedDaysAgo: 220,
  },
];

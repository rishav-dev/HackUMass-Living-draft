export interface SampleMemory {
  key: string;
  title?: string;
  text: string;
  date?: string;
  place?: string;
  sourceKind: 'speech' | 'typing';
  sound?: 'piano' | 'ocean' | 'rain' | 'fire';
  soundCaption?: string;
  milestone?: string;
  sensitive?: boolean;
  recordedDaysAgo: number;
  retellings?: Array<{ text: string; mode: 'addition' | 'retelling'; recordedDaysAgo: number }>;
}

export const SAMPLE_PASSPHRASE = 'kinjal-demo';

export const SAMPLE_PROFILE = {
  preferredName: 'Kinjal',
  currentAge: 23,
  birthDate: '2003-04-18',
  hemisphere: 'north' as const,
  narrativeVoice: 'first' as const,
};

export const SAMPLE_PLACE = {
  placeName: 'Amherst, Massachusetts',
  placeLat: 42.4,
  placeLon: -72.5,
  weatherOn: true,
};

export const SAMPLE_MILESTONES = [
  { title: 'Started kindergarten', ageMin: 5, ageMax: 5 },
  { title: 'My brother Arjun was born', ageMin: 9, ageMax: 9 },
  { title: 'High school graduation', ageMin: 18, ageMax: 18 },
  { title: 'First apartment', ageMin: 21, ageMax: 21 },
  { title: 'First real job', ageMin: 22, ageMax: 22 },
];

export const SAMPLE_MEMORIES: SampleMemory[] = [
  {
    key: 'garden',
    title: "Nani's garden",
    text: 'When I was four, Nani let me pick tomatoes in her garden. She wiped the dirt off on her dupatta and let me eat one right there, still warm from the sun. I remember feeling so happy, and kind of grown up.',
    sourceKind: 'speech',
    recordedDaysAgo: 210,
  },
  {
    key: 'kindergarten',
    title: 'First day of kindergarten',
    text: 'My first day of kindergarten was in September 2008. Ms. Alvarez had a yellow dress and a class hamster named Biscuit. I cried when Mom left, but by lunch I was fine.',
    date: '2008-09-02',
    place: 'Edison, New Jersey',
    sourceKind: 'typing',
    milestone: 'Started kindergarten',
    recordedDaysAgo: 205,
  },
  {
    key: 'kindergarten-bus',
    title: 'The yellow bus home',
    text: 'On the bus home I sat right behind the driver and he let me ring the bell at my stop. I felt so proud I told everyone at dinner twice.',
    date: '2008-09-02',
    place: 'Edison, New Jersey',
    sourceKind: 'speech',
    recordedDaysAgo: 204,
  },
  {
    key: 'bike',
    title: 'Learning to ride',
    text: 'I was six. Dad ran behind my bike holding the seat and then he let go without telling me. I rode all the way to the corner before I noticed. I was so proud, and a little scared once I realized.',
    sourceKind: 'speech',
    recordedDaysAgo: 190,
  },
  {
    key: 'lunch',
    title: 'The lunch table',
    text: "I was eight or nine. Nobody would sit with me at lunch that year, so I ate alone by the windows. I counted the ceiling tiles so I didn't have to look at anyone. I felt so lonely.",
    sourceKind: 'typing',
    recordedDaysAgo: 160,
  },
  {
    key: 'arjun-morning',
    title: 'Five in the morning',
    text: "Dad woke me up at five in the morning to tell me my little brother Arjun was born. I was so excited I couldn't sit still in the car, and I kept asking if he had hair.",
    date: '2012-06-02',
    place: 'Edison, New Jersey',
    sourceKind: 'speech',
    milestone: 'My brother Arjun was born',
    recordedDaysAgo: 150,
  },
  {
    key: 'arjun-hospital',
    title: 'Holding Arjun',
    text: 'At the hospital Nani let me hold Arjun. He was tiny and red and he grabbed my finger and would not let go. I was so happy I cried a little, and nobody laughed at me.',
    date: '2012-06-02',
    place: 'Edison, New Jersey',
    sourceKind: 'speech',
    recordedDaysAgo: 149,
  },
  {
    key: 'arjun-night',
    title: 'The quiet house',
    text: "That night the house felt strange. Mom and Dad stayed at the hospital and Nani made me khichdi. I was a little confused about where I'd fit now, and I didn't understand why I felt left out on such a good day.",
    date: '2012-06-02',
    place: 'Edison, New Jersey',
    sourceKind: 'typing',
    recordedDaysAgo: 148,
  },
  {
    key: 'wish',
    title: 'Drawing the ocean',
    text: "When I was ten I drew the ocean every single day. I had never seen it. I wished I could see the ocean for real someday, and I told Nani I'd take her with me.",
    sourceKind: 'speech',
    recordedDaysAgo: 140,
  },
  {
    key: 'storm',
    title: 'The ice storm',
    text: 'The winter I was ten an ice storm knocked the power out for three days. We slept in the living room by the fireplace. The whole house was calm and quiet, honestly so peaceful.',
    date: '2014-01-05',
    place: 'Edison, New Jersey',
    sourceKind: 'speech',
    sound: 'fire',
    soundCaption: 'What the fire sounded like, as close as I can get',
    recordedDaysAgo: 120,
  },
  {
    key: 'storm-stories',
    title: 'Ghost stories in the dark',
    text: 'Later that night Dad told ghost stories by the fire and Arjun fell asleep on my lap. I was scared and laughing at the same time. It was the coziest I have ever felt.',
    date: '2014-01-05',
    place: 'Edison, New Jersey',
    sourceKind: 'speech',
    recordedDaysAgo: 119,
  },
  {
    key: 'promise',
    text: "Um, so in sixth grade, around age 12, summer vacation had just started. I finished all my assignments in four days because Mom promised she'd take us somewhere. Then Mom said we weren't going anywhere. I felt so hurt and I argued with Mom.",
    sourceKind: 'speech',
    recordedDaysAgo: 100,
  },
  {
    key: 'recital',
    text: 'At my piano recital when I was 14 I was so nervous my hands shook. Mom sat in the front row and nodded at me before I started. I forgot the middle section and just skipped to the end.',
    date: '2017-05-20',
    place: 'Edison, New Jersey',
    sourceKind: 'speech',
    sound: 'piano',
    soundCaption: 'The opening, played back from memory',
    recordedDaysAgo: 95,
    retellings: [
      {
        text: "I've thought about the recital again. I didn't forget the middle section. I skipped it on purpose because my hands were shaking too much to play it.",
        mode: 'retelling',
        recordedDaysAgo: 20,
      },
    ],
  },
  {
    key: 'recital-after',
    title: 'Mango ice cream',
    text: 'After the recital Mom took me for mango ice cream and told me she was proud of me anyway. I was so relieved I laughed the whole way home.',
    date: '2017-05-20',
    place: 'Edison, New Jersey',
    sourceKind: 'typing',
    recordedDaysAgo: 94,
  },
  {
    key: 'tryouts',
    title: 'Not making the team',
    text: "When I was 15 I didn't make the soccer team after practicing all summer. I read the list twice to be sure. I was so disappointed I didn't want to talk to anyone.",
    sourceKind: 'typing',
    recordedDaysAgo: 92,
  },
  {
    key: 'newkid',
    title: 'Lunch with Priya',
    text: 'Junior year a new girl named Priya was eating alone at lunch, so I went and sat with her and asked about her old school. We talked the whole period. We are still friends.',
    sourceKind: 'typing',
    recordedDaysAgo: 88,
  },
  {
    key: 'college',
    title: 'When Dad picked my major',
    text: 'When I was 17 Dad said I had to study engineering. I stayed quiet and nodded even though I hated the idea. I was so angry at myself afterwards.',
    sourceKind: 'speech',
    recordedDaysAgo: 80,
  },
  {
    key: 'secret',
    title: 'The secret',
    text: 'In March 2019 my best friend told everyone a secret I trusted her with. I was furious. I slammed my locker so hard it bent and I did not talk to her for a month.',
    sourceKind: 'typing',
    sensitive: true,
    recordedDaysAgo: 75,
  },
  {
    key: 'graduation',
    title: 'Graduation day',
    text: 'At my high school graduation when I was 18, Mom cried and pretended it was allergies. Dad took about a hundred photos. I felt proud and a little sad that it was over.',
    date: '2021-06-12',
    place: 'Edison, New Jersey',
    sourceKind: 'typing',
    milestone: 'High school graduation',
    recordedDaysAgo: 70,
  },
  {
    key: 'graduation-lake',
    title: 'The dock at 2 a.m.',
    text: 'That same night Priya and I drove to the lake and sat on the dock until two in the morning, talking about what came next. I was excited and scared at the same time.',
    date: '2021-06-12',
    place: 'Edison, New Jersey',
    sourceKind: 'speech',
    recordedDaysAgo: 69,
  },
  {
    key: 'ocean-drive',
    title: 'Leaving before sunrise',
    text: 'We left for Maine at four in the morning. Priya drove and I fell asleep against the window with the road humming under us. Everything felt calm and easy.',
    date: '2022-07-09',
    place: 'Cape May, New Jersey',
    sourceKind: 'speech',
    recordedDaysAgo: 61,
  },
  {
    key: 'ocean',
    title: 'Finally, the ocean',
    text: 'On July 9, 2022 I finally saw the ocean. It was louder than I imagined and so cold. I called Nani from the beach and held the phone up so she could hear the waves. I was so happy I cried, and so grateful she picked up.',
    date: '2022-07-09',
    place: 'Cape May, New Jersey',
    sourceKind: 'speech',
    sound: 'ocean',
    soundCaption: 'Waves, the way I remember them',
    recordedDaysAgo: 60,
  },
  {
    key: 'ocean-sandal',
    title: 'The stolen sandal',
    text: 'On the walk back a wave took my sandal and I had to limp to the car. Priya laughed so hard she had to sit down in the sand. I was so happy.',
    date: '2022-07-09',
    place: 'Cape May, New Jersey',
    sourceKind: 'typing',
    recordedDaysAgo: 59,
  },
  {
    key: 'apartment',
    title: 'Moving day with Mom',
    text: "When I was 21 Mom drove four hours to help me move into my first apartment. She brought her own drill and put up all my shelves. I was so grateful, and I don't think I said it enough.",
    date: '2024-08-17',
    place: 'Amherst, Massachusetts',
    sourceKind: 'speech',
    milestone: 'First apartment',
    recordedDaysAgo: 45,
  },
  {
    key: 'apartment-pizza',
    title: 'Pizza on the floor',
    text: 'We ate pizza on the floor because there was no table yet. Mom fell asleep sitting up against the boxes. I miss that night, it was happy in a tired way.',
    date: '2024-08-17',
    place: 'Amherst, Massachusetts',
    sourceKind: 'typing',
    recordedDaysAgo: 44,
  },
  {
    key: 'apartment-alone',
    title: 'The first night alone',
    text: 'When Mom left, the apartment was so quiet I could hear the fridge. I cried a little, and then I unpacked everything until three. Lonely, but proud of myself.',
    date: '2024-08-17',
    place: 'Amherst, Massachusetts',
    sourceKind: 'speech',
    sound: 'rain',
    soundCaption: 'It rained all night',
    recordedDaysAgo: 43,
  },
  {
    key: 'raise',
    title: 'Asking for the raise',
    text: 'At 22 my boss said the raise had to wait another year. This time I spoke up and told her everything I had done. I was nervous, but I was proud of myself after.',
    date: '2025-10-14',
    place: 'Boston, Massachusetts',
    sourceKind: 'typing',
    milestone: 'First real job',
    recordedDaysAgo: 30,
  },
  {
    key: 'raise-call',
    title: 'Calling Dad',
    text: "That evening I called Dad and told him. He was quiet for a second and then said he was proud of me. I didn't expect that, and I felt so grateful I had to sit on the stairs.",
    date: '2025-10-14',
    place: 'Boston, Massachusetts',
    sourceKind: 'speech',
    recordedDaysAgo: 29,
  },
  {
    key: 'porch',
    title: "Rain on Nani's porch",
    text: "I don't know when this was, but I remember sitting on Nani's porch while it rained, the smell of wet dirt and her humming something. I felt completely safe and calm.",
    sourceKind: 'speech',
    recordedDaysAgo: 12,
  },
];

export const SAMPLE_REFLECTION = {
  memoryKey: 'promise',
  text: "Looking back, I think Mom was exhausted that summer. She was working two jobs. I don't think she meant to break a promise, I think she just ran out of room.",
};

export const SAMPLE_CAPSULES = [
  {
    title: 'For one year later',
    text: "It's November and I just started the new job. I hope you stopped apologizing in meetings. I hope you called Nani more. If you didn't, call her today.",
    unlockKind: 'date' as const,
    unlockDate: '2026-11-01',
    authoredAt: '2025-11-01T20:15:00.000Z',
    authoredAge: 22,
  },
  {
    title: 'To me at 25',
    text: 'Are you still drawing? Please say yes.',
    unlockKind: 'date' as const,
    unlockDate: '2028-04-18',
    authoredAt: '2026-04-18T09:00:00.000Z',
    authoredAge: 23,
  },
  {
    title: 'When I finish the master’s',
    text: 'You did the hard thing. Now rest for a whole week, no excuses.',
    unlockKind: 'milestone' as const,
    unlockMilestone: 'Finishing my master’s degree',
    authoredAt: '2026-09-02T18:40:00.000Z',
    authoredAge: 23,
  },
];

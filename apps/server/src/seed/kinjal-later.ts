import type { SampleMemory } from './kinjal-types';

const MOM = { name: 'Mom', said: ['Mom', 'my mom', 'Mummy'], relationship: 'mother' };
const DAD = { name: 'Dad', said: ['Dad', 'my dad', 'Papa'], relationship: 'father' };
const NANI = { name: 'Nani', said: ['Nani', 'my nani'], relationship: 'grandmother' };
const ARJUN = { name: 'Arjun', said: ['Arjun', 'my brother'], relationship: 'brother' };
const PRIYA = { name: 'Priya', said: ['Priya'], relationship: 'best friend' };

export const LATER: SampleMemory[] = [
  {
    key: 'leaving-for-college',
    title: 'Leaving before sunrise',
    raw: "August 18 2021 we left at four am to drive to Blacksburg Virginia, it's like ten hours. mom packed parathas wrapped in foil like we were going on a train journey in India. somewhere in Pennsylvania I fell asleep and woke up and dad was singing along to old Kishore Kumar songs really quietly so he wouldn't wake me",
    story:
      "On August 18, 2021, we left at four in the morning for the ten-hour drive to Blacksburg, Virginia. Mom had packed parathas wrapped in foil, as if we were taking a train across India.\n\nSomewhere in Pennsylvania I fell asleep. When I woke up, Dad was singing along to old Kishore Kumar songs, very quietly, so he wouldn't wake me.",
    summary:
      'The ten-hour drive to Virginia Tech, Mom’s foil-wrapped parathas, and Dad singing quietly.',
    when: { date: '2021-08-18' },
    time: { kind: 'one day', hint: 'the drive down' },
    places: ['Blacksburg, Virginia'],
    people: [
      { ...MOM, role: 'supporting' },
      { ...DAD, role: 'supporting' },
    ],
    feelings: [
      ['nervous', 'then'],
      ['loved', 'now'],
    ],
    themes: [['Leaving home', 'The day you left for college.']],
    milestone: 'Started college',
    sourceKind: 'speech',
    recordedDaysAgo: 100,
  },
  {
    key: 'dorm-night',
    title: 'First night in the dorm',
    raw: "my roommate Jess had already decorated her half with fairy lights and a Taylor Swift poster and my half was just bare. after my parents left I sat on the mattress with no sheets on it because mom had the sheets in the car and she'd already driven off. Jess gave me her extra blanket without me even asking",
    story:
      "My roommate, Jess, had already decorated her half of the room with fairy lights and a Taylor Swift poster. My half was bare.\n\nAfter my parents left, I sat on a mattress with no sheets, because Mom had the sheets in the car and she'd already driven off. Jess gave me her spare blanket without my asking.",
    summary:
      'A bare dorm mattress on the first night, and a roommate who handed over her spare blanket.',
    when: { date: '2021-08-18' },
    time: { kind: 'one day', hint: 'that night' },
    places: ['Blacksburg, Virginia'],
    people: [
      { name: 'Jess', said: ['Jess'], role: 'central', relationship: 'roommate' },
      { ...MOM, role: 'mentioned' },
    ],
    feelings: [
      ['lonely', 'then'],
      ['grateful', 'then'],
    ],
    themes: [['Belonging', 'A stranger looked after you on night one.']],
    sourceKind: 'speech',
    recordedDaysAgo: 98,
  },
  {
    key: 'chem-exam',
    title: 'Failing my first chemistry exam',
    raw: 'I got a 41 on my first chem exam in October 2021. I had never failed anything in school before like ever. I sat in the stairwell of Hahn hall and called dad expecting him to be upset and instead he laughed, not mean, and said good, now you know where the ground is. then he asked what I was going to do differently and I actually had to think about it. I went to office hours for the first time ever the next week',
    story:
      'I got a 41 on my first chemistry exam in October 2021. I had never failed anything at school before.\n\nI sat in the stairwell of Hahn Hall and called Dad, expecting him to be upset. Instead he laughed, not unkindly, and said, "Good. Now you know where the ground is." Then he asked what I was going to do differently, and I actually had to think about it.\n\nThe next week I went to office hours for the first time.',
    summary: 'A 41 on the first college exam, and Dad saying “now you know where the ground is”.',
    when: { month: '2021-10' },
    time: { kind: 'one day', hint: 'the day the grades came back' },
    places: ['Blacksburg, Virginia'],
    people: [{ ...DAD, role: 'central' }],
    feelings: [
      ['embarrassed', 'then'],
      ['scared', 'then'],
      ['relieved', 'then'],
    ],
    themes: [['Changing a belief', 'Failing stopped meaning the end of something.']],
    questions: [
      ['What did you end up getting in the class?', 'A B-minus, which felt like an A.'],
      [
        'Did his reaction surprise you?',
        'Completely. I expected the radio-off silence from the soccer year.',
      ],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 92,
  },
  {
    key: 'switching-major',
    title: 'Telling Dad I was switching',
    raw: "in february 2022 I decided to switch from mechanical engineering to human computer interaction and this time I called dad before I filled out the form instead of after. I had a whole list of reasons written down in my notes app. he was quiet for a bit and then said you thought about this, and I said yes, and he said okay then. it took like four minutes. I'd been scared of that call for a year",
    story:
      'In February 2022 I decided to switch from mechanical engineering to human-computer interaction. This time I called Dad before filling out the form, not after. I had a list of reasons in my notes app.\n\nHe was quiet for a moment, then said, "You thought about this." I said yes. He said, "Okay then." The call took about four minutes. I\'d been dreading it for a year.',
    summary: 'Calling Dad first, with a list of reasons, to tell him she was switching majors.',
    when: { month: '2022-02' },
    time: { kind: 'one moment', hint: 'a four-minute phone call' },
    places: ['Blacksburg, Virginia'],
    people: [{ ...DAD, role: 'central' }],
    feelings: [
      ['nervous', 'then'],
      ['relieved', 'then'],
      ['proud', 'now'],
    ],
    themes: [
      ['Standing up for myself', 'You told him what you wanted, with your reasons.'],
      ['A relationship changing', 'Dad listened instead of deciding.'],
    ],
    milestone: 'Switched to HCI',
    sourceKind: 'speech',
    recordedDaysAgo: 88,
  },
  {
    key: 'drillfield-snow',
    title: 'Snow day on the Drillfield',
    raw: 'january 2022 classes got cancelled for snow and half the campus was sledding down the hill by the Drillfield on dining hall trays. Jess and I made a snowman with a VT hat. it was the first time Blacksburg felt like home',
    story:
      'In January 2022 classes were cancelled for snow, and half the campus went sledding down the hill by the Drillfield on dining-hall trays. Jess and I built a snowman and gave it a VT hat.\n\nIt was the first time Blacksburg felt like home.',
    summary: 'A snow day sledding on dining-hall trays, when Blacksburg first felt like home.',
    when: { month: '2022-01' },
    time: { kind: 'one day', hint: 'a snow day' },
    places: ['Blacksburg, Virginia'],
    people: [{ name: 'Jess', said: ['Jess'], role: 'supporting', relationship: 'roommate' }],
    feelings: [['happy', 'then']],
    themes: [['Belonging', 'Blacksburg started to feel like home.']],
    sourceKind: 'typing',
    recordedDaysAgo: 85,
  },
  {
    key: 'la-trip',
    title: 'Los Angeles with Priya',
    raw: 'spring break 2023 Priya and I flew to LA for five days on the cheapest flights ever. we got lost in Griffith park and walked like three extra miles and argued about whose fault it was and then laughed about it at a taco truck. it was the first trip I planned and paid for myself',
    story:
      'For spring break in 2023, Priya and I flew to Los Angeles for five days on the cheapest flights we could find. We got lost in Griffith Park, walked about three extra miles, argued over whose fault it was, and then laughed about it at a taco truck.\n\nIt was the first trip I planned and paid for myself.',
    summary: 'A five-day trip to LA with Priya, the first one Kinjal planned and paid for herself.',
    when: { month: '2023-03' },
    time: { kind: 'a few days', hint: 'five days of spring break' },
    places: ['Los Angeles, California'],
    people: [{ ...PRIYA, role: 'central' }],
    feelings: [
      ['excited', 'then'],
      ['happy', 'then'],
    ],
    themes: [
      ['Independence', 'Your first self-funded trip.'],
      ['Friendship', 'Getting lost with Priya.'],
    ],
    sourceKind: 'typing',
    recordedDaysAgo: 80,
  },
  {
    key: 'nani-stroke',
    title: 'The call about Nani',
    raw: 'november 2023 mom called me at 6am which she never does and said Nani had a small stroke. I was in Blacksburg and India felt like the other side of the planet which it is. Nani got better mostly, her left hand is still weak. I video called her every day for a month and she kept saying stop wasting your phone money',
    story:
      'In November 2023, Mom called me at six in the morning, which she never does, and said Nani had had a small stroke. I was in Blacksburg, and India felt like the other side of the world, which it is.\n\nNani mostly recovered; her left hand is still weak. I video-called her every day for a month, and she kept telling me to stop wasting my phone money.',
    summary:
      'An early-morning call about Nani’s stroke, and a month of daily video calls from Virginia.',
    when: { month: '2023-11' },
    time: { kind: 'weeks or months', hint: 'that month' },
    places: ['Blacksburg, Virginia', 'Gwalior, India'],
    people: [
      { ...NANI, role: 'central' },
      { ...MOM, role: 'supporting' },
    ],
    feelings: [
      ['scared', 'then'],
      ['lonely', 'then'],
      ['grateful', 'now'],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 75,
  },
  {
    key: 'san-diego',
    title: 'The San Diego internship',
    raw: 'summer 2024 I did a UX internship in San Diego at a health app company, ten weeks. I sublet a room in North Park from a nurse who worked nights so I basically lived alone. I walked to Balboa park every evening and called Arjun who was going through a whole thing with middle school. it was the first time I felt like I was building an actual life somewhere by myself',
    story:
      'In the summer of 2024 I did a ten-week UX internship in San Diego at a company that made a health app. I sublet a room in North Park from a nurse who worked nights, so I basically lived alone.\n\nEvery evening I walked to Balboa Park and called Arjun, who was having a hard time with middle school. It was the first time I felt I was building a real life somewhere on my own.',
    summary:
      'Ten weeks in San Diego living mostly alone, evening walks in Balboa Park and calls with Arjun.',
    when: { ages: [21, 21], season: 'summer' },
    time: { kind: 'weeks or months', hint: 'ten weeks that summer' },
    places: ['San Diego, California'],
    people: [
      { ...ARJUN, role: 'supporting' },
      { name: 'Marcus', said: ['Marcus'], role: 'mentioned', relationship: 'internship manager' },
    ],
    feelings: [
      ['excited', 'then'],
      ['lonely', 'then'],
      ['proud', 'now'],
    ],
    themes: [['Independence', 'A whole life of your own for a summer.']],
    photos: [
      {
        scene: 'palm trees and a Spanish-style tower at sunset, warm evening light, park paths',
        caption: 'Balboa Park, most evenings',
      },
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 70,
  },
  {
    key: 'presentation',
    title: 'Presenting to the VP',
    raw: 'the last week of the internship, August 9 2024, I had to present my research findings to the VP of product. I had practiced like fifteen times. when I stood up my hands were shaking so I held the clicker with both hands. I remembered the recital and how I froze and I just kept going even when I lost my place on slide six. after, she asked me two questions and said this is exactly what we needed. Marcus gave me a thumbs up from the back',
    story:
      'In the last week of the internship, on August 9, 2024, I presented my research findings to the VP of product. I had practised about fifteen times.\n\nWhen I stood up my hands were shaking, so I held the clicker with both of them. I thought about the recital, and how I had frozen, and I kept going even when I lost my place on slide six.\n\nAfterwards she asked me two questions and said, "This is exactly what we needed." Marcus gave me a thumbs-up from the back.',
    summary:
      'Presenting to a VP with shaking hands, remembering the recital, and getting through it.',
    when: { date: '2024-08-09' },
    time: { kind: 'one moment', hint: 'a twenty-minute presentation' },
    places: ['San Diego, California'],
    people: [
      { name: 'Marcus', said: ['Marcus'], role: 'supporting', relationship: 'internship manager' },
      {
        name: 'the VP of product',
        said: ['the VP of product', 'the VP'],
        role: 'supporting',
        relationship: 'executive',
      },
    ],
    feelings: [
      ['nervous', 'then'],
      ['proud', 'then'],
      ['confident', 'now'],
    ],
    themes: [['Facing a fear', 'Being watched, again, and you kept going.']],
    sourceKind: 'speech',
    recordedDaysAgo: 65,
  },
  {
    key: 'rejections',
    title: 'Twenty rejections',
    raw: "spring 2025 I applied to like forty full time jobs and got twenty rejections and the rest never answered. I kept a spreadsheet and coloured the rejections red and it was so much red. I called dad and he said when he came here he applied to ninety places and the job he got was the one he almost didn't apply for. I applied to the masters program at UMass the next week, kind of on a whim",
    story:
      "In the spring of 2025 I applied to about forty full-time jobs. Twenty rejected me and the rest never answered. I kept a spreadsheet and coloured the rejections red, and there was so much red.\n\nI called Dad. He said that when he came here he applied to ninety places, and the job he got was the one he almost didn't apply for. The next week, almost on a whim, I applied to the master's program at UMass.",
    summary:
      'A spreadsheet full of red rejections, Dad’s ninety applications, and a last-minute master’s application.',
    when: { ages: [21, 22], season: 'spring' },
    time: { kind: 'weeks or months', hint: 'that whole spring' },
    places: ['Blacksburg, Virginia'],
    people: [{ ...DAD, role: 'central' }],
    feelings: [
      ['disappointed', 'then'],
      ['overwhelmed', 'then'],
      ['hopeful', 'now'],
    ],
    themes: [
      ['Hard work not paying off', 'Months of applications and mostly silence.'],
      ['Trying again', 'You applied somewhere new the next week.'],
    ],
    sourceKind: 'typing',
    recordedDaysAgo: 60,
  },
  {
    key: 'vt-graduation',
    title: 'Graduating from Virginia Tech',
    raw: "may 15 2025 graduation at Lane stadium. Nani watched on video call from Gwalior and kept asking mom to turn the phone so she could see me better. dad didn't say much but he hugged me for a really long time. I still didn't have a job but I had gotten into UMass so at least I knew what was next",
    story:
      "I graduated on May 15, 2025, at Lane Stadium. Nani watched over video call from Gwalior and kept asking Mom to turn the phone so she could see me better.\n\nDad didn't say much, but he hugged me for a very long time. I still didn't have a job, but I'd got into UMass, so at least I knew what came next.",
    summary: 'College graduation at Lane Stadium with Nani watching from Gwalior on Mom’s phone.',
    when: { date: '2025-05-15' },
    time: { kind: 'one day', hint: 'graduation day' },
    places: ['Blacksburg, Virginia'],
    people: [
      { ...DAD, role: 'supporting' },
      { ...NANI, role: 'supporting' },
      { ...MOM, role: 'mentioned' },
    ],
    feelings: [
      ['proud', 'then'],
      ['hopeful', 'then'],
    ],
    milestone: 'Graduated from college',
    photos: [
      {
        scene:
          'graduation caps thrown in the air above a stadium crowd, maroon and orange, bright May sky',
        caption: 'Lane Stadium',
      },
    ],
    sourceKind: 'typing',
    recordedDaysAgo: 55,
  },
  {
    key: 'moving-day',
    title: 'Moving day with Mom',
    raw: "August 17 2025 mom drove me up to Amherst for grad school. the car was so full of suitcases that I had a laundry basket on my lap the whole way. she kept saying you don't need all this and then she'd find another thing she packed for me. she made me promise to eat actual vegetables. when she left she didn't cry until she was in the car, I saw her through the window. same as me with soccer I guess",
    story:
      "On August 17, 2025, Mom drove me up to Amherst for grad school. The car was so packed with suitcases that I held a laundry basket on my lap the whole way. She kept saying I didn't need all this, then finding something else she had packed for me.\n\nShe made me promise to eat actual vegetables. When she left, she didn't cry until she was in the car. I saw her through the window. The same as me after soccer, I suppose.",
    summary:
      'Mom driving a car packed with suitcases up to Amherst, and crying only once she was back in the car.',
    when: { date: '2025-08-17' },
    time: { kind: 'one day', hint: 'moving day' },
    places: ['Amherst, Massachusetts'],
    people: [{ ...MOM, role: 'central' }],
    feelings: [
      ['excited', 'then'],
      ['loved', 'then'],
      ['nostalgic', 'now'],
    ],
    themes: [['A relationship changing', 'Mom letting you go, her way.']],
    milestone: "Started my master's",
    photos: [
      {
        scene:
          'car packed with suitcases and a laundry basket, late summer light, small apartment street with maple trees',
        caption: 'The car on moving day',
      },
    ],
    tellings: [
      {
        raw: "one more thing about moving day, mom left a container of rajma in the fridge with a sticky note that said heat for 2 min not 5, you always burn it. I didn't find it until the next day",
        story:
          'One more thing about moving day: Mom left a container of rajma in the fridge with a sticky note that said, "Heat for 2 min, not 5. You always burn it."\n\nI didn\'t find it until the next day.',
        recordedDaysAgo: 30,
        sourceKind: 'speech',
      },
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 50,
  },
  {
    key: 'pizza-floor',
    title: 'Pizza on the floor',
    raw: "that first evening in Amherst the apartment had no furniture yet except the mattress so mom and I ate pizza on the floor out of the box. we talked about Nani's garden and how she'd hate that I don't cook",
    story:
      "That first evening in Amherst, the apartment had no furniture except the mattress, so Mom and I ate pizza on the floor straight out of the box.\n\nWe talked about Nani's garden, and how much Nani would hate that I don't cook.",
    summary: 'Eating pizza on the floor of an empty apartment with Mom.',
    when: { date: '2025-08-17' },
    time: { kind: 'one moment', hint: 'dinner that night' },
    places: ['Amherst, Massachusetts'],
    people: [
      { ...MOM, role: 'central' },
      { ...NANI, role: 'mentioned' },
    ],
    feelings: [['happy', 'then']],
    sourceKind: 'typing',
    recordedDaysAgo: 49,
  },
  {
    key: 'first-night-alone',
    title: 'The first night alone',
    raw: 'after mom drove off the apartment was so quiet I could hear the fridge. I sat on the mattress and called Arjun just to hear something. he was playing a video game and only half listening and somehow that was perfect',
    story:
      'After Mom drove off, the apartment was so quiet I could hear the fridge. I sat on the mattress and called Arjun just to hear a voice.\n\nHe was playing a video game and only half listening, and somehow that was perfect.',
    summary: 'A silent new apartment, and calling Arjun just to hear someone.',
    when: { date: '2025-08-17' },
    time: { kind: 'one moment', hint: 'later that night' },
    places: ['Amherst, Massachusetts'],
    people: [
      { ...ARJUN, role: 'central' },
      { ...MOM, role: 'mentioned' },
    ],
    feelings: [
      ['lonely', 'then'],
      ['peaceful', 'then'],
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 48,
  },
  {
    key: 'raise',
    title: 'Asking for the raise',
    raw: "so I've been working part time at Fieldnote, the little design studio in Northampton, since September doing research and prototypes, and I had been basically doing the job of the person who left in August on top of my own. I spent two weekends making a one page doc of everything I'd shipped, with numbers, like the onboarding redesign cut drop off by like eighteen percent. I practised what I'd say in the shower like ten times. on October 14 I asked Dana for fifteen minutes, my heart was pounding so hard I thought she could hear it. I said I'd like my rate to go from twenty two to twenty eight an hour and here's why. she read the page and said honestly I should have brought this up myself, and said yes to twenty seven and to revisit in January. I walked to my car and sat there shaking for like five minutes. I was so nervous but I did it",
    story:
      "Since September I'd been working part-time at Fieldnote, a small design studio in Northampton, doing research and prototypes. For months I had been doing the job of the person who left in August on top of my own.\n\nI spent two weekends putting together a one-page summary of everything I'd shipped, with numbers. The onboarding redesign, for example, cut drop-off by about eighteen percent. I practised what I'd say in the shower about ten times.\n\nOn October 14 I asked Dana for fifteen minutes. My heart was pounding so hard I thought she could hear it. I said I'd like my rate to go from $22 to $28 an hour, and why. She read the page and said, honestly, she should have brought it up herself. She agreed to $27, with another look in January.\n\nI walked to my car and sat there shaking for about five minutes. I was so nervous, but I did it.",
    summary:
      'Preparing a page of results, asking her boss for a raise despite nerves, and getting most of it.',
    when: { date: '2025-10-14' },
    time: { kind: 'one day', hint: 'a fifteen-minute meeting, after weeks of preparing' },
    places: ['Northampton, Massachusetts'],
    people: [{ name: 'Dana', said: ['Dana'], role: 'central', relationship: 'boss' }],
    feelings: [
      ['nervous', 'then'],
      ['determined', 'then'],
      ['proud', 'then'],
      ['confident', 'now'],
    ],
    themes: [
      ['Self-advocacy', 'You asked, with evidence, for what you were owed.'],
      ['Recognizing my worth', 'You documented your own value before anyone else did.'],
      ['Breaking a pattern', 'This time you didn’t wait to be noticed.'],
    ],
    questions: [
      [
        'What made you decide to ask now?',
        'Realising I was doing two jobs and nobody was going to notice unless I said so.',
      ],
      ['Did anything from the soccer tryouts cross your mind?', null],
    ],
    milestone: 'First raise',
    sourceKind: 'speech',
    recordedDaysAgo: 35,
  },
  {
    key: 'calling-dad',
    title: 'Calling Dad after',
    raw: "right after the raise I called dad from the car. I told him the whole thing and he said, you asked? yourself? and I said yes and he laughed and said I never asked for a raise in my life, I just waited. he said he was proud and he didn't say anything about engineering. that felt like a big deal",
    story:
      'Right after the raise, I called Dad from the car and told him everything. "You asked? Yourself?" he said. When I said yes, he laughed and said he had never asked for a raise in his life; he had always just waited.\n\nHe said he was proud, and he didn\'t mention engineering. That felt like a big deal.',
    summary: 'Telling Dad about the raise, and hearing that he had never asked for one himself.',
    when: { date: '2025-10-14' },
    time: { kind: 'one moment', hint: 'a call from the car' },
    places: ['Northampton, Massachusetts'],
    people: [{ ...DAD, role: 'central' }],
    feelings: [
      ['proud', 'then'],
      ['loved', 'then'],
    ],
    themes: [['A relationship changing', 'Dad proud of you for asking, not for playing it safe.']],
    sourceKind: 'speech',
    recordedDaysAgo: 34,
  },
  {
    key: 'amherst-snow',
    title: 'First snow in Amherst',
    raw: "december 2 2025 first real snow in Amherst. I walked to campus and the whole town common was white and quiet. I thought about the blizzard in Queens and dad's plastic bag boots and sent him a picture of my actual snow boots",
    story:
      "On December 2, 2025, the first real snow fell in Amherst. I walked to campus, and the whole town common was white and quiet.\n\nI thought about the blizzard in Queens and Dad's plastic-bag boots, and sent him a photo of my real snow boots.",
    summary: 'The first snow in Amherst, and a photo of real snow boots sent to Dad.',
    when: { date: '2025-12-02' },
    time: { kind: 'one moment', hint: 'the walk to campus' },
    places: ['Amherst, Massachusetts'],
    people: [{ ...DAD, role: 'mentioned' }],
    feelings: [
      ['peaceful', 'then'],
      ['nostalgic', 'then'],
    ],
    themes: [['Coming full circle', 'Snow again, years after Queens.']],
    sourceKind: 'typing',
    recordedDaysAgo: 28,
  },
  {
    key: 'nani-birthday',
    title: "Nani's eightieth",
    raw: "Nani turned eighty in February 2026 and the whole family was on a video call, like fifteen people in tiny boxes. she couldn't hear anyone because everyone talked at once. at the end she said in Hindi that she wished she could feed all of us at once, which is so her",
    story:
      "Nani turned eighty in February 2026, and the whole family joined a video call: about fifteen people in tiny boxes. She couldn't hear anyone because everyone talked at once.\n\nAt the end she said, in Hindi, that she wished she could feed all of us at once. That is so like her.",
    summary: 'A chaotic family video call for Nani’s eightieth birthday.',
    when: { month: '2026-02' },
    time: { kind: 'one moment', hint: 'an hour-long call' },
    places: ['Amherst, Massachusetts', 'Gwalior, India'],
    people: [{ ...NANI, role: 'central' }],
    feelings: [
      ['loved', 'then'],
      ['happy', 'then'],
    ],
    sourceKind: 'typing',
    recordedDaysAgo: 20,
  },
  {
    key: 'balcony-tomatoes',
    title: 'Tomatoes on the balcony',
    raw: "this summer I grew tomatoes in two pots on my balcony, it's july 2026. only like six actually turned red. I ate the first one standing on the balcony and it was warm from the sun and I literally said out loud oh my god Nani. I sent her a video and she critiqued my watering",
    story:
      'This summer, in July 2026, I grew tomatoes in two pots on my balcony. Only about six actually ripened.\n\nI ate the first one standing on the balcony, and it was warm from the sun. I actually said out loud, "Oh my god, Nani." I sent her a video, and she critiqued my watering.',
    summary: 'The first tomato from her own balcony pots, warm from the sun, just like Nani’s.',
    when: { month: '2026-07' },
    time: { kind: 'one moment', hint: 'one summer afternoon' },
    places: ['Amherst, Massachusetts'],
    people: [{ ...NANI, role: 'supporting' }],
    feelings: [
      ['happy', 'then'],
      ['nostalgic', 'then'],
    ],
    themes: [['Coming full circle', 'The warm tomato, twenty years after Nani’s garden.']],
    photos: [
      {
        scene:
          'tomato plants in terracotta pots on a small apartment balcony, a few red tomatoes, afternoon sun',
        caption: 'The balcony tomatoes',
      },
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 12,
  },
  {
    key: 'advisor',
    title: 'Asking my advisor for a different project',
    raw: "in september 2026 I told my advisor Dr. Ruiz I didn't want to keep going on the project I was assigned and I wanted to do my thesis on how people remember things with technology instead. I brought two papers and a rough plan. she said this is better than what I gave you. I didn't even rehearse that much this time",
    story:
      "In September 2026 I told my advisor, Dr. Ruiz, that I didn't want to continue the project I'd been assigned. I wanted to write my thesis on how people use technology to remember things. I brought two papers and a rough plan.\n\nShe said, \"This is better than what I gave you.\" I didn't even rehearse much this time.",
    summary:
      'Asking to change thesis topics, with a plan, and hearing it was better than the original.',
    when: { month: '2026-09' },
    time: { kind: 'one moment', hint: 'one meeting' },
    places: ['Amherst, Massachusetts'],
    people: [
      { name: 'Dr. Ruiz', said: ['Dr. Ruiz'], role: 'central', relationship: 'thesis advisor' },
    ],
    feelings: [
      ['confident', 'then'],
      ['excited', 'then'],
    ],
    themes: [['Self-advocacy', 'You asked for the project you wanted.']],
    sourceKind: 'typing',
    recordedDaysAgo: 8,
  },
  {
    key: 'paper-rejected',
    title: 'The paper that got rejected',
    raw: 'our workshop paper got rejected in october 2026, one reviewer was really harsh. a few years ago I would have hidden for a week. this time I read the reviews twice, wrote down which points were fair, and sent Dr. Ruiz a plan to fix it by friday. I even thought of dad saying now you know where the ground is. I was still annoyed though, reviewer two was kind of mean',
    story:
      'Our workshop paper was rejected in October 2026, and one reviewer was really harsh. A few years ago I would have hidden for a week.\n\nThis time I read the reviews twice, wrote down which points were fair, and sent Dr. Ruiz a plan to fix it by Friday. I even thought of Dad saying, "Now you know where the ground is."\n\nI was still annoyed, though. Reviewer two was kind of mean.',
    summary:
      'A rejected paper handled with a plan instead of hiding, still annoyed at reviewer two.',
    when: { month: '2026-10' },
    time: { kind: 'a few days', hint: 'the week after the reviews came back' },
    places: ['Amherst, Massachusetts'],
    people: [
      { name: 'Dr. Ruiz', said: ['Dr. Ruiz'], role: 'supporting', relationship: 'thesis advisor' },
      { ...DAD, role: 'mentioned' },
    ],
    feelings: [
      ['disappointed', 'then'],
      ['frustrated', 'then'],
      ['determined', 'then'],
    ],
    themes: [['Changing a belief', 'A rejection became a to-do list, not a verdict.']],
    sourceKind: 'typing',
    recordedDaysAgo: 4,
  },
];

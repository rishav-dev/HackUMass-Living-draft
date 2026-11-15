import type { SampleMemory } from './kinjal-types';

const MOM = { name: 'Mom', said: ['Mom', 'my mom', 'Mummy'], relationship: 'mother' };
const DAD = { name: 'Dad', said: ['Dad', 'my dad', 'Papa'], relationship: 'father' };
const NANI = { name: 'Nani', said: ['Nani', 'my nani'], relationship: 'grandmother' };
const ARJUN = { name: 'Arjun', said: ['Arjun', 'my brother'], relationship: 'brother' };
const PRIYA = { name: 'Priya', said: ['Priya'], relationship: 'best friend' };

export const TEEN: SampleMemory[] = [
  {
    key: 'moving-shrewsbury',
    title: 'Moving to Massachusetts',
    raw: 'we moved to Shrewsbury Massachusetts on June 25 2016 because dad got the job in Worcester. I was thirteen and so mad about it, I had finally gotten friends in Queens. the new house had stairs and a backyard and Arjun ran around the yard screaming like a dog let off a leash. I sat in the empty room that was supposed to be mine and texted Mei for like three hours',
    story:
      'We moved to Shrewsbury, Massachusetts, on June 25, 2016, because Dad got a job in Worcester. I was thirteen and furious about it. I had finally made friends in Queens.\n\nThe new house had stairs and a backyard, and Arjun ran around the yard screaming like a dog let off its leash. I sat in the empty room that was supposed to be mine and texted Mei for about three hours.',
    summary: 'Moving from Queens to Shrewsbury at thirteen, angry about leaving friends behind.',
    when: { date: '2016-06-25' },
    time: { kind: 'one day', hint: 'moving day' },
    places: ['Shrewsbury, Massachusetts', 'Queens, New York'],
    people: [
      { ...DAD, role: 'supporting' },
      { ...ARJUN, role: 'supporting' },
      { name: 'Mei', said: ['Mei'], role: 'mentioned', relationship: 'friend' },
    ],
    feelings: [
      ['angry', 'then'],
      ['lonely', 'then'],
    ],
    themes: [['Starting over', 'Another move, just as you had settled in.']],
    milestone: 'Moved to Massachusetts',
    sourceKind: 'speech',
    recordedDaysAgo: 210,
  },
  {
    key: 'priya-lunch',
    title: 'Lunch with Priya',
    raw: "first week of eighth grade at Oak middle school I was about to eat alone again and this girl Priya waved me over to her table without even asking my name. she had the same tiffin box as my mom used to pack. we've been best friends since then which is ten years now",
    story:
      "In my first week of eighth grade at Oak Middle School, I was about to eat lunch alone again when a girl named Priya waved me over to her table without even asking my name. She had the same steel tiffin my mom used to pack.\n\nWe've been best friends ever since. That's ten years now.",
    summary:
      'Being waved over to Priya’s lunch table in a new school, the start of a ten-year friendship.',
    when: { month: '2016-09' },
    time: { kind: 'one moment', hint: 'one lunch period' },
    places: ['Shrewsbury, Massachusetts'],
    people: [{ ...PRIYA, role: 'central' }],
    feelings: [
      ['relieved', 'then'],
      ['grateful', 'now'],
    ],
    themes: [
      ['Belonging', 'Someone made room for you at lunch, again.'],
      ['Friendship', 'The start of your longest friendship.'],
    ],
    sourceKind: 'typing',
    recordedDaysAgo: 205,
  },
  {
    key: 'not-the-team',
    title: 'Not making the team',
    raw: "okay so the summer before ninth grade I decided I was going to make the varsity soccer team which, like, freshmen basically never do but my JV coach from the summer camp said I had a shot if I got faster. so every morning at six I ran the loop around Dean park, like three miles, even when it was raining, and I did the ladder drills dad drew on the driveway with chalk. I kept a notebook of my times and I got my mile down from like eight forty to seven ten which I was so proud of. tryouts were three days in late August and I thought I did okay, I was nervous the whole time but I didn't mess up anything big. on Friday August 25 they put the list up on the gym door and I read it like four times and my name just wasn't there. not even on JV, they said they had too many. I didn't cry there, I waited till I was in the car. dad picked me up and didn't say anything the whole drive and he kept the radio off which he never does. I never asked coach Brennan why. I just didn't play for a whole year and I told everyone I didn't care",
    story:
      "The summer before ninth grade, I decided I would make the varsity soccer team. Freshmen almost never do, but my coach from summer camp said I had a shot if I got faster.\n\nSo every morning at six I ran the three-mile loop around Dean Park, even in the rain, and did the ladder drills Dad had chalked on the driveway. I kept a notebook of my times. I got my mile down from about 8:40 to 7:10, and I was so proud of that.\n\nTryouts were three days at the end of August. I was nervous the whole time, but I thought I did okay. I didn't make any big mistakes.\n\nOn Friday, August 25, they posted the list on the gym door. I read it four times. My name wasn't on it, not even for JV; they said they had too many players. I didn't cry until I was in the car.\n\nDad picked me up and didn't say a word the whole drive. He kept the radio off, which he never does. I never asked Coach Brennan why. I didn't play for a whole year, and I told everyone I didn't care.",
    summary:
      'A summer of 6 a.m. runs to make the soccer team, a list without her name, and a silent drive home with Dad.',
    when: { date: '2017-08-25' },
    time: { kind: 'a few days', hint: 'three days of tryouts, then the list' },
    places: ['Shrewsbury, Massachusetts'],
    people: [
      { ...DAD, role: 'central' },
      {
        name: 'Coach Brennan',
        said: ['coach Brennan', 'Coach Brennan'],
        role: 'supporting',
        relationship: 'soccer coach',
      },
    ],
    feelings: [
      ['determined', 'then'],
      ['nervous', 'then'],
      ['disappointed', 'then'],
      ['embarrassed', 'then'],
      ['regretful', 'now'],
    ],
    themes: [
      ['Hard work not paying off', 'A whole summer of training and your name wasn’t on the list.'],
      ['Standing up for myself', 'You never asked the coach why.'],
    ],
    questions: [
      [
        'Did you ever find out why you were cut?',
        'No. I never asked, and Coach Brennan left the school the next year.',
      ],
      [
        'What did your dad say about it later?',
        'Nothing that week. Months later he said he kept the radio off because he didn’t trust himself not to say the wrong thing.',
      ],
      ['Why do you think you didn’t ask?', null],
    ],
    tellings: [
      {
        raw: "something I left out about the soccer thing, dad told me like months later that he kept the radio off on purpose because he didn't trust himself not to say something dumb like there's always next year. I thought he was disappointed in me the whole time and he was actually just trying not to make it worse",
        story:
          'Something I left out about the soccer tryouts: months later, Dad told me he kept the radio off on purpose because he didn\'t trust himself not to say something unhelpful, like "there\'s always next year."\n\nThe whole time, I had thought he was disappointed in me. He was just trying not to make it worse.',
        recordedDaysAgo: 40,
        sourceKind: 'speech',
      },
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 190,
  },
  {
    key: 'jv-again',
    title: 'Trying out again',
    raw: "a year later I tried out again, I almost didn't. this time I made JV. coach Lin said you got faster, did you know that, and I said yeah I know, I had the notebook. it wasn't varsity but I didn't care as much as I thought I would",
    story:
      "A year later I tried out again, though I almost didn't. This time I made JV. Coach Lin said, \"You got faster. Did you know that?\" I said yes. I'd kept the notebook.\n\nIt wasn't varsity, but I didn't mind as much as I'd expected.",
    summary: 'Trying out a second time a year later, and making JV.',
    when: { date: '2018-08-24' },
    time: { kind: 'a few days', hint: 'tryouts week' },
    places: ['Shrewsbury, Massachusetts'],
    people: [
      {
        name: 'Coach Lin',
        said: ['coach Lin', 'Coach Lin'],
        role: 'supporting',
        relationship: 'JV coach',
      },
    ],
    feelings: [
      ['nervous', 'then'],
      ['relieved', 'then'],
      ['proud', 'now'],
    ],
    themes: [['Trying again', 'You went back after the year you sat out.']],
    sourceKind: 'typing',
    recordedDaysAgo: 185,
  },
  {
    key: 'nani-winter',
    title: 'Nani in the snow',
    raw: "Nani came to stay with us in Shrewsbury for two months in the winter of 2018. she had never seen snow and she stood in the driveway in mom's coat and three shawls and just laughed. every evening she made rotis and made me practise rolling them round and mine looked like maps of countries",
    story:
      "Nani stayed with us in Shrewsbury for two months in the winter of 2018. She had never seen snow. She stood in the driveway in Mom's coat and three shawls and just laughed.\n\nEvery evening she made rotis and had me practise rolling them round. Mine came out looking like maps of different countries.",
    summary: 'Nani’s two-month winter visit: her first snow, and evenings learning to roll rotis.',
    when: { ages: [15, 15], season: 'winter' },
    time: { kind: 'weeks or months', hint: 'two months that winter' },
    places: ['Shrewsbury, Massachusetts'],
    people: [
      { ...NANI, role: 'central' },
      { ...MOM, role: 'mentioned' },
    ],
    feelings: [
      ['happy', 'then'],
      ['loved', 'then'],
      ['nostalgic', 'now'],
    ],
    themes: [['Being cared for', 'Nani taught you her kitchen, here this time.']],
    sourceKind: 'speech',
    recordedDaysAgo: 170,
  },
  {
    key: 'driving-test',
    title: 'Failing my driving test',
    raw: "I failed my road test in June 2019 because I rolled through a stop sign, like barely. I was so embarrassed I didn't want to get out of the car. dad was waiting in the parking lot and he just said well now you know the route, and drove me back there two weeks later and I passed",
    story:
      'I failed my road test in June 2019 because I rolled through a stop sign, only just. I was so embarrassed I didn\'t want to get out of the car.\n\nDad was waiting in the parking lot. All he said was, "Well, now you know the route." Two weeks later he drove me back, and I passed.',
    summary:
      'Failing the road test over a stop sign, and Dad’s matter-of-fact “now you know the route”.',
    when: { month: '2019-06' },
    time: { kind: 'a few days', hint: 'the test and the retake two weeks later' },
    places: ['Worcester, Massachusetts'],
    people: [{ ...DAD, role: 'central' }],
    feelings: [
      ['embarrassed', 'then'],
      ['relieved', 'then'],
    ],
    themes: [['Trying again', 'You retook it two weeks later.']],
    sourceKind: 'speech',
    recordedDaysAgo: 160,
  },
  {
    key: 'scoops',
    title: 'The ice cream shop summer',
    raw: 'summer 2019 I worked at Scoops on Route 9, my first real job. my arm hurt every night from scooping. the owner Mr. Dimitri let us eat one free cone per shift and I had mango every single time. I saved six hundred dollars and felt like a millionaire',
    story:
      "In the summer of 2019 I worked at Scoops on Route 9. It was my first real job, and my arm ached every night from scooping.\n\nMr. Dimitri, the owner, let us have one free cone per shift, and I had mango every time. By the end I'd saved six hundred dollars and felt like a millionaire.",
    summary: 'A first summer job scooping ice cream, one mango cone per shift.',
    when: { ages: [16, 16], season: 'summer' },
    time: { kind: 'weeks or months', hint: 'the whole summer' },
    places: ['Shrewsbury, Massachusetts'],
    people: [
      { name: 'Mr. Dimitri', said: ['Mr. Dimitri'], role: 'mentioned', relationship: 'boss' },
    ],
    feelings: [
      ['proud', 'then'],
      ['happy', 'then'],
    ],
    themes: [['Independence', 'Your first paycheck.']],
    sourceKind: 'typing',
    recordedDaysAgo: 150,
  },
  {
    key: 'acadia',
    title: 'Acadia with everyone',
    raw: 'in August 2019 we drove up to Acadia in Maine for four days, me mom dad and Arjun. it was the first real vacation since we moved. we hiked up Cadillac mountain for sunrise and it was freezing and Arjun complained the entire way up and then when the sun came up he went completely quiet. mom cried a little. I think that was the trip I realised my parents were also just people',
    story:
      'In August 2019 we drove up to Acadia in Maine for four days: Mom, Dad, Arjun and me. It was our first real vacation since the move.\n\nWe hiked up Cadillac Mountain for the sunrise. It was freezing, and Arjun complained the entire way up. When the sun came up, he went completely quiet, and Mom cried a little. I think that was the trip I realised my parents were also just people.',
    summary:
      'Four days in Acadia and a freezing sunrise on Cadillac Mountain with the whole family.',
    when: { month: '2019-08' },
    time: { kind: 'a few days', hint: 'a four-day trip' },
    places: ['Acadia, Maine'],
    people: [
      { ...MOM, role: 'supporting' },
      { ...DAD, role: 'supporting' },
      { ...ARJUN, role: 'supporting' },
    ],
    feelings: [
      ['peaceful', 'then'],
      ['grateful', 'now'],
    ],
    themes: [['Growing up', 'Seeing your parents as people for the first time.']],
    sound: 'ocean',
    soundCaption: 'Waves at Sand Beach',
    photos: [
      {
        scene: 'rocky coast at sunrise, granite cliffs, pine trees, cold morning mist, Maine',
        caption: 'Cadillac Mountain at sunrise',
      },
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 140,
  },
  {
    key: 'pandemic-spring',
    title: 'The spring everything stopped',
    raw: "school closed on March 13 2020 and we thought it was for two weeks. it was the rest of the year. I did junior year from my bed. Arjun's school zoom was in the kitchen so the whole house had to be quiet from nine to two. I learned to bake bread like everyone else and it was terrible every time",
    story:
      "School closed on March 13, 2020. We thought it would be for two weeks; it was the rest of the year. I did junior year from my bed.\n\nArjun's class was on Zoom at the kitchen table, so the whole house had to stay quiet from nine to two. Like everyone else, I learned to bake bread. It was terrible every time.",
    summary:
      'School closing for “two weeks” in March 2020 and staying closed for the rest of the year.',
    when: { date: '2020-03-13' },
    time: { kind: 'weeks or months', hint: 'from March to the end of the school year' },
    places: ['Shrewsbury, Massachusetts'],
    people: [{ ...ARJUN, role: 'supporting' }],
    feelings: [
      ['confused', 'then'],
      ['lonely', 'then'],
    ],
    sourceKind: 'typing',
    recordedDaysAgo: 130,
  },
  {
    key: 'dad-major',
    title: 'When Dad picked my major',
    raw: "in november of senior year dad sat me down with the college applications and said you'll put mechanical engineering, it's safe. I wanted to say I wanted to do design or psychology or anything with people but I just said okay. he told me about how when he came here nobody cared about his degree from India and he had to start over at forty, and he didn't want that for me. I understood but I also hated that I didn't say anything",
    story:
      "In November of senior year, Dad sat me down with the college applications and said, \"Put mechanical engineering. It's safe.\" I wanted to say I wanted design, or psychology, or anything to do with people, but I just said okay.\n\nHe told me how, when he came here, nobody cared about his degree from India, and he had to start over at forty. He didn't want that for me. I understood. I also hated that I hadn't said anything.",
    summary:
      'Letting Dad choose engineering on her college applications without saying what she wanted.',
    when: { month: '2020-11' },
    time: { kind: 'one day', hint: 'one evening with the applications' },
    places: ['Shrewsbury, Massachusetts'],
    people: [{ ...DAD, role: 'central' }],
    feelings: [
      ['frustrated', 'then'],
      ['guilty', 'then'],
      ['regretful', 'now'],
    ],
    themes: [
      ['Family expectations', 'Dad wanted safety for you after his own restart.'],
      ['Standing up for myself', 'You agreed without saying what you wanted.'],
    ],
    questions: [
      ['Did you ever tell him what you actually wanted?', 'Yes, in college, when I switched.'],
      ['How did his own story change how you saw his choice?', null],
    ],
    tellings: [
      {
        raw: 'thinking about the major thing again, I think dad was scared more than controlling. he started over at forty with two kids. failing for him meant something really different than for me, like for me failing was embarrassing, for him it meant not paying rent',
        story:
          'Thinking about the major again, I think Dad was more scared than controlling. He started over at forty with two kids.\n\nFailing meant something different to him than to me. For me it meant being embarrassed. For him it meant not making rent.',
        recordedDaysAgo: 25,
        sourceKind: 'speech',
      },
    ],
    sourceKind: 'speech',
    recordedDaysAgo: 125,
  },
  {
    key: 'the-secret',
    title: 'The secret',
    raw: "The night of my sixteenth birthday Priya told me something about her family that she'd never told anyone. I promised I wouldn't tell, and I haven't. I just remember sitting on her porch steps until it was really late.",
    story:
      "On the night of my sixteenth birthday, Priya told me something about her family that she'd never told anyone. I promised I wouldn't tell, and I haven't.\n\nI just remember sitting on her porch steps until it was very late.",
    summary: 'A secret Priya shared on the night of Kinjal’s sixteenth birthday.',
    when: { date: '2019-04-18' },
    time: { kind: 'one day', hint: 'that night' },
    places: ['Shrewsbury, Massachusetts'],
    people: [{ ...PRIYA, role: 'central' }],
    feelings: [['loved', 'then']],
    sensitive: true,
    sourceKind: 'typing',
    recordedDaysAgo: 120,
  },
  {
    key: 'graduation',
    title: 'Graduation day',
    raw: 'high school graduation June 12 2021, it was outside on the football field because of covid and everyone had masks with the school logo. when they called my name Arjun yelled DIDI really loud and everyone laughed. dad wore the same blazer he wore to his own graduation in Delhi',
    story:
      'High school graduation was on June 12, 2021, outside on the football field because of Covid, and everyone wore masks with the school logo.\n\nWhen they called my name, Arjun yelled "DIDI!" so loudly that everyone laughed. Dad wore the same blazer he\'d worn to his own graduation in Delhi.',
    summary: 'An outdoor, masked graduation, with Arjun yelling “Didi!” across the field.',
    when: { date: '2021-06-12' },
    time: { kind: 'one day', hint: 'graduation day' },
    places: ['Shrewsbury, Massachusetts'],
    people: [
      { ...ARJUN, role: 'supporting' },
      { ...DAD, role: 'supporting' },
    ],
    feelings: [
      ['proud', 'then'],
      ['happy', 'then'],
    ],
    milestone: 'High school graduation',
    sourceKind: 'typing',
    recordedDaysAgo: 110,
  },
  {
    key: 'dock',
    title: 'The dock at 2 a.m.',
    raw: "the same night after graduation me Priya and a few people sat on the dock at Lake Quinsigamond until like 2am talking about where we would all be in five years. Priya said I'd be the one who moved farthest away. she was kind of right",
    story:
      "The night of graduation, Priya, a few others and I sat on the dock at Lake Quinsigamond until about 2 a.m., talking about where we'd all be in five years. Priya said I'd be the one who moved farthest away.\n\nShe was kind of right.",
    summary:
      'Graduation night on a dock at Lake Quinsigamond, guessing where everyone would end up.',
    when: { date: '2021-06-12' },
    time: { kind: 'one moment', hint: 'late that night' },
    places: ['Lake Quinsigamond, Massachusetts'],
    people: [{ ...PRIYA, role: 'central' }],
    feelings: [
      ['nostalgic', 'then'],
      ['hopeful', 'then'],
    ],
    themes: [['Friendship', 'Priya, guessing your future.']],
    sourceKind: 'speech',
    recordedDaysAgo: 108,
  },
];

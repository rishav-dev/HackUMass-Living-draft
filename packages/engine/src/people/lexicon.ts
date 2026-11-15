export interface KinGroup {
  key: string;
  label: string;
  surfaces: string[];
}

export const KIN_GROUPS: KinGroup[] = [
  {
    key: 'mom',
    label: 'Mom',
    surfaces: ['mom', 'mum', 'mommy', 'mummy', 'mama', 'mother', 'momma', 'amma', 'ammi', 'maa'],
  },
  {
    key: 'dad',
    label: 'Dad',
    surfaces: ['dad', 'daddy', 'papa', 'father', 'pop', 'baba', 'abba', 'appa'],
  },
  {
    key: 'grandma',
    label: 'Grandma',
    surfaces: [
      'grandma',
      'grandmother',
      'granny',
      'gran',
      'nana',
      'nani',
      'dadi',
      'lola',
      'oma',
      'abuela',
    ],
  },
  {
    key: 'grandpa',
    label: 'Grandpa',
    surfaces: [
      'grandpa',
      'grandfather',
      'granddad',
      'grandad',
      'nanu',
      'dada',
      'lolo',
      'opa',
      'abuelo',
    ],
  },
  {
    key: 'brother',
    label: 'Brother',
    surfaces: [
      'brother',
      'little brother',
      'big brother',
      'older brother',
      'younger brother',
      'baby brother',
      'bro',
    ],
  },
  {
    key: 'sister',
    label: 'Sister',
    surfaces: [
      'sister',
      'little sister',
      'big sister',
      'older sister',
      'younger sister',
      'baby sister',
      'sis',
    ],
  },
  { key: 'aunt', label: 'Aunt', surfaces: ['aunt', 'aunty', 'auntie'] },
  { key: 'uncle', label: 'Uncle', surfaces: ['uncle'] },
  { key: 'stepmom', label: 'Stepmom', surfaces: ['stepmom', 'stepmother', 'step-mom'] },
  { key: 'stepdad', label: 'Stepdad', surfaces: ['stepdad', 'stepfather', 'step-dad'] },
  { key: 'husband', label: 'Husband', surfaces: ['husband'] },
  { key: 'wife', label: 'Wife', surfaces: ['wife'] },
  { key: 'son', label: 'Son', surfaces: ['son'] },
  { key: 'daughter', label: 'Daughter', surfaces: ['daughter'] },
];

export const ROLE_WORDS: Array<{ key: string; label: string; surfaces: string[] }> = [
  {
    key: 'teacher',
    label: 'Teacher',
    surfaces: [
      'teacher',
      'math teacher',
      'english teacher',
      'science teacher',
      'art teacher',
      'music teacher',
      'piano teacher',
      'homeroom teacher',
      'class teacher',
    ],
  },
  { key: 'coach', label: 'Coach', surfaces: ['coach'] },
  { key: 'principal', label: 'Principal', surfaces: ['principal', 'headmaster', 'headmistress'] },
  { key: 'best-friend', label: 'Best friend', surfaces: ['best friend', 'bestie'] },
  { key: 'friend', label: 'Friend', surfaces: ['friend'] },
  { key: 'cousin', label: 'Cousin', surfaces: ['cousin'] },
  { key: 'neighbor', label: 'Neighbor', surfaces: ['neighbor', 'neighbour'] },
  { key: 'boss', label: 'Boss', surfaces: ['boss', 'manager'] },
  { key: 'roommate', label: 'Roommate', surfaces: ['roommate', 'flatmate'] },
  { key: 'partner', label: 'Partner', surfaces: ['boyfriend', 'girlfriend', 'partner'] },
  { key: 'doctor', label: 'Doctor', surfaces: ['doctor'] },
  { key: 'babysitter', label: 'Babysitter', surfaces: ['babysitter', 'nanny'] },
];

export const NAME_TITLES = [
  'mrs',
  'mr',
  'ms',
  'miss',
  'dr',
  'coach',
  'auntie',
  'aunt',
  'uncle',
  'grandma',
  'grandpa',
  'nana',
  'professor',
  'prof',
];

export const NOT_NAMES = new Set(
  `i i'm i've i'd i'll the a an and but so then when while after before because if it its this that
  these those there their they we our us you your he she his her him my me mine one two three four
  five six seven eight nine ten later earlier later on once also even just still yes no oh okay ok
  well maybe probably honestly actually anyway sometimes everyone everybody someone somebody nobody
  monday tuesday wednesday thursday friday saturday sunday january february march april may june july
  august september october november december spring summer autumn fall winter christmas easter
  thanksgiving halloween diwali eid hanukkah ramadan new year god english spanish french hindi math
  science history chemistry biology physics art music pe gym school college university high middle
  elementary grade kindergarten mom dad mum mommy mummy mama mother father grandma grandpa nana nani
  brother sister aunt uncle cousin friend teacher coach principal at in on to for with from of by
  looking now today tonight tomorrow yesterday what why how where who which there's that's what's
  dear hi hello thanks thank sorry please hey wow ugh hmm um uh mr mrs ms dr miss`
    .split(/\s+/)
    .filter(Boolean),
);

export const PLACE_WORDS = new Set(
  `alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii
  idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan
  minnesota mississippi missouri montana nebraska nevada hampshire jersey mexico york carolina dakota
  ohio oklahoma oregon pennsylvania rhode tennessee texas utah vermont virginia washington wisconsin
  wyoming boston amherst edison chicago seattle portland denver austin houston dallas atlanta miami
  philadelphia pittsburgh baltimore brooklyn manhattan queens bronx jersey cape may blacksburg angeles
  diego francisco jose sacramento vegas phoenix india delhi mumbai bombay bangalore bengaluru chennai
  kolkata hyderabad pune gurgaon gurugram gwalior noida jaipur lucknow agra goa kerala punjab canada
  toronto vancouver montreal london paris berlin rome madrid tokyo seoul beijing shanghai singapore
  dubai sydney melbourne america usa england britain uk ireland scotland wales germany france italy
  spain japan china korea pakistan nepal bangladesh africa europe asia australia brazil`
    .split(/\s+/)
    .filter(Boolean),
);

export const DRIVER_VERBS = [
  'promised',
  'decided',
  'refused',
  'cancelled',
  'canceled',
  'left',
  'gave',
  'took',
  'bullied',
  'saved',
  'forced',
  'made me',
  'told me',
  'yelled',
  'hit',
  'broke',
  'chose',
  'surprised',
  'invited',
  'taught me',
  'pushed',
  'drove',
  'insisted',
  'said no',
  'said yes',
  'forgot',
  'lied',
  'kept',
  'started',
  'ended',
  'moved',
  'bought',
  'sent',
  'called',
  'let go',
  'let me',
  'woke me',
  'woke',
  'ran',
  'said i had to',
  'said we',
  'said i could',
  "wouldn't let",
  'grounded',
  'took me',
  'brought',
  'drove me',
];

export const SUPPORT_VERBS = [
  'helped',
  'sided',
  'agreed',
  'joined',
  'came',
  'watched',
  'stayed',
  'hugged',
  'held',
  'listened',
  'said',
  'told',
  'asked',
  'smiled',
  'laughed',
  'cheered',
  'waited',
  'drove',
  'picked',
  'packed',
  'cooked',
  'showed',
  'practiced',
  'sat',
];

export const CONFLICT_WITH = [
  'argued with',
  'fought with',
  'yelled at',
  'mad at',
  'angry at',
  'angry with',
  'upset with',
  'hurt by',
  'stood up to',
  'talked back to',
  'cried to',
];

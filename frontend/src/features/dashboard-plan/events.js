// Centralized Event Types & Educational Sub-types
// Order: Wedding, Birthday, Corporate, Baby shower, Housewarming, Reception, Educational

export const EDUCATIONAL_SUB_TYPES = [
  'School annual day',
  'College fest',
  'Graduation / convocation',
  'Seminar / conference',
  'Workshop / training',
  'Freshers or farewell party',
  'Coaching centre orientation',
  'Award / prize distribution'
];

export const EVENT_TYPES = [
  {
    id: 'wedding',
    name: 'Wedding',
    word: 'wedding',
    emoji: '💍',
    color: '#FF5C8A',
    darkText: false,
    budget: '₹30 lakh',
    defaultBudget: 3000000,
    // Split: Catering 38 / Hall 34 / Decor 16 / Extras 12
    split: { catering: 38, hall: 34, decor: 16, extras: 12 },
    desc: 'Grand weddings with mandap, traditional feast & guest hospitality'
  },
  {
    id: 'birthday',
    name: 'Birthday',
    word: 'birthday',
    emoji: '🎂',
    color: '#FFA62B',
    darkText: false,
    budget: '₹2 lakh',
    defaultBudget: 200000,
    // Split: Catering 40 / Hall 30 / Decor 20 / Extras 10
    split: { catering: 40, hall: 30, decor: 20, extras: 10 },
    desc: 'Fun celebrations with themed balloons, cake & entertainment'
  },
  {
    id: 'corporate',
    name: 'Corporate',
    word: 'corporate event',
    emoji: '💼',
    color: '#5AA2FF',
    darkText: false,
    budget: '₹8 lakh',
    defaultBudget: 800000,
    // Split: Catering 40 / Hall 30 / Decor 10 / Extras 20
    split: { catering: 40, hall: 30, decor: 10, extras: 20 },
    desc: 'Conferences, annual offsites & product launches with AV & stage'
  },
  {
    id: 'babyshower',
    name: 'Baby shower',
    word: 'baby shower',
    emoji: '🍼',
    color: '#3DD6C6',
    darkText: false,
    budget: '₹3 lakh',
    defaultBudget: 300000,
    // Split: Catering 40 / Hall 25 / Decor 25 / Extras 10
    split: { catering: 40, hall: 25, decor: 25, extras: 10 },
    desc: 'Intimate family rituals with soft pastel decor & traditional sweets'
  },
  {
    id: 'housewarming',
    name: 'Housewarming',
    word: 'housewarming',
    emoji: '🏡',
    color: '#5FD38D',
    darkText: false,
    budget: '₹2 lakh',
    defaultBudget: 200000,
    // Split: Catering 55 / Hall 10 / Decor 20 / Extras 15
    split: { catering: 55, hall: 10, decor: 20, extras: 15 },
    desc: 'Gruhapravesam puja, homam, floral entrance & authentic feast'
  },
  {
    id: 'reception',
    name: 'Reception',
    word: 'reception',
    emoji: '🥂',
    color: '#A57BFF',
    darkText: false,
    budget: '₹20 lakh',
    defaultBudget: 2000000,
    // Split: Catering 40 / Hall 35 / Decor 15 / Extras 10
    split: { catering: 40, hall: 35, decor: 15, extras: 10 },
    desc: 'Glamorous evening stage, multi-cuisine dinner & DJ setup'
  },
  {
    id: 'educational',
    name: 'Educational',
    word: 'educational',
    emoji: '🎓',
    color: '#F2D14B',
    darkText: false, // Selected Educational chip explicitly uses light text rgb(248, 235, 216) for accessibility contrast
    budget: '₹5 lakh',
    defaultBudget: 500000,
    // Split: Catering 30 / Hall 35 / Decor 10 / Extras 25 (Extras = sound, projector, certificates, photography)
    split: { catering: 30, hall: 35, decor: 10, extras: 25 },
    desc: 'Annual day, college fests, graduations, seminars & orientations',
    heroRotate: true
  },
  {
    id: 'andmore',
    name: 'And more',
    word: 'celebration',
    emoji: '✨',
    color: '#F0654F',
    darkText: false,
    defaultBudget: 400000,
    heroRotate: false,
    desc: 'Anniversaries, poojas, naming ceremonies, retirements & family functions'
  }
];

export const CITIES_BY_STATE = {
  'Andhra Pradesh': ['Kadapa', 'Vijayawada', 'Guntur', 'Visakhapatnam', 'Tirupati', 'Rajahmundry'],
  'Telangana': ['Hyderabad', 'Warangal'],
  'Tamil Nadu': ['Chennai', 'Coimbatore'],
  'Karnataka': ['Bengaluru', 'Mysuru'],
  'Maharashtra': ['Mumbai', 'Pune']
};

export const ALL_CITIES = [
  'Kadapa', 'Vijayawada', 'Guntur', 'Visakhapatnam', 'Tirupati', 'Rajahmundry',
  'Hyderabad', 'Warangal', 'Chennai', 'Coimbatore', 'Bengaluru',
  'Mysuru', 'Mumbai', 'Pune'
];

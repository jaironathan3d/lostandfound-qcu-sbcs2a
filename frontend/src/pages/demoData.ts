export type ItemStatus = 'Lost' | 'Found';

export type DemoItem = {
  id: string;
  title: string;
  category: string;
  status: ItemStatus;
  location: string;
  date: string;
  daysAgo: number;
  icon: string;
  color: string;
  description: string;
  privateDetails?: string;
  reporter?: string;
  imageUrl?: string;
  contact?: string;
  custodyLocation?: string;
};

export type DemoClaim = {
  id: string;
  itemId: string;
  itemTitle: string;
  submittedAt: string;
  status: 'Pending';
  ownershipDetails: string;
  lastSeen: string;
  evidenceFileName?: string;
};

export type DemoMessage = {
  id: string;
  itemId: string;
  recipient: string;
  content: string;
  sentAt: string;
};

export type DemoThread = {
  id: string;
  title: string;
  label: string;
  author: string;
  time: string;
  excerpt: string;
  replies: string[];
};

const itemStorageKey = 'qcu-demo-items';
const claimStorageKey = 'qcu-demo-claims';
const threadStorageKey = 'qcu-demo-threads';
const savedStorageKey = 'qcu-demo-saved-items';
const followingStorageKey = 'qcu-demo-following-threads';
const messageStorageKey = 'qcu-demo-messages';

export const initialItems: DemoItem[] = [
  {
    id: 'green-backpack',
    title: 'Olive green backpack',
    category: 'Bags & wallets',
    status: 'Lost',
    location: 'New Academic Building',
    date: '2 hours ago',
    daysAgo: 0,
    icon: '🎒',
    color: 'sage',
    description: 'Canvas backpack with brown straps and a small mountain patch on the front.',
    reporter: 'Alex M.',
  },
  {
    id: 'leather-keys',
    title: 'Keys with a leather keyring',
    category: 'Keys',
    status: 'Found',
    location: 'Central Library',
    date: '3 hours ago',
    daysAgo: 0,
    icon: '🔑',
    color: 'sand',
    description: 'A few silver keys with a leather keyring. Please share a detail to identify them.',
    privateDetails: 'A tiny blue bead is attached to the ring.',
    reporter: 'Sam R.',
  },
  {
    id: 'wireless-headphones',
    title: 'Midnight blue headphones',
    category: 'Electronics',
    status: 'Lost',
    location: 'SBCS Building',
    date: 'Yesterday',
    daysAgo: 1,
    icon: '🎧',
    color: 'blue',
    description: 'Over-ear headphones in a dark blue case.',
    reporter: 'Jamie L.',
  },
  {
    id: 'sage-bottle',
    title: 'Sage green water bottle',
    category: 'Everyday items',
    status: 'Found',
    location: 'Waterfront Park',
    date: 'Yesterday',
    daysAgo: 1,
    icon: '🧴',
    color: 'mint',
    description: 'Insulated bottle with a little daisy sticker.',
    privateDetails: 'There is a small dent near the base.',
    reporter: 'Taylor K.',
  },
  {
    id: 'brown-wallet',
    title: 'Brown leather cardholder',
    category: 'Bags & wallets',
    status: 'Found',
    location: 'Cafeteria',
    date: 'Yesterday',
    daysAgo: 1,
    icon: '👛',
    color: 'rose',
    description: 'Slim leather wallet. Identify a private detail to help verify ownership.',
    privateDetails: 'A small handwritten note is tucked in the inside pocket.',
    reporter: 'Morgan D.',
  },
  {
    id: 'tortoiseshell-glasses',
    title: 'Tortoiseshell reading glasses',
    category: 'Accessories',
    status: 'Lost',
    location: 'Central Library',
    date: '2 days ago',
    daysAgo: 2,
    icon: '👓',
    color: 'cream',
    description: 'Round frames, possibly in a soft beige case.',
    reporter: 'Riley P.',
  },
];

export const initialThreads: DemoThread[] = [
  {
    id: 'thread-backpack',
    title: 'Has anyone seen an olive green backpack?',
    label: 'LOST ITEM',
    author: 'Alex M.',
    time: '2 hours ago',
    excerpt: 'I left it near room 503, 5th Floor at the New Academic Building.',
    replies: ['I saw a similar backpack near the east entrance. I’ll check again on my walk home!'],
  },
  {
    id: 'thread-keys',
    title: 'Keys found at New Academic Bldg.',
    label: 'FOUND ITEM',
    author: 'Sam R.',
    time: '3 hours ago',
    excerpt: 'I handed a set of keys with a leather keyring to the front desk.',
    replies: ['Thanks for handing these in! I’ll check with the front desk.'],
  },
  {
    id: 'thread-kindness',
    title: 'A little kindness goes a long way',
    label: 'COMMUNITY',
    author: 'Taylor K.',
    time: 'Yesterday',
    excerpt: 'My water bottle is back home! Thanks to the students who kept it safe.',
    replies: ['So glad it made it back to you!'],
  },
];

const readList = <T,>(key: string, fallback: T[]): T[] => {
  const stored = window.localStorage.getItem(key);
  return stored ? JSON.parse(stored) as T[] : fallback;
};

export const getItems = () => readList(itemStorageKey, initialItems);
export const saveItems = (items: DemoItem[]) => window.localStorage.setItem(itemStorageKey, JSON.stringify(items));
export const getClaims = () => readList<DemoClaim>(claimStorageKey, []);
export const saveClaims = (claims: DemoClaim[]) => window.localStorage.setItem(claimStorageKey, JSON.stringify(claims));
export const getThreads = () => readList(threadStorageKey, initialThreads);
export const saveThreads = (threads: DemoThread[]) => window.localStorage.setItem(threadStorageKey, JSON.stringify(threads));
export const getSavedItems = () => readList<string>(savedStorageKey, []);
export const saveSavedItems = (ids: string[]) => window.localStorage.setItem(savedStorageKey, JSON.stringify(ids));
export const getFollowingThreads = () => readList<string>(followingStorageKey, []);
export const saveFollowingThreads = (ids: string[]) => window.localStorage.setItem(followingStorageKey, JSON.stringify(ids));
export const getMessages = () => readList<DemoMessage>(messageStorageKey, []);
export const saveMessages = (messages: DemoMessage[]) => window.localStorage.setItem(messageStorageKey, JSON.stringify(messages));

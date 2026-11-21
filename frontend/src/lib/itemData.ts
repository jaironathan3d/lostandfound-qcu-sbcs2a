export type ItemStatus = 'Lost' | 'Found';
export type LostItemStatus = 'OPEN' | 'MATCH_PENDING' | 'FOUND' | 'RETURNED';

export type ItemListing = {
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
  reporter?: string;
  imageUrl?: string;
  lostItemStatus?: LostItemStatus;
};

const savedStorageKey = 'qcu-demo-saved-items';

export const getSavedItems = (): string[] => {
  const stored = window.localStorage.getItem(savedStorageKey);
  return stored ? JSON.parse(stored) as string[] : [];
};

export const saveSavedItems = (ids: string[]): void => {
  window.localStorage.setItem(savedStorageKey, JSON.stringify(ids));
};

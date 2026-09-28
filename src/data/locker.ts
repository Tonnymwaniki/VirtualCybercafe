import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type LockerCategory = 'Documents' | 'Photos' | 'Certificates';

export type LockerItem = {
  id: string;
  name: string;
  detail: string;
  date: string;
  category: LockerCategory;
  icon: IconName;
  color: string;
};

// Sample data until accounts and secure storage exist.
export const lockerItems: LockerItem[] = [
  {
    id: '1',
    name: 'National ID',
    detail: 'ID · 2.4 MB',
    date: '12 Apr 2025',
    category: 'Documents',
    icon: 'card',
    color: '#22C55E',
  },
  {
    id: '2',
    name: 'Passport Photo',
    detail: 'Photo · 187 KB',
    date: '12 Apr 2025',
    category: 'Photos',
    icon: 'person',
    color: '#F59E0B',
  },
  {
    id: '3',
    name: 'Degree Certificate',
    detail: 'Certificate · 1.2 MB',
    date: '10 Apr 2025',
    category: 'Certificates',
    icon: 'ribbon',
    color: '#EAB308',
  },
  {
    id: '4',
    name: 'CV (Updated)',
    detail: 'Document · 320 KB',
    date: '8 Apr 2025',
    category: 'Documents',
    icon: 'document-text',
    color: '#3B82F6',
  },
  {
    id: '5',
    name: 'Business Registration',
    detail: 'Certificate · 1.8 MB',
    date: '5 Apr 2025',
    category: 'Certificates',
    icon: 'briefcase',
    color: '#F97316',
  },
  {
    id: '6',
    name: 'KRA PIN Certificate',
    detail: 'Document · 950 KB',
    date: '3 Apr 2025',
    category: 'Documents',
    icon: 'receipt',
    color: '#6366F1',
  },
];

export const lockerFilters: ('All' | LockerCategory)[] = [
  'All',
  'Documents',
  'Photos',
  'Certificates',
];

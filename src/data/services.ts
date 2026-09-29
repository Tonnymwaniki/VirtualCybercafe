import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type Service = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: IconName;
  color: string;
  // Screen that handles this service, once it has one.
  route?: Href;
};

// Sample data until the services come from the backend.
export const services: Service[] = [
  {
    id: 'government',
    title: 'Government Services',
    shortTitle: 'Government',
    description: 'eCitizen, KRA, NTSA, passports and more',
    icon: 'business',
    color: '#2563EB',
    route: '/gov',
  },
  {
    id: 'jobs',
    title: 'Jobs & Career',
    shortTitle: 'Jobs',
    description: 'CVs, job applications, career support',
    icon: 'briefcase',
    color: '#EF4444',
    route: '/jobs',
  },
  {
    id: 'education',
    title: 'Education',
    shortTitle: 'Education',
    description: 'KUCCPS, HELB, school forms and more',
    icon: 'school',
    color: '#14B8A6',
    route: '/education',
  },
  {
    id: 'documents',
    title: 'Documents',
    shortTitle: 'Documents',
    description: 'Shrink PDFs and photos, scan, join, split, PDF to JPG',
    icon: 'document-text',
    color: '#3B82F6',
    route: '/studio',
  },
  {
    id: 'print',
    title: 'Print & Scan',
    shortTitle: 'Print',
    description: 'Print, photocopy, scan, lamination',
    icon: 'print',
    color: '#F59E0B',
    route: '/print',
  },
  {
    id: 'business',
    title: 'Business Services',
    shortTitle: 'Business',
    description: 'Permits, tax, invoices, adverts and tenders',
    icon: 'bar-chart',
    color: '#22C55E',
    route: '/business',
  },
  {
    id: 'travel',
    title: 'Travel & Visa',
    shortTitle: 'Travel',
    description: 'Visa rules, forms, letters and work abroad safety',
    icon: 'airplane',
    color: '#6366F1',
    route: '/travel',
  },
  {
    id: 'payments',
    title: 'Payments & Bills',
    shortTitle: 'Payments',
    description: 'Electricity, water, internet, school fees',
    icon: 'wallet',
    color: '#EC4899',
  },
];

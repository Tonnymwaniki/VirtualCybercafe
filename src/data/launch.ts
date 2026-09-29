// Version one launches with a few services done well. The rest stay in the
// code and show "Coming soon" until they are ready. Set EXPO_PUBLIC_FULL_APP=1
// in .env to switch every service back on while developing.

import type { Workspace } from '@/data/catalogue';

export const FULL_APP = process.env.EXPO_PUBLIC_FULL_APP === '1';

const liveWorkspaces: Workspace[] = ['jobs', 'documents', 'account'];

export function isLiveWorkspace(workspace: Workspace) {
  return FULL_APP || liveWorkspaces.includes(workspace);
}

// The Home and Services tiles, by service id. Payments has no workspace yet.
const serviceWorkspace: Record<string, Workspace> = {
  government: 'government',
  jobs: 'jobs',
  education: 'education',
  documents: 'documents',
  print: 'print',
  business: 'business',
  travel: 'travel',
  account: 'account',
};

export function isLiveService(serviceId: string) {
  const workspace = serviceWorkspace[serviceId];
  return workspace ? isLiveWorkspace(workspace) : false;
}

// Screens that belong to services that are not live yet.
const hiddenPaths: [string, Workspace][] = [
  ['/gov', 'government'],
  ['/education', 'education'],
  ['/business', 'business'],
  ['/travel', 'travel'],
  ['/print', 'print'],
];

export function isLivePath(route: string) {
  const path = route.split('?')[0];
  const match = hiddenPaths.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? isLiveWorkspace(match[1]) : true;
}

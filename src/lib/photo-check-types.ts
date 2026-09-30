// What the AI photo check reports, shared by /api/photo-check and the app.
export type PhotoVerdict =
  | { available: false; reason?: string }
  | {
      available: true;
      onePerson: boolean;
      faceCentred: boolean;
      background: 'white' | 'plain_light' | 'plain_dark' | 'busy';
      glasses: boolean;
      sharp: boolean;
      tips: string[];
    };

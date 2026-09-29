// Everything the app can do, in one list: workspaces, guided tasks and tools.
// It powers the free keyword search on Home and in chat, the attendant's
// open_screen tool, the "Help me here" button and the next-step suggestions.

import { isLiveWorkspace } from '@/data/launch';
import { bizTasks, eduTasks, govTasks, travelTasks, type GovTask } from '@/data/gov-tasks';

export type Workspace = 'government' | 'jobs' | 'education' | 'documents' | 'print' | 'business' | 'travel' | 'account';

// Values a screen can be opened with, e.g. /travel?destination=Canada.
export type ScreenParam = 'destination' | 'purpose' | 'q' | 'topic' | 'customer';

export type CatalogueEntry = {
  id: string;
  title: string;
  description: string;
  route: string;
  workspace: Workspace;
  // Extra words people use, in English, Swahili and Sheng. The title and
  // description are searched too.
  keywords: string[];
  // What to tell someone who taps "Help me here" on this screen.
  help?: string;
  // Params the screen reads to fill itself in.
  params?: ScreenParam[];
  // Catalogue ids worth doing after this one.
  next?: string[];
  // Detail screens: only used to explain the screen, never suggested.
  hidden?: boolean;
  // Other paths that show this screen, as patterns like /jobs/*.
  paths?: string[];
};

const workspaceOf = (task: GovTask): Workspace =>
  bizTasks.includes(task) ? 'business' : eduTasks.includes(task) ? 'education' : travelTasks.includes(task) ? 'travel' : 'government';

const taskKeywords: Record<string, string[]> = {
  good_conduct: ['police clearance', 'dci', 'cheti cha tabia njema', 'tabia njema', 'clearance certificate'],
  kra_pin: ['pin', 'kra', 'itax', 'tax pin', 'pini'],
  passport: ['pasipoti', 'paspoti', 'immigration', 'renew passport'],
  lost_id: ['kitambulisho', 'id card', 'lost id', 'kipande', 'waiting card', 'replace id', 'national id'],
  driving_licence: ['dl', 'smart dl', 'leseni', 'ntsa', 'tims', 'driving'],
  birth_certificate: ['cheti cha kuzaliwa', 'birth cert', 'crs'],
  sha: ['nhif', 'shif', 'afya', 'health insurance', 'sha'],
  kra_returns: ['returns', 'nil return', 'file returns', 'p9', 'ushuru', 'tax return'],
  student_funding: ['helb loan', 'hef', 'scholarship', 'bursary', 'university funding', 'fees loan', 'mkopo'],
  helb_clearance: ['helb certificate', 'helb compliance', 'helb clearance'],
  knec_certificate: ['kcse certificate', 'lost certificate', 'knec', 'replace certificate', 'result slip'],
  business_name: ['register business', 'business name', 'brs', 'sole proprietor', 'sajili biashara'],
  business_permit: ['single business permit', 'county permit', 'leseni ya biashara', 'trade licence', 'kanjo'],
  turnover_tax: ['tot', 'turnover', 'small business tax'],
  company_registration: ['limited company', 'ltd', 'cr12', 'incorporate', 'kampuni'],
  agpo: ['youth women pwd', 'access to government procurement', 'agpo'],
  kenya_eta: ['eta', 'visitor to kenya', 'electronic travel authorisation', 'mgeni'],
};

const taskNext: Record<string, string[]> = {
  kra_pin: ['business_name', 'kra_returns', 'jobs'],
  lost_id: ['kra_pin', 'good_conduct'],
  good_conduct: ['jobs', 'abroad'],
  passport: ['travel', 'abroad'],
  business_name: ['business_permit', 'turnover_tax', 'bill_invoice'],
  business_permit: ['bill_invoice', 'write_poster'],
  company_registration: ['agpo', 'business_permit'],
  agpo: ['tenders'],
  student_funding: ['helb_clearance', 'kuccps'],
  helb_clearance: ['jobs', 'cv'],
  knec_certificate: ['kuccps', 'jobs'],
  birth_certificate: ['passport', 'lost_id'],
  driving_licence: ['jobs'],
};

const taskEntries: CatalogueEntry[] = [...govTasks, ...eduTasks, ...bizTasks, ...travelTasks].map((task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  route: `/gov/${task.id}`,
  workspace: workspaceOf(task),
  keywords: [...(taskKeywords[task.id] ?? []), task.agency],
  help: 'This guided task has 5 steps at the top: What you need, Are you ready?, Your details (filled from My Details, with the form helper), Pay, and Track. Go through them in order.',
  next: taskNext[task.id],
}));

const toolEntries: CatalogueEntry[] = [
  {
    id: 'government',
    title: 'Government Services',
    description: 'Guided eCitizen, KRA, NTSA, passport, ID and SHA tasks',
    route: '/gov',
    workspace: 'government',
    keywords: ['serikali', 'ecitizen', 'huduma', 'government'],
    help: 'Pick a task. Each one tells you what you need, checks your Locker, fills the form from My Details and tracks your progress.',
  },
  {
    id: 'jobs',
    title: 'Jobs & Career',
    description: 'Find jobs, read an advert, tailored CV and letter, scam check, tracker',
    route: '/jobs',
    workspace: 'jobs',
    keywords: ['kazi', 'job', 'jobs', 'advert', 'tangazo', 'vacancy', 'employment', 'ajira', 'interview', 'apply job', 'kibarua'],
    help: 'Paste a job advert, share a link or take a photo of it, or search for jobs. I read it, check how well you match, write a CV and letter for it, warn about scams and track the application.',
    params: ['q'],
    paths: ['/jobs/*'],
    next: ['cv', 'good_conduct'],
  },
  {
    id: 'cv',
    title: 'CV & Cover Letter',
    description: 'Build a CV and cover letter from My Details',
    route: '/cv',
    workspace: 'jobs',
    keywords: ['cv', 'resume', 'wasifu', 'cover letter', 'barua ya kazi', 'curriculum vitae'],
    help: 'Your CV is built from My Details (education, career and skills). Fill anything missing, then download it as a PDF or send it to Print Hub.',
    next: ['jobs', 'print'],
  },
  {
    id: 'education',
    title: 'Education',
    description: 'KUCCPS, HELB, KNEC and admission letters',
    route: '/education',
    workspace: 'education',
    keywords: ['elimu', 'shule', 'chuo', 'university', 'college', 'school', 'admission', 'fee structure', 'karo'],
    help: 'Choose courses with your KCSE grades, apply for funding, get a HELB certificate or a KNEC certificate, or read an admission letter and fee structure.',
    paths: ['/education/letter/*'],
  },
  {
    id: 'kuccps',
    title: 'KUCCPS course choice',
    description: 'Courses you qualify for from your KCSE grades, with job demand',
    route: '/education/kuccps',
    workspace: 'education',
    keywords: ['kuccps', 'kcse', 'course', 'kozi', 'placement', 'grades', 'cluster', 'revision'],
    help: 'Enter your KCSE grades once. I show courses you qualify for, check the job market for each, and help you pick your choices.',
    next: ['student_funding'],
  },
  {
    id: 'studio',
    title: 'Document Workbench',
    description: 'Shrink PDFs and photos, resize, scan, join, split and PDF to JPG',
    route: '/studio',
    workspace: 'documents',
    keywords: ['document', 'nyaraka', 'documents', 'workbench', 'studio', 'upload', 'file'],
    help: 'Pick a tool by what the form needs: fit an upload limit, make a PDF, or change a PDF. Each tool shows the finished file with its size, type and pages checked, then Download or Save to Locker.',
  },
  {
    id: 'shrink_pdf',
    title: 'Shrink a PDF',
    description: 'Make a PDF small enough for an upload limit, e.g. under 1 MB',
    route: '/studio/shrink-pdf',
    workspace: 'documents',
    keywords: ['compress pdf', 'reduce pdf', 'pdf too big', 'pdf size', 'pdf 1mb', 'punguza pdf', 'pdf kubwa', 'shrink pdf'],
    help: 'Pick the size limit, choose the PDF and tap Shrink. Scanned PDFs get much smaller; the pages become pictures, so check they are still easy to read.',
  },
  {
    id: 'passport_photo',
    title: 'Passport photo',
    description: 'Crop and shrink a photo to passport size for online forms',
    route: '/studio/passport',
    workspace: 'documents',
    keywords: ['passport photo', 'picha ya pasipoti', 'passport size', 'id photo', 'photo 600'],
    help: 'Take or pick a photo with a plain light background. I crop it to the size forms ask for and keep it under the file limit.',
  },
  {
    id: 'scan',
    title: 'Scan a document',
    description: 'Photograph a page and clean it up like a scanner, then save as PDF',
    route: '/studio/scan',
    workspace: 'documents',
    keywords: ['scan', 'scanner', 'skana', 'scan document', 'scan certificate', 'clean up', 'black and white'],
    help: 'Take a photo of each page flat, in good light. Turn it if needed and pick a look: Clean makes paper white and writing dark. Then save all pages as one PDF.',
  },
  {
    id: 'photos_to_pdf',
    title: 'Photos to PDF',
    description: 'Join photos of pages into one PDF',
    route: '/studio/photos-to-pdf',
    workspace: 'documents',
    keywords: ['jpg to pdf', 'photo to pdf', 'image to pdf', 'picha kuwa pdf', 'photos to pdf'],
    help: 'Take photos of each page in order, then make one PDF you can upload or save to your Locker.',
  },
  {
    id: 'merge_pdf',
    title: 'Join PDFs',
    description: 'Combine several PDFs and photos into one PDF',
    route: '/studio/merge',
    workspace: 'documents',
    keywords: ['merge', 'combine', 'join', 'unganisha', 'one pdf', 'merge pdf', 'combine documents'],
    help: 'Add the PDFs and photos, put them in order with the arrows, then tap Join.',
  },
  {
    id: 'split_pdf',
    title: 'Pick or split pages',
    description: 'Keep only some pages, remove pages, or split a PDF into single pages',
    route: '/studio/split',
    workspace: 'documents',
    keywords: ['split', 'extract pages', 'remove page', 'delete page', 'separate', 'tenganisha', 'page 1 only'],
    help: 'Choose the PDF, then tap the pages you want (or type them, like 1-3, 5). Keep them, remove them, or split every page into its own file.',
  },
  {
    id: 'pdf_to_jpg',
    title: 'PDF to JPG',
    description: 'Turn PDF pages into pictures for forms that only take JPG',
    route: '/studio/pdf-to-jpg',
    workspace: 'documents',
    keywords: ['pdf to jpg', 'pdf to image', 'pdf to picture', 'convert pdf', 'jpg only', 'pdf kuwa picha'],
    help: 'Choose the PDF, leave pages empty for all (or type some), and tap Make JPGs. Save each picture or put it in your Locker.',
  },
  {
    id: 'shrink_photo',
    title: 'Shrink a photo',
    description: 'Make a photo small enough for an upload limit',
    route: '/studio/compress',
    workspace: 'documents',
    keywords: ['compress', 'reduce size', 'kb', 'too large', 'file size', 'punguza', 'compress photo', 'photo too big'],
    help: 'Pick the size limit the site asks for, then the photo. It keeps as much quality as fits.',
  },
  {
    id: 'resize_photo',
    title: 'Resize a photo',
    description: 'Set a photo to exact pixels, e.g. 600 × 600',
    route: '/studio/resize',
    workspace: 'documents',
    keywords: ['resize', 'dimensions', 'pixels', 'px', '600x600', 'width height', 'badilisha ukubwa'],
    help: 'Choose the photo, type the width and height (or tap a quick size), choose exact size or keep the whole photo, then Resize.',
  },
  {
    id: 'print',
    title: 'Print Hub',
    description: 'Send a file to a print shop near you and collect with a code',
    route: '/print',
    workspace: 'print',
    keywords: ['print', 'printi', 'chapisha', 'photocopy', 'copy', 'lamination', 'printing'],
    help: 'Pick a file from your Locker or phone, choose a shop, and send it. You get a pickup code and pay the shop when you collect.',
    paths: ['/print/*'],
  },
  {
    id: 'print_shop',
    title: 'Register my cybercafe',
    description: 'For shop owners: receive print jobs from the app',
    route: '/print/shop',
    workspace: 'print',
    keywords: ['my shop', 'cybercafe owner', 'register shop', 'print shop'],
    help: 'Register your shop to receive print jobs, then enter the customer’s pickup code when they collect.',
  },
  {
    id: 'business',
    title: 'Business',
    description: 'Permits, tax, invoices, receipts, adverts, business plan and tenders',
    route: '/business',
    workspace: 'business',
    keywords: ['biashara', 'business', 'duka', 'shop', 'hustle', 'sme'],
    help: 'Register and license your business, make invoices and receipts, write adverts or a business plan, and find tenders. Everything fills from My Details > Business.',
  },
  {
    id: 'bill_invoice',
    title: 'Invoice',
    description: 'Make an invoice with your till number',
    route: '/business/bill/new?kind=invoice',
    workspace: 'business',
    keywords: ['invoice', 'bill customer', 'ankara', 'charge'],
    params: ['customer'],
    paths: ['/business/bill/*'],
    help: 'Add the customer and items. The total adds itself. Save it, then download the PDF, save it to your Locker or print it.',
  },
  {
    id: 'bill_receipt',
    title: 'Receipt',
    description: 'Make a receipt for a payment',
    route: '/business/bill/new?kind=receipt',
    workspace: 'business',
    keywords: ['receipt', 'risiti', 'payment received'],
    params: ['customer'],
  },
  {
    id: 'bill_quotation',
    title: 'Quotation',
    description: 'Make a quotation for a customer',
    route: '/business/bill/new?kind=quotation',
    workspace: 'business',
    keywords: ['quotation', 'quote', 'estimate', 'bei'],
    params: ['customer'],
  },
  {
    id: 'bill_pricelist',
    title: 'Price list',
    description: 'Make a price list for your shop',
    route: '/business/bill/new?kind=pricelist',
    workspace: 'business',
    keywords: ['price list', 'menu', 'orodha ya bei'],
  },
  {
    id: 'write_poster',
    title: 'Poster',
    description: 'Write an advert poster for your business',
    route: '/business/write/new?kind=poster',
    workspace: 'business',
    keywords: ['poster', 'advert', 'tangazo', 'flyer', 'marketing', 'matangazo'],
    params: ['topic'],
    paths: ['/business/write/*'],
    help: 'Say what you are advertising. I write it using your saved business details; edit it and download or print.',
  },
  {
    id: 'write_post',
    title: 'Social media post',
    description: 'Write a WhatsApp, Facebook or Instagram post',
    route: '/business/write/new?kind=post',
    workspace: 'business',
    keywords: ['post', 'facebook', 'instagram', 'whatsapp status', 'tiktok', 'social media'],
    params: ['topic'],
  },
  {
    id: 'write_plan',
    title: 'Business plan',
    description: 'A simple business plan for a loan or grant',
    route: '/business/write/new?kind=plan',
    workspace: 'business',
    keywords: ['business plan', 'loan', 'mkopo', 'grant', 'uwezo', 'youth fund', 'hustler fund'],
    params: ['topic'],
  },
  {
    id: 'tenders',
    title: 'Tenders',
    description: 'Find government tenders and check AGPO eligibility',
    route: '/business/tenders',
    workspace: 'business',
    keywords: ['tender', 'zabuni', 'lpo', 'supply', 'procurement', 'ifmis'],
    params: ['q'],
    paths: ['/business/tender/*'],
    help: 'Say what your business supplies. I search official tender sites, flag fake tenders and check your documents. No one can sell a tender or an LPO.',
  },
  {
    id: 'travel',
    title: 'Travel & Visa',
    description: 'Visa rules for Kenyans, visa form, letters and documents',
    route: '/travel',
    workspace: 'travel',
    keywords: ['visa', 'viza', 'travel', 'safari', 'abroad', 'nje', 'embassy', 'ubalozi', 'trip', 'uk', 'usa', 'canada', 'dubai', 'schengen'],
    help: 'Add a trip with the country and dates. I check the visa rules on official sites, list your documents, fill the visa form from your passport details and write your letters.',
    params: ['destination', 'purpose'],
    paths: ['/travel/trip/*'],
    next: ['passport'],
  },
  {
    id: 'abroad',
    title: 'Working abroad safety',
    description: 'Check a recruitment agency and a job offer abroad for scams',
    route: '/travel/abroad',
    workspace: 'travel',
    keywords: ['agent', 'agency', 'nea', 'kazi nje', 'saudi', 'qatar', 'gulf', 'overseas job', 'work abroad', 'recruitment'],
    help: 'Type the agency name to check it on the NEA list, and paste the offer to check it for scam signs. Never pay before you check.',
    next: ['good_conduct', 'passport'],
  },
  {
    id: 'locker',
    title: 'Locker',
    description: 'Your private documents, saved safely',
    route: '/locker',
    workspace: 'account',
    keywords: ['locker', 'my documents', 'files', 'hifadhi', 'saved documents'],
    help: 'Save your ID, certificates and photos here once. Tasks check the Locker to see what you already have.',
  },
  {
    id: 'profile',
    title: 'My Details',
    description: 'Your details once, used to fill every form',
    route: '/profile',
    workspace: 'account',
    keywords: ['my details', 'profile', 'maelezo yangu', 'personal details', 'id number'],
    help: 'Fill your details once: ID, contacts, education, career, business and passport. Every form and CV fills from here.',
  },
  {
    id: 'sign_in',
    title: 'Sign in',
    description: 'Sign in with your phone to keep your Locker and details',
    route: '/sign-in',
    workspace: 'account',
    keywords: ['login', 'sign in', 'ingia', 'account'],
  },
];

export const catalogue: CatalogueEntry[] = [...toolEntries, ...taskEntries];

// What people can be pointed to: live services only, no detail screens.
export const liveCatalogue = catalogue.filter((entry) => !entry.hidden && isLiveWorkspace(entry.workspace));

export function findEntry(id: string | undefined) {
  return catalogue.find((entry) => entry.id === id);
}

// Which entry shows this path, e.g. /gov/kra_pin or /jobs/abc123.
export function entryForPath(pathname: string): CatalogueEntry | undefined {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const base = (route: string) => route.split('?')[0];
  return (
    catalogue.find((entry) => base(entry.route) === path) ??
    catalogue.find((entry) => entry.paths?.some((p) => p.endsWith('/*') && path.startsWith(p.slice(0, -1))))
  );
}

// The entry's route with the allowed params filled in.
export function routeWith(entry: CatalogueEntry, params: Partial<Record<ScreenParam, string>> = {}) {
  const extra = (entry.params ?? [])
    .filter((key) => params[key]?.trim())
    .map((key) => `${key}=${encodeURIComponent(params[key]!.trim().slice(0, 120))}`);
  if (!extra.length) return entry.route;
  return `${entry.route}${entry.route.includes('?') ? '&' : '?'}${extra.join('&')}`;
}

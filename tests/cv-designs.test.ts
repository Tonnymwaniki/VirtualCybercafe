import { writeFileSync } from 'fs';

import { cvDesigns, cvHtml, letterHtml, sampleCv, type CvAnswers } from '@/lib/cv';
import { packHtml } from '@/lib/job-pack';

const answers: CvAnswers = {
  fullName: 'Jane <Wanjiku>',
  phone: '0712 345 678',
  email: 'jane@email.com',
  location: 'Nairobi',
  targetJob: 'Customer care assistant',
  experience: 'Cashier at Naivas, 2021 to 2024. Served 200 customers a day.',
  education: 'KCSE, Moi Girls, 2020, B+',
  skills: 'Customer service, M-Pesa, Excel',
  company: 'Safaricom',
};
const cv = sampleCv(answers);

describe('CV designs', () => {
  it.each(cvDesigns.map((d) => d.id))('%s CV and letter carry the details, escaped', (design) => {
    const html = cvHtml(cv, answers, design);
    const letter = letterHtml(cv, answers, design);
    for (const page of [html, letter]) {
      expect(page).toContain('Jane &lt;Wanjiku&gt;');
      expect(page).not.toContain('<Wanjiku>');
      expect(page).toContain('0712 345 678');
    }
    for (const skill of cv.skills) expect(html).toContain(skill);
    expect(html).toContain('Referees');
    if (process.env.CV_OUT) {
      writeFileSync(`${process.env.CV_OUT}/cv-${design}.html`, html);
      writeFileSync(`${process.env.CV_OUT}/letter-${design}.html`, letter);
    }
  });

  it('keeps the chosen design in the application pack', () => {
    const pack = packHtml(cv, answers, [], 'modern');
    expect(pack).toContain('td.side');
    expect(pack).toContain('class="letter"');
    expect(packHtml(cv, answers, [])).not.toContain('td.side');
  });
});

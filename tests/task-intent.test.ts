import { taskIntent } from '@/lib/task-intent';

describe('job application card from plain words', () => {
  it('shows the application card for "apply for a job"', () => {
    const result = taskIntent('I need to apply for a job', 'en');
    expect(result?.actions[0]?.type).toBe('task');
  });

  it('ignores other messages', () => {
    expect(taskIntent('how much is a passport?', 'en')).toBeNull();
  });
});

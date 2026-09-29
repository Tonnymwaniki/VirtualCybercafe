/**
 * @jest-environment node
 */
import { adaptRequest, modelFor } from '@/server/model-plan';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('model for each feature', () => {
  it('uses the default model everywhere until a writing model is set', () => {
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_WRITING_MODEL;
    delete process.env.AI_MODELS;
    expect(modelFor('chat')).toBe('claude-haiku-4-5');
    expect(modelFor('jobs.tailor')).toBe('claude-haiku-4-5');
  });

  it('sends writing features to the writing model', () => {
    process.env.ANTHROPIC_WRITING_MODEL = 'claude-opus-5-5';
    expect(modelFor('cv')).toBe('claude-opus-5-5');
    expect(modelFor('jobs.tailor')).toBe('claude-opus-5-5');
    expect(modelFor('jobs.read_advert')).toBe('claude-haiku-4-5');
    expect(modelFor('chat')).toBe('claude-haiku-4-5');
  });

  it('follows AI_MODELS overrides, action first', () => {
    process.env.AI_MODELS = 'chat=claude-sonnet-5-5, jobs.match=claude-opus-5-5, bad=gpt';
    expect(modelFor('chat')).toBe('claude-sonnet-5-5');
    expect(modelFor('jobs.match')).toBe('claude-opus-5-5');
    expect(modelFor('bad')).toBe('claude-haiku-4-5');
  });
});

describe('moving a request between models', () => {
  const haikuBody = {
    model: 'claude-haiku-4-5',
    max_tokens: 100,
    output_config: { format: { type: 'json_schema' } },
    tools: [{ type: 'web_search_20250305', name: 'web_search' }, { name: 'report' }],
  };

  it('adds thinking and newer tools for a larger model', () => {
    const { body, fallbackBeta } = adaptRequest(haikuBody, 'claude-opus-5-5');
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
    expect(body.tools?.[0].type).toBe('web_search_20260209');
    expect(fallbackBeta).toBe(true);
  });

  it('strips what Haiku does not take', () => {
    const opus = adaptRequest(haikuBody, 'claude-opus-5-5').body;
    const { body, fallbackBeta } = adaptRequest(opus, 'claude-haiku-4-5');
    expect(body.thinking).toBeUndefined();
    expect(body.fallbacks).toBeUndefined();
    expect(body.output_config).toEqual({ format: { type: 'json_schema' } });
    expect(body.tools?.[0].type).toBe('web_search_20250305');
    expect(fallbackBeta).toBe(false);
  });
});

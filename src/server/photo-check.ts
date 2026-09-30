// Looks at a passport-style photo the way an officer would: is there one
// face, centred and facing the camera, on a plain background, without
// glasses, sharp and well lit? Pixels and file size are measured on the
// phone; this only judges what the picture shows.

import Anthropic from '@anthropic-ai/sdk';

import type { PhotoVerdict } from '@/lib/photo-check-types';
import { effortOption, MODEL, modelOptions } from '@/server/model';
import { claude } from '@/server/claude';

const schema = {
  type: 'object',
  properties: {
    onePerson: { type: 'boolean', description: 'Exactly one person is in the photo.' },
    faceCentred: { type: 'boolean', description: 'The face is centred, facing the camera, head and top of shoulders visible, not cut off.' },
    background: { type: 'string', enum: ['white', 'plain_light', 'plain_dark', 'busy'], description: 'What is behind the person.' },
    glasses: { type: 'boolean', description: 'The person wears glasses or sunglasses.' },
    sharp: { type: 'boolean', description: 'In focus, evenly lit, no strong shadows or glare on the face.' },
    tips: { type: 'array', items: { type: 'string' }, description: 'At most 3 short, kind fixes in plain English, e.g. "Stand in front of a plain white wall". Empty if the photo is fine.' },
  },
  required: ['onePerson', 'faceCentred', 'background', 'glasses', 'sharp', 'tips'],
  additionalProperties: false,
} as const;

export async function checkPhoto(base64: string): Promise<PhotoVerdict> {
  const response = await claude().beta.messages.create({
    model: MODEL,
    max_tokens: 1000,
    ...modelOptions,
    output_config: { ...effortOption, format: { type: 'json_schema', schema } },
    system:
      'You check photos for Kenyan government and school application forms (passport-style photos). Judge only what you can see. Do not describe or guess the person’s identity, age, ethnicity or anything else about them.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: 'Check this photo for an application form.' },
        ],
      },
    ],
  });
  if (response.stop_reason === 'refusal') return { available: false };
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const parsed = JSON.parse(text) as Omit<Extract<PhotoVerdict, { available: true }>, 'available'>;
  return { available: true, ...parsed, tips: parsed.tips.slice(0, 3) };
}

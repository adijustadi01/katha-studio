// Optional AI assistant using the user's own Anthropic API key.
// Nothing is sent unless the user clicks an AI action and confirms the preview.
import Anthropic from '@anthropic-ai/sdk';
import { platform } from '../platform';
import { prefs } from './prefs';
import type { ScriptElement } from '../core/types';
import { toFountain } from '../core/formats/fountain';

export interface AIRequest {
  system: string;
  user: string;
  /** what the result is: replacement script (Fountain) or plain text */
  output: 'fountain' | 'text';
}

export interface AIAction {
  id: string;
  name: string;
  scope: ('scene' | 'selection' | 'script')[];
  output: 'fountain' | 'text';
  needsTarget?: 'tone' | 'lang';
  build: (o: { script: string; target?: string; title: string }) => { system: string; user: string };
}

const BASE = `You are a senior screenwriter and script doctor for South Indian commercial cinema (Tamil, Telugu, Malayalam, Kannada, Hindi) with pan-Indian appeal. You understand mass moments, hero elevation, punch dialogue, comedy tracks, songs and the interval block.`;

const FOUNTAIN_RULES = `The scene text uses Fountain screenplay format. Reply with ONLY the revised Fountain text — no commentary, no code fences. Keep scene headings, character cues, parentheticals and transitions in valid Fountain. Keep every [[katha:...]] note exactly as it is, attached to the same element. Keep each line in its original language and script unless asked to translate (Tamil stays in Tamil script, Telugu in Telugu script). Keep each character's voice.`;

export const AI_ACTIONS: AIAction[] = [
  {
    id: 'punchup',
    name: 'Punch up dialogue',
    scope: ['scene', 'selection'],
    output: 'fountain',
    build: ({ script }) => ({
      system: `${BASE}\n${FOUNTAIN_RULES}`,
      user: `Punch up the dialogue in this scene: sharper, more quotable, more emotional or more mass where it fits — but keep the same story beats, the same languages and each character's voice. Don't change action lines unless needed.\n\n${script}`,
    }),
  },
  {
    id: 'mass',
    name: 'Make it more commercial / mass',
    scope: ['scene', 'selection'],
    output: 'fountain',
    build: ({ script }) => ({
      system: `${BASE}\n${FOUNTAIN_RULES}`,
      user: `Rewrite this scene to be more commercial and "mass": build anticipation, give the hero an elevation beat and a punch line, heighten the crowd reaction, keep it shootable. Keep the story outcome and languages.\n\n${script}`,
    }),
  },
  {
    id: 'tone',
    name: 'Rewrite in a different tone',
    scope: ['scene', 'selection'],
    output: 'fountain',
    needsTarget: 'tone',
    build: ({ script, target }) => ({
      system: `${BASE}\n${FOUNTAIN_RULES}`,
      user: `Rewrite this scene in this tone: ${target}. Keep the story beats, characters and languages.\n\n${script}`,
    }),
  },
  {
    id: 'dub',
    name: 'Translate for dubbing (new draft)',
    scope: ['scene', 'selection', 'script'],
    output: 'fountain',
    needsTarget: 'lang',
    build: ({ script, target }) => ({
      system: `${BASE}\n${FOUNTAIN_RULES}\nYou are now also an expert dubbing writer.`,
      user: `Translate all DIALOGUE (and parentheticals) into ${target} for dubbing. Use the native script of ${target} (English stays in Latin script). Rules: keep the screenplay format; keep each translated line roughly the same length and syllable rhythm as the original so it is lip-sync friendly; keep each character's voice, slang level and punch; adapt idioms instead of translating literally. Keep scene headings and action lines in English. If a dialogue has a [[katha:...]] note containing "meaning", keep it unchanged.\n\n${script}`,
    }),
  },
  {
    id: 'continuity',
    name: 'Continuity & consistency check',
    scope: ['scene', 'script'],
    output: 'text',
    build: ({ script, title }) => ({
      system: BASE,
      user: `Check this screenplay${title ? ` ("${title}")` : ''} for continuity and consistency problems: character name variations, timeline/day-night errors, props or wardrobe that appear/disappear, contradictions, characters who know things they shouldn't, unresolved setups. List each issue with the scene heading and a one-line fix. Be concise.\n\n${script}`,
    }),
  },
  {
    id: 'summaries',
    name: 'Scene summaries',
    scope: ['scene', 'script'],
    output: 'text',
    build: ({ script }) => ({
      system: BASE,
      user: `Write a one or two sentence synopsis for every scene below, in English. Format each as: "<scene number or heading> — <synopsis>".\n\n${script}`,
    }),
  },
  {
    id: 'logline',
    name: 'Logline & one-page synopsis',
    scope: ['script'],
    output: 'text',
    build: ({ script, title }) => ({
      system: BASE,
      user: `For this screenplay${title ? ` "${title}"` : ''}, write (1) three alternative loglines (max 35 words each) that sell it to a producer, and (2) a one-page synopsis (about 400 words) covering first half, interval block and second half.\n\n${script}`,
    }),
  },
  {
    id: 'imageprompts',
    name: 'AI image prompts for previz',
    scope: ['scene', 'script'],
    output: 'text',
    build: ({ script }) => ({
      system: `${BASE} You are also a cinematographer creating previsualisation frames.`,
      user: `For each scene below, write 2 cinematic AI image-generation prompts for previz. Each prompt: photorealistic, 16:9, film still, the key moment of the scene, characters (with consistent descriptions), location, time of day, lens and focal length, camera height/angle, lighting setup and colour palette, mood. Format:\nSCENE <number/heading>\n1. <prompt>\n2. <prompt>\n\n${script}`,
    }),
  },
];

/** Script text sent to the model (Fountain without formatting spans). */
export function scriptForAI(els: ScriptElement[]): string {
  const clean = els.map((e) => {
    const c: ScriptElement = { ...e };
    delete c.spans;
    delete c.rev;
    delete c.roman;
    return c;
  });
  return toFountain(clean).trim();
}

export async function getKey(): Promise<string | null> {
  return platform.getSecret('anthropic');
}

// models that accept output_config.effort and server-side refusal fallbacks
const EFFORT_MODELS = /^claude-(opus-(4-[5-8]|5|5-5)|sonnet-5(-5)?|fable-5(-1)?|haiku-5-5|mythos-5(-1)?)$/;
const FALLBACK_MODELS = /^claude-(opus-5(-5)?|fable-5-1|sonnet-5-5)$/;

export class AIError extends Error {}

export async function runAI(req: AIRequest, onProgress?: (chars: number) => void, signal?: AbortSignal): Promise<string> {
  const key = await getKey();
  if (!key) throw new AIError('Add your Anthropic API key in Settings → AI first.');
  const model = prefs.aiModel || 'claude-opus-5-5';
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
  const params: any = {
    model,
    max_tokens: 64000,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  };
  if (EFFORT_MODELS.test(model)) params.output_config = { effort: 'medium' };
  if (FALLBACK_MODELS.test(model)) {
    // re-run on a fallback model if a safety classifier declines (e.g. fight scenes)
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  try {
    const stream = client.beta.messages.stream(params, { signal });
    let n = 0;
    stream.on('text', (t: string) => {
      n += t.length;
      onProgress?.(n);
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') {
      const d = (msg as any).stop_details;
      throw new AIError(`The model declined this request${d?.explanation ? ': ' + d.explanation : '.'}`);
    }
    const text = msg.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    if (msg.stop_reason === 'max_tokens') return text + '\n\n[Output was cut off — try a smaller selection.]';
    return text;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AIError('Your API key was rejected. Check it in Settings → AI.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AIError('This API key cannot use the model "' + model + '".');
    if (e instanceof Anthropic.NotFoundError) throw new AIError(`Model "${model}" not found. Check the model name in Settings → AI.`);
    if (e instanceof Anthropic.RateLimitError) throw new AIError('Rate limited by the API — wait a minute and try again.');
    if (e instanceof Anthropic.BadRequestError) throw new AIError('The API rejected the request: ' + (e as Error).message);
    if (e instanceof Anthropic.APIUserAbortError) throw new AIError('Cancelled.');
    if (e instanceof Anthropic.APIConnectionError) throw new AIError('Could not reach api.anthropic.com — are you online?');
    if (e instanceof Anthropic.APIError) throw new AIError(`API error ${e.status}: ${e.message}`);
    throw e;
  }
}

/** Remove accidental code fences around a Fountain reply. */
export function stripFences(s: string): string {
  return s.replace(/^\s*```[a-z]*\s*\n/i, '').replace(/\n```\s*$/i, '').trim();
}

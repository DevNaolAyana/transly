// Manual prompt-quality test. NOT shipped to production and not imported by /api.
//
// Sends one sample document (photo or PDF) to Gemini with the EXTRACT prompt,
// then sends the extracted blocks through the TRANSLATE prompt.
//
// Usage (Node 22.18+ / 24, runs TypeScript directly):
//   node --env-file=.env scripts/gemini-test.ts [path-to-sample]
//
// Without a path it uses the first pdf/jpg/png in test-samples/ (gitignored).
// Use synthetic or sample documents only, never a real ID.
// Full outputs are written to test-samples/out/ (also gitignored).

import { GoogleGenAI } from '@google/genai';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Lang = 'om' | 'am' | 'en';
interface Block {
  id: string;
  type: string;
  text: string;
}
interface ExtractResult {
  detectedLanguage: string;
  documentType: string;
  blocks: Block[];
}

const EXTRACT_PROMPT =
  "You are reading a photographed or scanned official document. Extract ALL visible text exactly as written, in the original language. Do NOT translate, correct spelling, or guess. Write [unclear] for any word you cannot read. Keep reading order. Split into blocks with ids block-1, block-2, ... in order. Each block type is one of: heading, paragraph, table_row, list_item, stamp, signature, logo, handwriting. For table_row put the cells in one text separated by ' | '. For stamp, signature and logo, text is a short English description (for example 'round stamp, text unreadable'); only transcribe stamp text if it is clearly legible. Return only JSON: {\"detectedLanguage\":\"om|am|en|other\",\"documentType\":\"academic|id_certificate|legal|other\",\"blocks\":[{\"id\":\"block-1\",\"type\":\"heading\",\"text\":\"...\"}]}";

const TRANSLATE_PROMPT =
  "Translate the text of each block from {SOURCE} to {TARGET}. The input is a JSON array of blocks. Return the SAME JSON array with the same ids, same order, same count and same types; change only the text. Do not change numbers, dates, reference codes, phones or emails. Transliterate personal names into the target script. For blocks of type stamp, signature, logo or handwriting, output exactly '[Stamp present in original]', '[Signature present in original]', '[Logo present in original]' or '[Handwriting present in original]'. Keep '[unclear]' as '[unclear]'. Keep ' | ' separators in table rows. Never add, summarize or omit content. Return only JSON.";

const LANG_NAME: Record<Lang, string> = { om: 'Afaan Oromo', am: 'Amharic', en: 'English' };
const BLOCK_TYPES = ['heading', 'paragraph', 'table_row', 'list_item', 'stamp', 'signature', 'logo', 'handwriting'];
const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};
const SAMPLES_DIR = 'test-samples';
const OUT_DIR = path.join(SAMPLES_DIR, 'out');
const PREVIEW_LINES = 15;
const REQUEST_TIMEOUT_MS = 120_000;

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function pickSample(): string {
  const arg = process.argv[2];
  if (arg) return arg;
  let names: string[];
  try {
    names = readdirSync(SAMPLES_DIR);
  } catch {
    fail(`No sample given and the ${SAMPLES_DIR}/ folder does not exist.`);
  }
  const first = names.sort().find((n) => MIME[path.extname(n).toLowerCase()]);
  if (!first) fail(`No pdf/jpg/png file found in ${SAMPLES_DIR}/.`);
  return path.join(SAMPLES_DIR, first);
}

function parseJson(text: string | undefined, label: string): unknown {
  if (!text) fail(`${label}: the model returned no text.`);
  try {
    return JSON.parse(text);
  } catch {
    console.error(text.slice(0, 2000));
    fail(`${label}: the model did not return valid JSON (raw output above).`);
  }
}

function isBlockArray(value: unknown): value is Block[] {
  return (
    Array.isArray(value) &&
    value.every(
      (b) => b && typeof b.id === 'string' && typeof b.type === 'string' && typeof b.text === 'string',
    )
  );
}

function checkExtract(result: ExtractResult): string[] {
  const problems: string[] = [];
  if (!['om', 'am', 'en', 'other'].includes(result.detectedLanguage)) {
    problems.push(`detectedLanguage is "${result.detectedLanguage}"`);
  }
  if (!['academic', 'id_certificate', 'legal', 'other'].includes(result.documentType)) {
    problems.push(`documentType is "${result.documentType}"`);
  }
  result.blocks.forEach((b, i) => {
    if (b.id !== `block-${i + 1}`) problems.push(`block ${i + 1} has id "${b.id}"`);
    if (!BLOCK_TYPES.includes(b.type)) problems.push(`${b.id} has type "${b.type}"`);
  });
  return problems;
}

function checkTranslation(input: Block[], output: Block[]): string[] {
  const problems: string[] = [];
  if (input.length !== output.length) {
    problems.push(`count changed: ${input.length} in, ${output.length} out`);
  }
  for (let i = 0; i < Math.min(input.length, output.length); i++) {
    if (input[i].id !== output[i].id) problems.push(`position ${i + 1}: id "${input[i].id}" became "${output[i].id}"`);
    if (input[i].type !== output[i].type) problems.push(`${input[i].id}: type "${input[i].type}" became "${output[i].type}"`);
  }
  return problems;
}

function preview(title: string, blocks: Block[]): void {
  console.log(`\n--- ${title} (first ${Math.min(PREVIEW_LINES, blocks.length)} of ${blocks.length} blocks) ---`);
  for (const b of blocks.slice(0, PREVIEW_LINES)) {
    console.log(`${b.id} [${b.type}] ${b.text.replace(/\s+/g, ' ')}`);
  }
}

function save(name: string, data: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, name);
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`(full output: ${file})`);
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey) fail('GEMINI_API_KEY is not set. Put it in a local, gitignored .env.');
  if (!model) fail('GEMINI_MODEL is not set. Put it in a local, gitignored .env.');

  const samplePath = pickSample();
  const mimeType = MIME[path.extname(samplePath).toLowerCase()];
  if (!mimeType) fail(`Unsupported sample type: ${samplePath} (use pdf, jpg or png).`);
  const bytes = readFileSync(samplePath);
  const stem = path.basename(samplePath, path.extname(samplePath));

  console.log(`model:  ${model}`);
  console.log(`sample: ${samplePath} (${mimeType}, ${(bytes.length / 1024).toFixed(0)} KB)`);

  // Without a timeout a 503 from an overloaded model can hang for minutes.
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
  const config = { temperature: 0, responseMimeType: 'application/json' };

  // ---- extract -----------------------------------------------------------
  let started = Date.now();
  const extractResponse = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType, data: bytes.toString('base64') } }, { text: EXTRACT_PROMPT }],
      },
    ],
    config,
  });
  const extractMs = Date.now() - started;
  const extracted = parseJson(extractResponse.text, 'extract') as ExtractResult;
  if (!extracted || !isBlockArray(extracted.blocks)) {
    console.error(JSON.stringify(extracted, null, 2).slice(0, 2000));
    fail('extract: JSON does not have a valid "blocks" array.');
  }
  console.log(
    `\nextract: ${extractMs} ms, detectedLanguage=${extracted.detectedLanguage}, documentType=${extracted.documentType}, ${extracted.blocks.length} blocks`,
  );
  const extractProblems = checkExtract(extracted);
  console.log(extractProblems.length ? `extract shape problems:\n  ${extractProblems.join('\n  ')}` : 'extract shape: ok');
  preview('EXTRACT', extracted.blocks);
  save(`${stem}.extract.json`, extracted);

  // ---- translate ---------------------------------------------------------
  // om -> am, then am -> en. An Oromo sample runs both (the Amharic output of
  // the first feeds the second); an Amharic sample runs only am -> en.
  const detected = extracted.detectedLanguage;
  const steps: Array<[Lang, Lang]> =
    detected === 'om' ? [['om', 'am'], ['am', 'en']] : detected === 'am' ? [['am', 'en']] : [];
  if (steps.length === 0) {
    console.log(`\nNo translate step run: detected language "${detected}" is neither om nor am.`);
    return;
  }

  let current = extracted.blocks;
  for (const [from, to] of steps) {
    const prompt = TRANSLATE_PROMPT.replace('{SOURCE}', LANG_NAME[from]).replace('{TARGET}', LANG_NAME[to]);
    started = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }, { text: JSON.stringify(current) }] }],
      config,
    });
    const ms = Date.now() - started;
    const translated = parseJson(response.text, `translate ${from}->${to}`);
    if (!isBlockArray(translated)) {
      console.error(JSON.stringify(translated, null, 2).slice(0, 2000));
      fail(`translate ${from}->${to}: the model did not return a JSON array of blocks.`);
    }
    const problems = checkTranslation(current, translated);
    console.log(`\ntranslate ${from}->${to}: ${ms} ms`);
    console.log(problems.length ? `structure problems:\n  ${problems.join('\n  ')}` : 'structure: same ids, order, count and types');
    preview(`TRANSLATE ${from} -> ${to}`, translated);
    save(`${stem}.translate.${from}-${to}.json`, translated);
    current = translated;
  }
}

main().catch((error: unknown) => {
  const e = error as { status?: number; message?: string };
  console.error(`ERROR${e.status ? ` (HTTP ${e.status})` : ''}: ${e.message ?? String(error)}`);
  process.exit(1);
});

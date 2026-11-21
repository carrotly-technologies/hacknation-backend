import { DISCLAIMER } from './assistant.types.js';
import type { ChatMessage } from './llm.client.js';

/**
 * Follow-up questions in one chat ("a do kogo się go składa?"): the earlier
 * exchanges sent by the client turn the last question into a standalone one
 * before retrieval, and are given to the language model as the conversation.
 * The history is only questions and answers of the chat; it is never stored
 * or logged.
 */

/** How many earlier exchanges are used; older ones are dropped. */
export const MAX_HISTORY = 3;
/** Each question and answer of the history is cut to this many characters. */
export const HISTORY_FIELD_MAX = 2000;
/** The rewrite is a short call: past this the heuristic is used instead. */
export const REWRITE_TIMEOUT_MS = 15_000;
/** Of each earlier answer, only the start goes to the rewrite prompt. */
const REWRITE_ANSWER_MAX = 600;
const REWRITE_MAX = 500;
/** A question of at most this many words is read as a follow-up. */
const SHORT_WORDS = 3;

export interface ChatExchange {
  question: string;
  answer: string;
}

const STARTS_LIKE_FOLLOW_UP =
  /^(a|i|oraz|ale|to|no to|czy to|czy też|a czy|także|również)(\s|$)/u;
/** Pronouns and adverbs that point back to the earlier question. */
const POINTS_BACK = new Set([
  'go',
  'jego',
  'jej',
  'ją',
  'mu',
  'niego',
  'niej',
  'nią',
  'nim',
  'nich',
  'ich',
  'im',
  'on',
  'ona',
  'ono',
  'oni',
  'one',
  'ten',
  'ta',
  'tę',
  'te',
  'to',
  'tego',
  'temu',
  'tej',
  'tym',
  'tych',
  'taki',
  'taka',
  'takie',
  'takiego',
  'takiej',
  'tamten',
  'wtedy',
  'wówczas',
  'tam',
]);

const words = (question: string): string[] =>
  question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** "Co to jest IPRZ?", "Czym jest OSP?": short, but about a named thing. */
const DEFINITION =
  /^(co to (jest|są|znaczy|oznacza)|czym (jest|są)|co (oznacza|znaczy))( |$)/u;

/**
 * Whether the question needs the earlier ones to be understood: it is short,
 * starts like a continuation ("a…", "i…", "to…", "czy to…") or points back
 * with a pronoun ("go", "jej", "ten"…).
 */
export function looksLikeFollowUp(question: string): boolean {
  const w = words(question);
  if (w.length === 0) return false;
  const text = w.join(' ');
  const definition = DEFINITION.exec(text);
  // In a definition question "to" is not a pronoun.
  const rest = definition ? w.slice(definition[1].split(' ').length) : w;
  return (
    (w.length <= SHORT_WORDS && !definition) ||
    STARTS_LIKE_FOLLOW_UP.test(text) ||
    rest.some((x) => POINTS_BACK.has(x))
  );
}

/**
 * Standalone query without a language model: a follow-up gets the earlier
 * question glued in front (and the one before, while those are follow-ups
 * too). Anything else is returned unchanged.
 */
export function heuristicStandalone(
  question: string,
  history: ChatExchange[],
): string {
  if (history.length === 0 || !looksLikeFollowUp(question)) return question;
  const parts = [question];
  for (let i = history.length - 1; i >= 0; i--) {
    parts.unshift(history[i].question);
    if (!looksLikeFollowUp(history[i].question)) break;
  }
  return parts.join(' ');
}

/** Earlier answers carry citation numbers of their own sources, and the disclaimer. */
const cleanAnswer = (answer: string): string =>
  answer
    .replace(DISCLAIMER, '')
    .replace(/ *\[\d+\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

export const REWRITE_PROMPT = `Pomagasz wyszukiwarce w bazie wiedzy o ocenach w służbie cywilnej. Na podstawie wcześniejszej rozmowy przepisz OSTATNIE pytanie użytkownika tak, by było zrozumiałe bez tej rozmowy: zastąp zaimki i skróty tym, czego dotyczą (np. „a do kogo się go składa?” po pytaniu o sprzeciw od oceny okresowej → „Do kogo składa się sprzeciw od oceny okresowej?”).
Nie odpowiadaj na pytanie i nie dodawaj faktów. Jeśli pytanie jest już samodzielne, zwróć je bez zmian. Zwróć wyłącznie jedno pytanie po polsku, bez komentarza.`;

/** The rewrite call: earlier questions, the start of earlier answers, the last question. */
export function rewriteMessages(
  question: string,
  history: ChatExchange[],
): ChatMessage[] {
  const conversation = history
    .map(
      (h) =>
        `Użytkownik: ${h.question}\nAsystent: ${cleanAnswer(h.answer).slice(0, REWRITE_ANSWER_MAX)}`,
    )
    .join('\n\n');
  return [
    { role: 'system', content: REWRITE_PROMPT },
    {
      role: 'user',
      content: `Wcześniejsza rozmowa:\n\n${conversation}\n\n---\n\nOstatnie pytanie: ${question}`,
    },
  ];
}

/** The rewritten question from the model's reply, or null when it is unusable. */
export function parseRewrite(reply: string): string | null {
  const line = reply
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return null;
  const text = line
    .replace(/^(przepisane |samodzielne )?pytanie\s*:\s*/i, '')
    .replace(/^["„“”'«»]+|["„“”'«»]+$/g, '')
    .trim();
  if (text.length < 3 || text.length > REWRITE_MAX) return null;
  if (/nie znalazłem tego w bazie wiedzy/i.test(text)) return null;
  return text;
}

export const HISTORY_NOTE = `Wcześniejsze wiadomości tej rozmowy służą wyłącznie do zrozumienia, o co pyta użytkownik (np. do czego odnosi się zaimek). Fakty, terminy i numery [n] bierz tylko z fragmentów źródeł w ostatniej wiadomości; wcześniejsze odpowiedzi nie są źródłem.`;

/**
 * The answer prompt with the earlier exchanges as the conversation, between
 * the system prompt and the last message (sources and the question).
 */
export function withHistory(
  messages: ChatMessage[],
  history: ChatExchange[],
): ChatMessage[] {
  if (history.length === 0) return messages;
  const [system, ...rest] = messages;
  return [
    { ...system, content: `${system.content}\n\n${HISTORY_NOTE}` },
    ...history.flatMap((h): ChatMessage[] => [
      { role: 'user', content: h.question },
      { role: 'assistant', content: cleanAnswer(h.answer) },
    ]),
    ...rest,
  ];
}

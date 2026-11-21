/**
 * Polish-friendly normalization for lexical retrieval: lowercase, strip
 * diacritics, drop stopwords and cut common inflection endings, so "ocena",
 * "oceny", "oceną" and "ocenie" all match the same term.
 */

const DIACRITICS: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

export function foldDiacritics(text: string): string {
  return text.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c]);
}

const STOPWORDS = new Set([
  ...'a aby albo ale az bo by byc byl byla bylo byly bedzie beda ci co czy dla do gdy gdzie go i ich ile im ja jak jaka jaki jakie jakiej jako je jego jej jest jesli jezeli juz ktora ktore ktory ktorych ktorym kto lub ma maja mi mnie moze na nad nie niz nim o od oraz po pod przez przy sa sie sobie ta tak takze te tego tej ten to tu tym tylko u w we wiec wszystko z za ze zas czym jakim kiedy mam mozna nalezy trzeba powinien musi'.split(
    ' ',
  ),
  // "z uwzględnieniem" ("taking into account") is a fixed phrase of legal
  // texts, not a topic; the noun ("uwzględnienie sprzeciwu") stays indexed.
  'uwzglednieniem',
]);

/** Longest first; stripped only when a stem of at least 4 letters remains. */
const SUFFIXES = [
  'owanie',
  'owania',
  'owaniu',
  'owego',
  'owemu',
  'owych',
  'owymi',
  'owej',
  'owym',
  'iego',
  'iemu',
  'ania',
  'aniu',
  'anie',
  'enia',
  'eniu',
  'enie',
  'iem',
  'ami',
  'ach',
  'ych',
  'ich',
  'ego',
  'emu',
  'ymi',
  'imi',
  'iej',
  'owa',
  'owe',
  'owy',
  'owi',
  'ow',
  'om',
  'ej',
  'em',
  'ie',
  'ia',
  'iu',
  'ym',
  'im',
  'a',
  'e',
  'i',
  'o',
  'u',
  'y',
];

const MAX_STEM = 7;

export function stem(word: string): string {
  if (/^\d/.test(word)) return word;
  // Superlatives share the stem: "najpóźniej" ~ "później", "najwyższe" ~ "wyższe".
  let w = word.length > 6 && word.startsWith('naj') ? word.slice(3) : word;
  for (const suffix of SUFFIXES) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w.slice(0, MAX_STEM);
}

/** Text to index terms (stemmed, stopwords dropped). */
export function tokenize(text: string): string[] {
  const words = foldDiacritics(text).match(/[a-z]+|\d+[a-z]?/g) ?? [];
  return words.filter((w) => w.length > 1 && !STOPWORDS.has(w)).map(stem);
}

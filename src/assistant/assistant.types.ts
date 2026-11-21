export type AssistantMode = 'LLM' | 'EXTRACTIVE';

export interface AnswerSource {
  n: number;
  title: string;
  ref: string;
  quote: string;
  /**
   * Link to the original document: "/api/docs/<file>" (relative to the API
   * origin, "#page=N" for a PDF excerpt), an official page, or null when the
   * document has no file.
   */
  url: string | null;
}

export interface AskResponse {
  answer: string;
  grounded: boolean;
  mode: AssistantMode;
  sources: AnswerSource[];
  disclaimer: string;
}

export const DISCLAIMER =
  'Asystent AI pełni wyłącznie funkcję doradczą. Odpowiada na podstawie bazy wiedzy (ustawa o służbie cywilnej, rozporządzenia o ocenach, poradniki KPRM, model kompetencji, zestaw Q&A) i nie podejmuje decyzji o ocenie ani poziomie pracownika. Ostateczna decyzja należy do oceniającego. Zweryfikuj odpowiedź w podanych źródłach.';

export const NOT_FOUND =
  'Nie znalazłem tego w bazie wiedzy. Udostępnione źródła (ustawa o służbie cywilnej, rozporządzenia o pierwszej i okresowej ocenie, poradniki KPRM, model kompetencji, zestaw Q&A) nie zawierają informacji wystarczających do odpowiedzi na to pytanie. Zwróć się do komórki kadr lub dyrektora generalnego urzędu.';

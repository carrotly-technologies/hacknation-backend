import { Injectable } from '@nestjs/common';
import type { CaseDetail, StageId } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import {
  asksForRatingDecision,
  buildMessages,
  RATING_REFUSAL,
  extractiveAnswer,
  retrieve,
  type Retrieval,
  sanitizeCitations,
  saysNotFound,
  toSources,
} from './answer.rules.js';
import type { AskInput } from './assistant.schemas.js';
import { type AskResponse, DISCLAIMER, NOT_FOUND } from './assistant.types.js';
import {
  CONVERSATION_ADDENDUM,
  caseContext,
  conversationTemplate,
  STAGE_RULE_QUERY,
  STAGE_SUGGESTIONS,
} from './conversation.rules.js';
import {
  type ChatExchange,
  heuristicStandalone,
  parseRewrite,
  REWRITE_TIMEOUT_MS,
  rewriteMessages,
  withHistory,
} from './followup.rules.js';
import { KnowledgeBase } from './knowledge-base.js';
import type { KnowledgeDocId } from './knowledge.types.js';
import { LlmClient } from './llm.client.js';

@Injectable()
export class AssistantService {
  private readonly kb = new KnowledgeBase();

  constructor(
    private readonly llm: LlmClient,
    private readonly cases: CasesService,
  ) {}

  suggestions(stageId?: StageId): string[] {
    return STAGE_SUGGESTIONS[stageId ?? 'GENERAL'];
  }

  async ask(input: AskInput): Promise<AskResponse> {
    // Scoped: only a case the caller may open (403 otherwise).
    const detail = input.caseId ? await this.cases.view(input.caseId) : null;
    const history = input.history ?? [];
    // Without history the query is the question itself, as before.
    const query = await this.standalone(input.question, history);
    if (input.assistant === 'CONVERSATION' && detail) {
      return this.conversation(input, detail, history, query);
    }
    return this.formal(input.question, history, query);
  }

  /**
   * A follow-up ("a do kogo się go składa?") as a standalone question for
   * retrieval: rewritten by the language model, or by the heuristic when the
   * model is not configured, fails or times out.
   */
  private async standalone(
    question: string,
    history: ChatExchange[],
  ): Promise<string> {
    if (history.length === 0) return question;
    const reply = await this.llm.chat(rewriteMessages(question, history), {
      timeoutMs: REWRITE_TIMEOUT_MS,
    });
    return (
      (reply ? parseRewrite(reply) : null) ??
      heuristicStandalone(question, history)
    );
  }

  private async formal(
    question: string,
    history: ChatExchange[],
    query: string,
  ): Promise<AskResponse> {
    const ratingRequest = asksForRatingDecision(question);
    // A "which rating should I give" question is answered with the rules.
    const retrieval = retrieve(
      this.kb,
      ratingRequest
        ? `${query} skala ocen cząstkowych poziom spełniania kryteriów`
        : query,
    );
    const sources = toSources(retrieval.hits, query);
    if (!retrieval.grounded) {
      return {
        answer: NOT_FOUND,
        grounded: false,
        mode: 'EXTRACTIVE',
        sources: [],
        disclaimer: DISCLAIMER,
      };
    }
    const reply = await this.llm.chat(
      withHistory(buildMessages(question, retrieval.hits), history),
    );
    if (reply) {
      const notFound = saysNotFound(reply);
      return {
        answer:
          (ratingRequest ? `${RATING_REFUSAL}\n\n` : '') +
          (notFound ? NOT_FOUND : sanitizeCitations(reply, sources.length)),
        grounded: !notFound,
        mode: 'LLM',
        sources: notFound ? [] : sources,
        disclaimer: DISCLAIMER,
      };
    }
    return {
      answer: extractiveAnswer(question, retrieval, sources),
      grounded: true,
      mode: 'EXTRACTIVE',
      sources,
      disclaimer: DISCLAIMER,
    };
  }

  private async conversation(
    input: AskInput,
    detail: CaseDetail,
    history: ChatExchange[],
    query: string,
  ): Promise<AskResponse> {
    const stage = input.stageId ?? detail.currentStage;
    // Only the rules of the case's path: periodic (RO, PO) or first (RP, PP).
    const otherPath: KnowledgeDocId[] =
      detail.path === 'FIRST' ? ['RO', 'PO'] : ['RP', 'PP'];
    let retrieval: Retrieval = retrieve(this.kb, query, otherPath);
    if (!retrieval.grounded) {
      retrieval = retrieve(this.kb, STAGE_RULE_QUERY[stage], otherPath);
    }
    const sources = toSources(retrieval.hits, query);
    const messages = buildMessages(
      input.question,
      retrieval.hits,
      caseContext(detail, stage),
    );
    messages[0].content += `\n\n${CONVERSATION_ADDENDUM}`;
    const reply = await this.llm.chat(withHistory(messages, history));
    if (reply) {
      return {
        answer: sanitizeCitations(reply, sources.length),
        grounded: retrieval.grounded,
        mode: 'LLM',
        sources,
        disclaimer: DISCLAIMER,
      };
    }
    const rules = sources
      .slice(0, 3)
      .map((s) => `[${s.n}] ${s.ref}: „${s.quote}”`);
    return {
      answer: [
        conversationTemplate(detail, stage),
        ...(rules.length ? ['', 'Zasady z bazy wiedzy:', ...rules] : []),
      ].join('\n'),
      grounded: retrieval.grounded,
      mode: 'EXTRACTIVE',
      sources,
      disclaimer: DISCLAIMER,
    };
  }
}

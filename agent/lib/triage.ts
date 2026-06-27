/**
 * Triage primitives: classify (cheap model), resolve (cheap model), and
 * diagnose (Claude). Each one calls the AI Gateway when LIVE, and falls back to
 * the ticket's canned DEMO data on missing keys or any error — so the flow runs
 * end-to-end no matter what.
 */
import { generateObject, generateText, gateway } from "ai";
import { z } from "zod";
import { CHEAP_MODEL, CLAUDE_MODEL, isLive } from "./models";
import { estimateTokens } from "./cost";
import type { Category } from "./kb";
import type { Difficulty, Priority, Ticket } from "./tickets";

export interface Classification {
  category: Category;
  priority: Priority;
  difficulty: Difficulty;
  model: string;
  inputTokens: number;
  outputTokens: number;
  source: "live" | "demo";
}

export interface Resolution {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  source: "live" | "demo";
}

const classifySchema = z.object({
  category: z.enum(["network", "account", "hardware", "software"]),
  priority: z.enum(["P1", "P2", "P3", "P4"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export async function classify(ticket: Ticket): Promise<Classification> {
  const text = `Subject: ${ticket.subject}\n${ticket.body}`;
  const demo = (): Classification => ({
    category: ticket.demo.category,
    priority: ticket.demo.priority,
    difficulty: ticket.demo.difficulty,
    model: CHEAP_MODEL,
    inputTokens: estimateTokens(text),
    outputTokens: 16,
    source: "demo",
  });

  if (!isLive()) return demo();
  try {
    const res = await generateObject({
      model: gateway(CHEAP_MODEL),
      schema: classifySchema,
      prompt:
        "You are an IT helpdesk triage classifier. Classify the ticket below.\n" +
        "category: network | account | hardware | software\n" +
        "priority: P1 (company-wide/critical outage) | P2 (major, single user blocked) | P3 (normal) | P4 (trivial)\n" +
        "difficulty: easy (common/known) | medium | hard (novel, needs deep diagnosis)\n\n" +
        text,
    });
    return {
      category: res.object.category,
      priority: res.object.priority,
      difficulty: res.object.difficulty,
      model: CHEAP_MODEL,
      inputTokens: res.usage?.inputTokens ?? estimateTokens(text),
      outputTokens: res.usage?.outputTokens ?? 16,
      source: "live",
    };
  } catch {
    return demo();
  }
}

async function resolveWith(
  model: string,
  ticket: Ticket,
  cls: Classification,
  persona: string,
): Promise<Resolution> {
  const text = `Subject: ${ticket.subject}\n${ticket.body}`;
  const demo = (): Resolution => ({
    text: ticket.demo.resolution,
    model,
    inputTokens: estimateTokens(text),
    outputTokens: estimateTokens(ticket.demo.resolution),
    source: "demo",
  });

  if (!isLive()) return demo();
  try {
    const res = await generateText({
      model: gateway(model),
      prompt:
        `${persona}\n\n` +
        `Ticket (${cls.category}, ${cls.priority}):\n` +
        `Subject: ${ticket.subject}\n${ticket.body}\n\n` +
        "Write a concise, actionable resolution for the end user.",
    });
    return {
      text: res.text,
      model,
      inputTokens: res.usage?.inputTokens ?? estimateTokens(text),
      outputTokens: res.usage?.outputTokens ?? estimateTokens(res.text),
      source: "live",
    };
  } catch {
    return demo();
  }
}

/** Cheap/fast path for common, well-understood tickets. */
export function resolveCheap(ticket: Ticket, cls: Classification): Promise<Resolution> {
  return resolveWith(
    CHEAP_MODEL,
    ticket,
    cls,
    "You are a fast IT helpdesk assistant handling a common, well-understood ticket.",
  );
}

/** Claude diagnostic path for hard/novel tickets. */
export function diagnose(ticket: Ticket, cls: Classification): Promise<Resolution> {
  return resolveWith(
    CLAUDE_MODEL,
    ticket,
    cls,
    "You are a senior IT engineer diagnosing a hard, novel ticket. Reason carefully and give precise, correct diagnostic steps.",
  );
}

---
name: seo-strategy-copywriting
description: SEO strategy planning and search-intent copywriting for webpages, blogs, landing pages, category pages, and content briefs. Use when Codex needs to research keyword opportunities, map search intent, build topical clusters, create on-page SEO recommendations, draft or rewrite SEO copy, improve titles/meta descriptions/headings, or produce content briefs and optimization plans.
---

# Seo Strategy Copywriting

## Overview

Use this skill to produce practical SEO plans and conversion-aware copy that aligns with search intent.
Default to a workflow that starts with intent/keyword strategy, then moves into outlines and final copy.
Load project-specific references before drafting strategy or copy when the request is for a known brand/site context.

## Workflow Decision Tree

- If the user asks for a plan, roadmap, audit, keyword map, or topic cluster: run the strategy workflow first.
- If the user asks for a page rewrite, new landing page, blog post, metadata, headings, or product/category copy: run the copywriting workflow.
- If the user asks for "SEO content" broadly: produce both a brief strategy summary and draft copy.
- If key inputs are missing (audience, offer, geography, URL, target keywords): ask for the minimum missing inputs, then continue with explicit assumptions if the user prefers speed.

## Inputs To Collect

- Business/site name
- Page type or content type (homepage, service page, blog post, category page, etc.)
- Goal (traffic, leads, sales, signups, education)
- Target audience and geography
- Primary keyword or topic
- Secondary keywords/entities (if known)
- Brand voice constraints
- Offer/CTA details
- Existing URL or draft copy (for rewrites)

## Strategy Workflow

1. Clarify objective and page scope.
1. Identify likely search intent (`informational`, `commercial`, `transactional`, `navigational`) and note mixed-intent risks.
1. Build a keyword set:
   Use a primary keyword, supporting variants, and related entities/questions.
1. Define a SERP hypothesis:
   Note what searchers likely expect (comparison, how-to, service proof, pricing cues, local trust, etc.).
1. Create a content angle and differentiation:
   Specify what makes this page more useful than generic competitor pages.
1. Produce an outline or brief:
   Include recommended headings, evidence/proof elements, internal link opportunities, and CTA placement.
1. Provide on-page SEO recommendations:
   Title tag, meta description, H1, URL slug suggestion, schema candidates, image alt-text guidance.
1. State assumptions and validation gaps:
   Flag where live SERP/tool validation is still needed.

Use `references/strategy.md` for reusable templates and scoring checklists.

## Copywriting Workflow

1. Start from the strategy output (intent, audience, angle, primary keyword).
1. Draft structure before prose:
   H1, H2/H3 hierarchy, CTA blocks, proof blocks, FAQs, and internal link anchors.
1. Write for humans first:
   Make benefits concrete, reduce ambiguity, and keep claims supportable.
1. Integrate keywords naturally:
   Use exact matches sparingly and rely on variants/entities to avoid stuffing.
1. Optimize high-impact elements:
   Title tag, meta description, intro paragraph, subheads, CTA copy, image alt text.
1. Add trust and conversion elements where appropriate:
   Specific outcomes, process clarity, objections, guarantees, testimonials, pricing cues.
1. Self-edit for SEO and readability:
   Cut repetition, strengthen specificity, and align every section to intent.
1. Return copy plus a short rationale:
   Explain why the structure and phrasing match the target query.

Use `references/copywriting.md` for page templates, headline formulas, and editing checks.

## Output Formats

- For strategy requests, prefer:
  `SEO Strategy Summary`, `Keyword Map`, `Content Brief`, `On-Page Recommendations`, `Assumptions`.
- For copy requests, prefer:
  `Metadata`, `Outline`, `Draft Copy`, `FAQs`, `Optimization Notes`.
- For rewrites, include:
  `What changed` and `Why it should perform better`.

## Guardrails

- Do not promise rankings or traffic outcomes.
- Do not fabricate search volume, keyword difficulty, or competitor data. Label estimates clearly when no tooling is available.
- Avoid keyword stuffing and repetitive exact-match headings.
- Preserve brand/legal constraints if the user provides them.
- Prefer explicit assumptions over silent guessing.
- Follow domain-specific compliance constraints for sensitive categories (health, safety, finance, legal), and avoid unsupported guarantees or regulated claims.

## References

- `references/strategy.md`: Content brief template, keyword mapping template, intent checks, prioritization heuristics.
- `references/copywriting.md`: SEO copy templates, headline/CTA formulas, rewrite checklist, quality review checklist.

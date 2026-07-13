# Landing Page — Pre-Publish Checklist (10/10 + legal)

Run this **before shipping any change** to a public marketing page (`SageMarketingPage`,
`ForFirmsPage`, `BrandPreviewPage`, `/demo` copy, pilot forms). Two failure modes, two
mindsets: **quality drifts slowly; legal fails on one word.** Treat the legal half as a hard
gate — a single unsafe verb is a stop-ship, not a nit.

Pairs with `COPY_STYLE_GUIDE.md` (the verb test) and the automated copy-lint test.

---

## A. Legal gate (hard stop — any ✗ blocks publish)

- [ ] **Verb test passes.** Every sentence attributed to one3seven uses a SAFE verb (organize,
      reflect, surface, link, structure, preserve, extract, flag). No conclude/advise/recommend/
      rank/route/match/score/value/predict/win/guarantee/maximize.
- [ ] **No outcome or money promise.** No "win", "recover", "maximize", "$", "faster settlement",
      "better outcome", "fewer denials". Velocity = workflow only ("decide in minutes"), never results.
- [ ] **No legal conclusion.** No "you have a case", case scoring, claim valuation, "strong/weak
      evidence", "damages". Use "information that may help" / "items requiring confirmation".
- [ ] **Referral line intact.** Page never implies one3seven routes/matches/recommends/ranks/selects
      attorneys. The "not a lawyer referral service" disclaimer is present in the footer.
- [ ] **Anthropic claim is factual only.** "Built on / Powered by Anthropic's Claude" — never
      partner/certified/endorsed, no logo lockup. Kept off the hero.
- [ ] **No gov-endorsement vibe.** No "California-approved", "adopted statewide", etc.
- [ ] **No unverifiable security/audit claim.** No "independently verified / audited / SOC 2 / pen
      tested" unless a real report exists to point to. State the plain mechanism instead.
- [ ] **No fabricated metrics or fake scarcity.** Only defensible numbers ("0 legal conclusions",
      "100% source documents preserved"). Cohort size = a number you can actually onboard, or none.
- [ ] **Founder / testimonial copy stays causation-clean.** The mold-settlement origin story reads
      "I organized my records, gave them to my attorneys, and it settled at the maximum at the
      insurance level" — NEVER "one3seven got me the settlement". n=1 lived anecdote, results vary.
- [ ] **Attorney sign-off on file** for the current copy of: the founder/testimonial line, the
      referral-service language, and any new claim. (One-time per material change.)

## B. 10/10 quality gate

- [ ] **10-second test.** A cold visitor knows what it is, who it's for, and the next action within
      10 seconds. Product promise (what) reads before the belief line (why).
- [ ] **Every claim has proof beside it.** A principle without evidence is a slogan — before→after,
      the source-linked sample, real mechanism.
- [ ] **Belief architecture intact.** eyebrow → product headline → belief line → explanation → CTA.
      Don't let the belief line become the headline.
- [ ] **Public face stays narrow.** CA employment is the offer. The broad "we organize any record"
      thesis appears as at most one restrained line — never a second product on the page.
- [ ] **Type & spacing on system.** Fraunces (display) / Inter Tight (body) / IBM Plex Mono (dates);
      sage palette only (violet `#5B21B6` reserved for AI-only cues). No orphaned margins.
- [ ] **Responsive.** No horizontal body scroll at 375px; wide content scrolls in its own container.
- [ ] **Accessible.** Visible focus states; color contrast holds; `prefers-reduced-motion` respected;
      images have alt text.
- [ ] **Performance.** No layout shift on load; animations don't block interaction; images sized.
- [ ] **Analytics still fire.** `track()` calls use `.then()` (not `void`), so events actually record.

## C. Before you hit deploy
- [ ] `npm run typecheck` and the copy-lint test pass.
- [ ] Viewed on a real phone, not just desktop.
- [ ] Re-read the single most confident sentence on the page and ask: *is that a claim I can defend
      in front of the State Bar?* If you hesitate, weaken the verb.

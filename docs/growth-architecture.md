# one3seven — Growth Discovery Architecture

A data model, tracking architecture, and automated-discovery framework for identifying
growth leverage points, psychological friction, and operational bottlenecks — **tailored to
one3seven's actual stack (Supabase/Postgres), two-sided model, and current stage.**

> **Read this first — two calibrations that change everything:**
>
> **1. The Rule 1.6 privacy wall (non-negotiable).** one3seven holds worker intake *content*
> (`intakes`, `uploaded_files`, `intake_summaries`, `timeline_events`) that is legally
> confidential (CRPC 1.6). It **must never** enter a growth/analytics warehouse, be joined to
> marketing data, or be used for behavioral profiling. The growth stack operates on exactly
> three safe surfaces: (a) **anonymous funnel events** (`web_events`, already founder-RLS'd),
> (b) **firm/CRM + billing data** (`crm_*`, `firm_profiles`, `subscriptions`, `pilot_interest`),
> and (c) **aggregate, non-identifying intake COUNTS** (how many intakes reached a stage — never
> whose, never what's in them). Every schema and query below respects this wall.
>
> **2. Your stage: pre-revenue, two-sided, <5 firms.** Most of the classic growth-analytics
> machinery (cohort payback curves, MQL-rejection dashboards, price-anchor A/B tests) needs
> volume you don't have yet. The right move now is to **instrument cheaply and correctly** so the
> analysis *activates* when volume arrives — not to build a 200-table warehouse for 4 firms. Each
> section below is tagged **[INSTRUMENT NOW]** (build the capture) vs **[ANALYZE LATER]** (the
> query matters at scale). At your stage the single bottleneck is almost certainly **supply
> liquidity** (enough organized worker intakes that a firm sees value on day one) — instrument
> that above all.

---

## 0. Architecture overview

```
                    ┌─────────────────────────────────────────────┐
   PRODUCT/APP  ──> │  event capture (client + edge)              │
   (worker+firm)    │  → web_events (anon) + growth_events (new)  │
                    └───────────────┬─────────────────────────────┘
                                    │  (nightly / on-write)
                    ┌───────────────▼─────────────────────────────┐
   CRM / BILLING ─> │  analytics schema  (materialized views)     │
   (crm_*, subs)    │  fct_funnel · fct_firm_cohort · dim_account │
                    └───────────────┬─────────────────────────────┘
                                    │
   EXTERNAL      ──> │  ext schema (competitor reviews, macro/    │
   (reviews, macro)  │  search-volume triggers) — separate DB     │
                    └───────────────┬─────────────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────────────┐
                    │  discovery layer: bottleneck calc, North-    │
                    │  Star model, friction flags, hygiene audit   │
                    │  → /hq founder dashboard (RPC, founder-only) │
                    └─────────────────────────────────────────────┘
```

- **Keep it in Postgres.** You already have Supabase + a founder-gated `/hq`. Add an `analytics`
  schema of materialized views + a few SECURITY-DEFINER RPCs; don't stand up a separate warehouse
  until you outgrow Postgres (you won't for a long time).
- **One new capture table** (`analytics.growth_events`) for typed product events beyond raw
  pageviews; everything else is *views over data you already have*.

---

## 1. The growth formula & bottleneck analysis

### 1a. Isolating the primary bottleneck  **[INSTRUMENT NOW → ANALYZE LATER]**

Your growth identity is two-sided; model it as two funnels whose **product** is the business:

```
WORKER SUPPLY:   landing_view → intake_started → intake_completed → routed_to_firm
FIRM DEMAND:     pilot_interest → demo → trial(checkout) → paid → retained(month-2)
VALUE MOMENT:    routed_to_firm  ×  firm_actioned_intake   (both sides fire = liquidity)
```

The bottleneck is the funnel step with the **lowest stage-to-stage conversion × highest volume
upstream** (biggest absolute leak). Compute each step's conversion, then rank leaks by *recoverable
volume*, not just rate.

```sql
-- analytics.fct_funnel — one row per (side, step) with conversion + absolute leak.
-- Sources: web_events (anon funnel), firm_intake_routes (routed), crm_activity (demo),
-- subscriptions (paid). NO worker content is read — only counts and anon events.
create materialized view analytics.fct_funnel as
with steps as (
  select 'worker' as side, 1 as ord, 'landing_view'    as step,
         (select count(*) from web_events where event='pageview' and path in ('/','/for-workers')) as n
  union all select 'worker',2,'intake_started',   (select count(*) from web_events where event='intake_started')
  union all select 'worker',3,'intake_completed', (select count(distinct intake_id) from intake_summaries)          -- COUNT only
  union all select 'worker',4,'routed_to_firm',   (select count(distinct intake_id) from firm_intake_routes)
  union all select 'firm',  1,'pilot_interest',   (select count(*) from pilot_interest)
  union all select 'firm',  2,'demo',             (select count(distinct firm_id) from crm_activity where activity_type='demo')
  union all select 'firm',  3,'trial',            (select count(*) from subscriptions where status in ('trialing','active','past_due','canceled'))
  union all select 'firm',  4,'paid',             (select count(*) from subscriptions where status in ('active','past_due'))
)
select side, ord, step, n,
       lag(n) over (partition by side order by ord)                              as prev_n,
       round(n::numeric / nullif(lag(n) over (partition by side order by ord),0), 4) as conv_from_prev,
       (lag(n) over (partition by side order by ord) - n)                        as absolute_leak
from steps order by side, ord;

-- The bottleneck = the step with the largest recoverable volume.
select side, step, conv_from_prev, absolute_leak
from analytics.fct_funnel
where absolute_leak is not null
order by absolute_leak desc
limit 1;
```

**Interpretation rubric** (which lever the bottleneck implies):
- Leak at `landing_view → intake_started` → **Traffic/message-market fit** (top-of-funnel).
- Leak at `intake_started → intake_completed` → **Conversion/activation friction** (see §3a).
- Leak at `trial → paid` → **Pricing/value** (see §3c).
- Low `paid → retained` (add a month-2 step once you have cohorts) → **Retention**.

### 1b. Cash-flow velocity: payback period by acquisition cohort  **[ANALYZE LATER]**

Payback = months until a firm cohort's cumulative gross margin ≥ its blended CAC. You don't have
CAC attribution yet (§4), so start by tracking **cohorted MRR ramp**; layer CAC in when you spend.

```sql
-- Firm cohorts by first-paid month; cumulative recognized revenue vs a CAC parameter.
create view analytics.fct_firm_cohort as
with firm_month as (
  select fp.id as firm_id,
         date_trunc('month', min(s.created_at)) as cohort_month,
         date_trunc('month', s.created_at)      as active_month,
         case s.plan_id when 'firm' then 549 when 'practice' then 249
              when 'surge' then 124  -- 1490 annual / 12 for monthly velocity
              else 0 end as mrr
  from subscriptions s join firm_profiles fp on fp.id = s.firm_profile_id
  where s.status in ('active','past_due')
  group by fp.id, date_trunc('month', s.created_at), s.plan_id
)
select cohort_month,
       (extract(year from active_month)*12 + extract(month from active_month))
       - (extract(year from cohort_month)*12 + extract(month from cohort_month)) as month_index,
       count(distinct firm_id) as firms,
       sum(mrr)               as cohort_mrr,
       sum(sum(mrr)) over (partition by cohort_month order by active_month) as cumulative_rev
from firm_month group by cohort_month, active_month;

-- Payback month = first month_index where cumulative_rev per firm >= :cac_per_firm.
```

### 1c. North-Star metric discovery  **[INSTRUMENT NOW, MODEL LATER]**

Don't run logistic regression on 4 firms — you'll overfit noise. **Now:** instrument candidate
signals so the model has fuel later. **Candidates** (pick the one that both sides feel):
`intakes_routed_and_actioned_per_firm_per_week` (two-sided liquidity),
`coverage_rate_delivered` (your owned metric — see brand memory), `worker_records_reused`
(portability = worker value).

**Later (≥ ~200 activated accounts):** the right first tool is **not** logistic regression but a
**correlation-to-retention scan** — for each candidate signal, bucket accounts by signal value in
week 1 and measure month-3 retention; the signal with the steepest monotonic lift is your North
Star. Only then fit a regularized logistic/GBM to *confirm* and to weight sub-signals. Behavioral
clustering (k-means/HDBSCAN on the event matrix) is for *segment discovery*, not North-Star
selection — use it to find "the firms who action fast" as a cohort, then ask what they did in week 1.

```python
# North-Star correlation scan (pandas) — run when you have enough activated accounts.
# Input: df with one row per account, week-1 signal columns + a `retained_m3` bool.
import pandas as pd
def northstar_scan(df, signals, outcome="retained_m3", buckets=5):
    rows = []
    for s in signals:
        d = df[[s, outcome]].dropna()
        d["bucket"] = pd.qcut(d[s].rank(method="first"), buckets, labels=False)
        lift = d.groupby("bucket")[outcome].mean()
        # steepest monotonic top-vs-bottom lift = strongest candidate
        rows.append({"signal": s, "top": lift.iloc[-1], "bottom": lift.iloc[0],
                     "lift": lift.iloc[-1] - lift.iloc[0],
                     "monotonic": lift.is_monotonic_increasing})
    return pd.DataFrame(rows).sort_values("lift", ascending=False)
```

---

## 2. Market dynamics & competitive data

### 2a. Competitor-review extraction → LLM sentiment  **[INSTRUMENT NOW, low volume]**

Scope to **legal-tech intake/CRM competitors** (Clio Grow, Filevine, Lawmatics, Eve, Atticus).
Respect each site's ToS/robots; prefer official APIs (G2, Capterra have partner APIs) over scraping,
and rate-limit. Store raw → structured → scored in a separate `ext` schema so external text never
touches production tables.

```sql
create schema if not exists ext;
create table ext.competitor_review (
  id            bigint generated always as identity primary key,
  competitor    text not null,
  source        text not null,              -- 'g2' | 'capterra' | 'trustpilot'
  source_review_id text,
  rating        numeric(2,1),
  title         text,
  body          text not null,
  reviewed_at   date,
  scraped_at    timestamptz not null default now(),
  -- LLM enrichment (filled by the analysis job):
  sentiment     numeric(3,2),               -- -1..1
  pain_themes   text[],                     -- ['pricing','onboarding','support',' diligence']
  is_switch_signal boolean,                 -- reviewer left / considering leaving
  unique (competitor, source, source_review_id)
);
```

```python
# Blueprint: extract → structure → enrich. (API-first; scraping only where ToS-permitted.)
import httpx
def fetch_reviews(competitor, api, since):        # 1) EXTRACT (paginated, rate-limited)
    ...  # prefer G2/Capterra partner API; return list[dict]
def to_rows(raw, competitor, source):             # 2) STRUCTURE → ext.competitor_review shape
    return [{"competitor": competitor, "source": source, "source_review_id": r["id"],
             "rating": r.get("rating"), "title": r.get("title"), "body": r["text"],
             "reviewed_at": r.get("date")} for r in raw]
CLASSIFY_PROMPT = (                                # 3) ENRICH via Claude (batch, temp 0)
  "Return JSON {sentiment:-1..1, pain_themes:[...], is_switch_signal:bool} for this review. "
  "pain_themes from a fixed taxonomy: pricing, onboarding, support, reliability, diligence, lock_in.")
# Aggregate: SELECT competitor, unnest(pain_themes) theme, count(*), avg(sentiment)
#            FROM ext.competitor_review GROUP BY 1,2 ORDER BY 3 DESC  → competitor weakness map.
```

The **weakness map** (theme × competitor × avg-sentiment × switch-signal count) is a direct sales
asset: the pain themes with low sentiment + high switch-signal are your wedge messaging.

### 2b. Macro/regulatory triggers × localized intent  **[INSTRUMENT NOW]**

Map external triggers (new CA labor law, a mass layoff, a wildfire displacement) to local intent
surges. Star schema: fact = observed intent (search volume / landing traffic by region+topic),
dimensions = trigger, geo, topic, time.

```sql
create table ext.macro_trigger (
  id bigint generated always as identity primary key,
  trigger_type text not null,        -- 'legislation' | 'layoff' | 'disaster' | 'enforcement'
  title text not null, region text,  -- CA county / metro
  effective_date date, topic text,   -- 'overtime' | 'wrongful_term' | 'wildfire_displacement'
  source_url text
);
create table ext.intent_observation (
  id bigint generated always as identity primary key,
  observed_on date not null, region text, topic text,
  channel text,                      -- 'search_console' | 'ga_landing' | 'gtrends'
  volume numeric not null
);
-- Correlate a trigger to a downstream intent surge (lead/lag window):
create view ext.trigger_intent_lift as
select t.id trigger_id, t.trigger_type, t.topic, t.region,
       avg(i.volume) filter (where i.observed_on between t.effective_date and t.effective_date+30) as post_30d,
       avg(i.volume) filter (where i.observed_on between t.effective_date-30 and t.effective_date)  as pre_30d
from ext.macro_trigger t
join ext.intent_observation i on i.region=t.region and i.topic=t.topic
group by 1,2,3,4;   -- post/pre ratio > 1 = trigger drove intent → time GTM to the trigger.
```

---

## 3. Buyer psychology & friction logging

### 3a. "Switch cost" / onboarding drop-off flags  **[INSTRUMENT NOW]**

Add a typed event table so you can measure step-level drop-off with dwell time (dwell spikes =
friction). This captures **anonymous funnel events only** — no worker content.

```sql
create table analytics.growth_events (
  id bigint generated always as identity primary key,
  anon_id uuid not null,             -- cookie/session id, NOT a worker identity
  actor_kind text not null,          -- 'worker' | 'firm'
  step text not null,                -- 'landing','signup','upload_first','intake_submit',...
  occurred_at timestamptz not null default now(),
  ms_since_prev int,                 -- dwell before this step
  meta jsonb                         -- {plan_viewed:'firm'} — never PII/case content
);
create index on analytics.growth_events (anon_id, occurred_at);

-- Drop-off + dwell per step: the step with high exit_rate AND high dwell is a switch-cost wall.
with seq as (
  select anon_id, step, occurred_at,
         lead(step) over (partition by anon_id order by occurred_at) as next_step,
         ms_since_prev
  from analytics.growth_events where actor_kind='worker')
select step,
       count(*) entries,
       round(avg((next_step is null)::int),3) as exit_rate,
       percentile_cont(0.5) within group (order by ms_since_prev) as median_dwell_ms
from seq group by step order by exit_rate desc, median_dwell_ms desc;
```

### 3b. Enterprise account role mapping (Gatekeeper / End-User / Decision-Maker)  **[INSTRUMENT NOW]**

Multi-contact firms need a role dimension on your CRM contacts. Add a role + an inferred-influence
score; infer the decision-maker from title + engagement, confirm manually.

```sql
alter table crm_firm_contacts        -- (or crm_firms if contacts are embedded)
  add column if not exists buyer_role text
    check (buyer_role in ('gatekeeper','end_user','decision_maker','champion','unknown')),
  add column if not exists influence_score numeric;   -- 0..1, inferred then confirmed

-- Heuristic inference (title + engagement); a human confirms decision_maker.
update crm_firm_contacts c set buyer_role = case
  when c.title ~* 'owner|managing partner|principal|founder|ceo'      then 'decision_maker'
  when c.title ~* 'paralegal|assistant|coordinator|reception'         then 'gatekeeper'
  when c.title ~* 'associate|attorney|counsel'                        then 'end_user'
  else coalesce(c.buyer_role,'unknown') end
where c.buyer_role is null or c.buyer_role='unknown';
-- Deal-health rule: an opp with demos but NO decision_maker contact engaged = stalled at gatekeeper.
```

### 3c. Price-anchoring A/B framework  **[ANALYZE LATER — needs checkout volume]**

Assign a stable variant per firm-account (not per session), log exposure + outcome, evaluate with a
proper test. **Value Anchor** ("replaces 20 hrs of intake review / mo") vs **Software Cost Anchor**
("less than one Clio add-on").

```sql
create table analytics.pricing_experiment (
  firm_profile_id uuid primary key references firm_profiles(id),
  variant text not null check (variant in ('value_anchor','cost_anchor','control')),
  assigned_at timestamptz default now(),
  exposed_at timestamptz, converted_at timestamptz, plan_at_convert text
);
-- Deterministic, sticky assignment (no flip-flop): hash the account id.
-- variant := (['value_anchor','cost_anchor','control'])[ 1 + ('x'||substr(md5(id::text),1,8))::bit(32)::int % 3 ]
```

```python
# Evaluate with a two-proportion test; DO NOT peek/stop early (inflates false positives).
from statsmodels.stats.proportion import proportions_ztest
def eval_variant(conv, n):                     # dict variant -> (conversions, exposures)
    base = "control"
    for v in conv:
        if v == base: continue
        stat, p = proportions_ztest([conv[v][0], conv[base][0]], [conv[v][1], conv[base][1]])
        yield v, conv[v][0]/conv[v][1], p       # report lift + p; require pre-set n & alpha
```

> Stage note: with <20 checkouts, an A/B test is underpowered — run **sequential qualitative**
> pricing calls instead (Lemkin "15-min intake review"), and switch to this framework once
> checkout volume supports it.

---

## 4. Operational friction & data hygiene

### 4a. Data-cleanliness audit (duplicates, fragmented journeys, broken attribution)  **[INSTRUMENT NOW]**

```python
# Read-only hygiene audit against Supabase Postgres. Reports; never mutates.
# Scope: CRM/marketing tables ONLY — never worker intake content (Rule 1.6).
import os, psycopg2, pandas as pd
CONN = os.environ["SUPABASE_DB_URL"]           # service-role connection, run server-side only

DUPES = """
  select lower(trim(contact_email)) email, count(*) n, array_agg(id) ids
  from crm_firms where contact_email is not null
  group by 1 having count(*) > 1 order by 2 desc;"""
FRAGMENTED = """                                 -- same firm, multiple unlinked CRM + auth identities
  select coalesce(lower(fp.contact_email), fp.firm_name) k, count(distinct fp.id) profiles
  from firm_profiles fp group by 1 having count(distinct fp.id) > 1;"""
BROKEN_ATTRIB = """                              -- paid firms with no acquisition source recorded
  select s.firm_profile_id from subscriptions s
  join firm_profiles fp on fp.id=s.firm_profile_id
  left join crm_firms c on lower(c.contact_email)=lower(fp.contact_email)
  where s.status in ('active','past_due') and (c.id is null or c.source is null);"""

def audit():
    with psycopg2.connect(CONN) as cx:
        report = {name: pd.read_sql(q, cx) for name, q in
                  {"duplicate_firms": DUPES, "fragmented_profiles": FRAGMENTED,
                   "broken_attribution": BROKEN_ATTRIB}.items()}
    for name, df in report.items():
        print(f"\n=== {name}: {len(df)} issue rows ===\n", df.head(20))
    return report
if __name__ == "__main__": audit()
```

Add a **contact-hygiene score** materialized view (email present+valid, source present, role set,
last-activity < 90d) and track it over time — hygiene debt compounds silently.

### 4b. Misalignment dashboard: MQLs sales rejects < 24h  **[INSTRUMENT NOW]**

```sql
-- Requires crm_firms to carry mql_at (marketing qualified) and a sales disposition + timestamp.
alter table crm_firms
  add column if not exists mql_at timestamptz,
  add column if not exists sales_disposition text,     -- 'accepted' | 'rejected' | 'pending'
  add column if not exists disposition_at timestamptz;

create view analytics.mql_misalignment as
select date_trunc('week', mql_at) wk,
       count(*)                                                              mqls,
       count(*) filter (where sales_disposition='rejected'
                          and disposition_at <= mql_at + interval '24 hours') fast_rejects,
       round( count(*) filter (where sales_disposition='rejected'
                          and disposition_at <= mql_at + interval '24 hours')::numeric
              / nullif(count(*),0), 3)                                        fast_reject_rate
from crm_firms where mql_at is not null group by 1 order by 1 desc;
-- Alert rule: fast_reject_rate > 0.30 in a week = marketing/sales definition drift → fix the MQL bar.
```

Surface all of §1–4 as **founder-only RPCs** on `/hq` (SECURITY DEFINER, gated by `is_founder()` —
now trustworthy after the profiles privilege-lock fix), mirroring your existing `crm_site_analytics`
pattern.

---

## Build order for YOUR stage (do this, in this order)

1. **`analytics.growth_events` + client capture** (§3a) — the one new capture you're missing; unlocks
   funnel + friction. Cheap, compounding.
2. **`analytics.fct_funnel`** (§1a) — tells you the real bottleneck today (likely worker supply).
3. **Hygiene audit script** (§4a) — one afternoon; keeps the CRM trustworthy before you scale spend.
4. **CRM role + MQL columns** (§3b, §4b) — schema now, dashboards when firm count > ~20.
5. **Competitor weakness map** (§2a) — low volume, high sales-messaging leverage right now.
6. **Everything cohort/regression/A-B (§1b, §1c, §3c)** — schema now, *analysis* when volume supports
   it. Don't fit models on 4 firms.

**Privacy invariant to enforce in code review:** no query, view, or job in `analytics.*` or `ext.*`
may reference `intakes`, `uploaded_files`, `intake_summaries`, or `timeline_events` except as an
aggregate `count(*)`. Add a CI grep that fails the build if it does.

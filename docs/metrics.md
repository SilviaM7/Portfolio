# Metric definitions

Every metric shown on the site, with its **unit, period, denominator, and assumptions**. Each project page shows the same definitions in its "Metric definitions" panel. That text lives in `src/projects/<id>/content.ts`, and the calculations are pure functions in `src/analysis/<id>.ts`, covered by unit tests. If a definition changes, update the code, its test, and this file together.

Rules that apply everywhere:

- **Rates are ratios of sums**, computed over the current selection, never averages of group percentages.
- **Blank values are excluded, never treated as 0.** Each metric names which rows it leaves out.
- **Period = the current selection.** Project filters (dates, departments, and so on) change the period and population of every KPI, chart, and table in the Analysis section. The exceptions are stated on screen: the Adoption reclaim scenario and the Workflow value scenario use the full dataset (see below).
- All prices and rates are **fictional assumptions**. Scenario results are **estimates, not realized savings**.

## AI Spend & Consumption

| Metric | Unit | Numerator ÷ denominator, assumptions |
|---|---|---|
| Request cost | USD per request | (uncached input × input rate + cached input × cached rate + output × output rate) ÷ 1,000,000, using the price in force on the request date. Uncached input = `input_tokens` − `cached_input_tokens`. |
| Priced spend | USD, selected months | Σ request cost. Unpriceable requests (no price yet, or impossible token counts) are excluded and counted, never priced at $0. |
| Success rate | ratio | Successful requests ÷ all requests. |
| Cost per completed task | USD per completed task | (spend of completed tasks + spend of abandoned tasks) ÷ completed tasks. This includes every failed attempt and retry. Tasks with any unpriced request are left out of both sides. The KPI note also shows the completed-task-only variant. |
| Failed-request spend share | ratio | Spend on failed requests ÷ priced spend. |
| Cache hit rate | ratio | Σ cached tokens ÷ Σ input tokens, over priced requests. |
| Median latency | ms | Median over successful requests with a recorded latency. |
| Budget variance | ratio | (actual − budget) ÷ budget, for the selected months and departments. Not available while a provider, model, or use-case filter is active, because budgets exist only by department and month. |
| USD per 1M tokens | USD per 1,000,000 tokens | Group spend ÷ (input + output tokens) × 1,000,000, a blended weighted rate. |
| Projection | USD per month, next 3 months | Illustrative, not a forecast. It takes the average of the last 3 months × (1 + g)^k, where g comes from a log-linear fit over the last 6 months. It assumes no change in prices, mix, or policy, and is shown only when the selection reaches the latest month. |
| Savings scenarios | USD, selected period | Three levers: routing low-risk use cases to a smaller model (minus a quality haircut), extra caching of long prompts, and removing a share of failed-request spend. The levers overlap, so their results must not be added together. The list of eligible use cases is an analyst assumption. |

## AI Adoption & License Utilization

Unit of analysis: a **seat**, which is one employee–product assignment. **Observation window:** the last N telemetry weeks (4, 8, or 12, selectable). The **as-of date** is the last day of the window, which is the end of the data, not today.

| Metric | Unit | Numerator ÷ denominator, assumptions |
|---|---|---|
| Eligible seats | seats | Σ `eligible_employees` for the selection. This is a policy count. |
| Seats held | seats | Seats assigned on the as-of date. |
| Coverage | ratio | Seats held ÷ eligible seats. It can exceed 100% when seats are held outside the policy. |
| Seat status | category | **Active**: ≥ 1 active day in a held window week; activity before the assignment date does not count. **Inactive**: held ≥ 28 days, has telemetry, and 0 active days in every held window week. **New**: held < 28 days with no activity yet. **Unknown**: no reported telemetry for any held window week. |
| Utilization | ratio | Active seats ÷ seats held. New and unknown seats stay in the denominator. |
| Inactive-seat cost | USD per month | Σ monthly list price of inactive seats. This is a cost being paid, not a saving available now. |
| Cost per active seat | USD per active seat per month | Monthly list cost of all seats held ÷ active seats. |
| Weekly active rate | ratio per week | Active seats ÷ held seats with reported telemetry that week. A week with no reported telemetry is a gap, not a zero. |
| Reclaim scenario | USD per year, from renewal | Reclaimed seats = inactive seats × reclaim share. Proposed commitment = (seats held − reclaimed) × (1 + headroom), kept between the contract floor and the current commitment. Annual savings = (current − proposed commitment) × seat price × 12, counted as *available* only if the notice deadline (renewal date − notice days) is on or after the as-of date; otherwise it is *deferred* to the next term. It assumes no mid-term reductions. It uses company-wide seats (product filter only), because contracts are company-wide. |

Activity measures usage, not value. An occasional user may depend on the tool, and a frequent user may get little from it.

## AI Workflow Value & Quality

| Metric | Unit | Numerator ÷ denominator, assumptions |
|---|---|---|
| Minutes per task | minutes per task | Σ (handling + review + rework) ÷ tasks with rework recorded. |
| Mix-adjusted time difference | minutes per task | AI-assisted minutes − baseline minutes, with the baseline reweighted to the AI-assisted complexity mix. It removes task-mix effects only. The comparison remains descriptive, not causal. |
| Pass rate | ratio | Passed ÷ audited tasks. |
| Escalation rate | ratio | Escalated ÷ all tasks. |
| Operating cost per task | USD per task | Minutes ÷ 60 × labor rate + AI usage cost (AI-assisted only) + escalation cost (escalated only). |
| Cost per successful task | USD per passed task | Operating cost of every timed and audited task (passed and failed) ÷ passed tasks. It is shown before program costs, and for AI-assisted work also with allocated program costs. |
| Program cost allocated | USD | (software per month × pilot months + implementation + training) × (AI-assisted tasks in view ÷ all AI-assisted tasks). |
| Capacity released | hours per month | AI-routed tasks × minutes saved per task ÷ 60. This is time, not cash. |
| Estimated value of time | USD per month | Σ over complexity levels of tasks × (baseline − AI-assisted labor and escalation cost per successful task), minus AI usage cost. Valued at the labor rate, this is an estimate, not realized savings. |
| Estimated net value | USD per month | Estimated value of time − software. |
| Cash view | USD per month | Cash-realization share × labor value − AI usage cost − software. With 0% realization, only costs appear. |
| Break-even volume | AI-routed tasks per month | Software per month ÷ estimated value per AI-routed task. Not reachable when AI-assisted work is not cheaper per successful task. |
| Payback | months | One-time costs ÷ monthly net amount (estimated or cash). Shown only when that monthly amount is positive. |
| Sensitivity | USD per month, months | One input changed at a time around the current settings. The rows are not additive. |

Scenario inputs are measured within each complexity level on the **full dataset** and combined using the AI-assisted complexity mix. Program costs cannot be divided across filter slices, so the on-screen filters do not change the scenario.

## Live data (separate from the projects)

| Value | Unit | Notes |
|---|---|---|
| Reference rate | units of currency per 1 USD | From Frankfurter: blended reference rates from central banks and official sources, each with its own date. Indicative mid-market figures, not executable prices. Never used in any project calculation. |

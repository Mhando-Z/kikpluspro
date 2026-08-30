# KickPulse model card

## Model identity

- Model key: `elo-poisson-global`
- Algorithm: `elo-poisson-temperature-v2`
- Implementation: JavaScript
- Output: home win, draw, away win, expected goals, over 2.5, both teams to score, and likely scorelines
- Intended use: football analysis, comparison and product experimentation
- Excluded use: guaranteed outcomes or automatic betting instructions

## Training data

The benchmark contains 7,082 completed top-flight matches from the Premier League, La Liga, Serie A, Bundesliga and Ligue 1.

| Partition | Seasons | Matches | Purpose |
| --- | --- | ---: | --- |
| Training | 2022/23–2023/24 | 3,578 | Elo, form and goal-state fitting |
| Calibration | 2024/25 | 1,752 | Temperature fitting only |
| Test | 2025/26 | 1,752 | Untouched walk-forward evaluation |

Every test prediction is generated before its match result updates model state.

## Held-out results

| Metric | Uncalibrated | Calibrated | Closing market |
| --- | ---: | ---: | ---: |
| Accuracy | 50.80% | 50.80% | Not calculated |
| Log loss | 1.0416 | 0.9977 | 0.9774 |
| Brier score | 0.2057 | 0.1985 | Not calculated |
| Goal MAE per team | 1.00 | 1.00 | Not applicable |

Temperature scaling improved test log loss by 0.0438, reducing the model-to-market log-loss gap from approximately 0.0642 to 0.0203. Accuracy is unchanged because temperature scaling preserves the outcome ranking while correcting confidence.

## Test performance by league

| League | Matches | Accuracy | Log loss | Market log loss | Gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bundesliga | 306 | 55.23% | 0.9623 | 0.9510 | +0.0113 |
| La Liga | 380 | 50.79% | 0.9883 | 0.9650 | +0.0234 |
| Serie A | 380 | 52.11% | 1.0028 | 0.9784 | +0.0243 |
| Ligue 1 | 306 | 49.35% | 1.0051 | 0.9755 | +0.0296 |
| Premier League | 380 | 47.11% | 1.0247 | 1.0118 | +0.0130 |

Closing-market probabilities remain the stronger benchmark in every league. The Premier League has the lowest outcome accuracy, while Ligue 1 has the largest calibrated log-loss gap and the highest goal error in this test window.

## Calibration

The global validation temperature is 1.70, indicating that the original outcome probabilities were too confident. League-specific temperatures use shrinkage toward the global temperature rather than fitting each competition independently:

| League | Temperature |
| --- | ---: |
| Premier League | 1.7965 |
| Bundesliga | 1.8651 |
| La Liga | 1.6276 |
| Serie A | 1.5914 |
| Ligue 1 | 1.6229 |

## Known limitations

- The model does not yet consume confirmed lineups, injuries, suspensions, weather, travel or manager changes.
- Promoted teams have less top-flight history and therefore wider uncertainty.
- Scoreline, over/under and both-teams-to-score outputs come from the goal model; temperature scaling currently calibrates only the 1X2 outcome probabilities.
- Closing odds are used only as an evaluation benchmark, never as a prediction feature.
- Historical performance can degrade when competition rules, team quality or scoring patterns change.

## Release rule

Keep the previous active model until a candidate completes chronological evaluation. Promote a new algorithm only when probability quality improves on later data without introducing leakage, and record the full split and metrics with the version.


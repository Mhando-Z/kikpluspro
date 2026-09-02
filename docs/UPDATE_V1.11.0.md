# Model isolation v1.11.0

This release protects Big Five performance by splitting domestic forecasting
into two independent model families:

| Model key | Competitions |
| --- | --- |
| `elo-poisson-global` | E0, SP1, I1, D1, F1 |
| `domestic-expansion` | E1, B1, SC0 |
| `uefa-champions-league` | CL |

No Supabase migration is required. `ai_model_versions.model_key` is already a
text field and the active-model uniqueness rule works independently per key.

## Upgrade sequence for the current database

The reviewed Big Five benchmark is version 4. If version 6 was activated during
the combined eight-league experiment, restore version 4:

```bash
npm run ai:model:activate -- --model-key=elo-poisson-global --version=4
```

Train the three-league family without activating it:

```bash
npm run ai:train:expansion:candidate -- --validation-season=2024 --test-season=2025
```

Review the returned test metrics, note the new expansion version, then activate
that exact reviewed version:

```bash
npm run ai:model:activate -- --model-key=domestic-expansion --version=1
npm run ai:fixtures:update
```

Replace `1` with the version printed by training when necessary. The activation
utility verifies that the artifact's stored competition scope exactly matches
the destination family.

## Runtime behavior

- Automatic fixture sync chooses a model from `league_code`.
- Manual simulation loads both active domestic families and switches models
  when the selected competition changes.
- Performance reporting maintains a separate card and live scorecard for each
  active model family.
- Weekly gated learning trains Big Five and expansion candidates independently.
- A missing expansion artifact causes only E1/B1/SC0 fixtures to be skipped.

Existing version 6 can remain stored as an inactive audit artifact. It does not
need to be deleted.

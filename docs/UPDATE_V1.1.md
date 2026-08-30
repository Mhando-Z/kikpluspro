# Upgrade to calibrated model v2

This release does not change npm dependencies or add database tables. It updates the JavaScript trainer, model artifact, prediction interface, tests and documentation.

## Apply the update

1. Stop the development server.
2. Extract the updated ZIP over the existing `kickpulse-football-ai-hub` folder and allow Windows to replace matching source files.
3. Keep the existing `.env.local` and `node_modules`; neither is included in the ZIP.
4. Run the verification command:

```bash
npm run check
```

5. Train and activate the calibrated model:

```bash
npm run ai:train
```

The 7,082 imported matches remain in Supabase, so they do not need to be downloaded again. The training command creates the next model version, preserves the older version, and atomically activates the new one.

6. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000/predictions`. The page will show the calibration temperature, calibrated-versus-uncalibrated test comparison, and league-level performance table.

## Expected benchmark

Using seasons 2022/23 through 2025/26, the test log loss should be close to:

```text
1.0416 uncalibrated -> 0.9977 calibrated
```

Small differences can occur if the public source corrects historical rows.


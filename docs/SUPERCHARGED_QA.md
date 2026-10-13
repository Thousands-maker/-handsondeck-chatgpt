# Supercharged: Android Chrome checks

Automated worker and DOM tests run with `node --test tests/*.test.mjs`. They simulate graphics loss and browser APIs; they do not establish physical-phone performance. Run these checks on the target phone before relying on offline AI.

1. Open the published HTTPS app online and refresh to obtain the latest version. Open Supercharged. The model selector must contain only **Qwen2.5 0.5B**, show **283.1 MiB**, and explain that the smaller model uses less graphics memory. The 1.5B option must be absent, even if an older version downloaded it. No model files should download until **Download & enable** is pressed.
2. Press **Download & enable**. Inspect Chrome’s remote-debugging Network panel if available: model weights must come from the pinned `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` revision. Allow checksum verification and the short inference self-check to complete. **Model ready** must appear.
3. Use the fictional example or a short brief and select four slides. Press **Suggest my outline**. The button must disable immediately. Progress beside it must begin at **slide 1 of 4**, update during generation, and offer **Cancel writing**. Normal completion must produce a reviewable outline without replacing the current deck.
4. Start another outline and press **Cancel writing**, including while a slide is still reading notes. Confirm progress stops, the notes and deck remain, and no late outline appears. Reloading the downloaded model must remain possible.

## Simulate failure and recovery

Use the page’s console through Android Chrome remote debugging. These are console-only QA commands, not an app feature or a network request. Start an outline, then dispatch a synthetic worker failure:

```js
aiState.worker.dispatchEvent(new MessageEvent('message', {
  data: { type: 'error', kind: 'gpu', detail: 'QA: simulated GPU device loss / mapAsync failure' }
}));
```

Confirm **Reloading the downloaded model once…** appears, with cancellation still available. There must be no new model network download. Let the new worker resume writing, then run the same command again. The app must show a friendly Standard-sorting message and **Review your Standard outline**, with no raw GPU or `mapAsync` error on screen. The old deck and source notes must remain unchanged until **Use this outline & edit**. Console diagnostics are expected.

Repeat with cancellation during the reload. A delayed ready/proposal message must not restart generation or apply a deck. Automated tests also exercise the actual runtime-device loss listener, a hung worker teardown, a failed reload and a successful retry.

## Offline and privacy regression

After successful setup, enable airplane mode, close and reopen the same HTTPS address in the same Chrome profile, and load the downloaded model. Repeat generation and the simulated-failure check. Verify that recovery uses the verified cache and Standard fallback still works. Use fictional notes and inspect network traffic to confirm no prompt or output is sent. Keep site data; do not clear storage between these steps.

On a desktop, verify that 1.5B appears only when both adapter buffer limits reach 1 GiB and reported device memory is not below 8 GB. A smaller buffer limit or a tablet/mobile user agent must remove that option. Test a downloaded editable HTML file separately: its Standard editor must still work offline without model setup.

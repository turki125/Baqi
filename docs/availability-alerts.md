# Baqi availability alerts

## User experience

- Save a successful empty text, photo, or combined search with **نبّهني إذا توفّر**. Search errors retain Retry.
- Review the supplied criteria before saving. In-app delivery is always on; email is unchecked by default.
- Sign-in preserves the unsaved request for 30 minutes and reopens the editor without submitting automatically.
- Equivalent requests by the same buyer reuse an alert. Search criteria are not inferred from a photo.
- Matches arrive only in the existing Messages inbox, in one official read-only **تنبيهات باقي** conversation per buyer.
- Each factual message includes a listing card and its own search-specific pause/undo action.
- Manage searches at `/account/alerts`: pause, resume, delete, or change email preferences. Past messages survive deletion.
- Sold or removed stock leaves a readable message with an unavailable card and a link to the saved search.

## Matching and delivery

Text search, photo search, and alerts share the same eligibility function. A single available Riyadh listing must satisfy the request; stock is never pooled. Exact seller-stated specifications are checked independently of visual resemblance. Missing or conflicting stated dimensions do not satisfy a size constraint. Known compatible metric units convert; boxes, pieces and custom units are not converted into area or mass without confirmed conversion data.

The actual sellable quantity respects the listing's minimum increment, whole boxes, and full-lot mode. The budget is compared with the cost of that actual quantity, not the unrounded requested amount. Listing `unitPrice` is per listed unit, including full-lot listings, consistent with the existing order calculation.

Photo matching reuses the existing Gemini service and the **0.55** score threshold. References remain owner-only App Storage paths. The photos are used for appearance, not as proof of size, model or quantity. Changed inventory is rechecked after analysis. Unchanged unsuccessful comparisons are cached; failed comparisons are deferred, never assumed to match.

Publishing, restocking, and price updates wake the worker. A 15-second inventory/outbox sweep recovers from missed wake-ups and process restarts. Saving/resuming also wakes it. Matching is informational: it does not change stock, create orders, or charge anything.

Database constraints enforce one match per alert/listing and one official conversation per buyer. A transaction records the match, message and conversation together. Separate outbox states track email independently. Account identity, ownership, official sender identity and message card data are always server-derived.

## Local email testing — current default

Development defaults to `ALERT_EMAIL_ADAPTER=local`. It **does not send email**. It captures the Arabic RTL email in the private `baqi_availability_local_mail` table, keyed by match ID. There is no public mail-capture endpoint.

The default clearly labeled **test URL** is `https://baqi-alerts.test`; this is deliberately not a production domain. Set the nonsecret server configuration `BAQI_TEST_URL` to the development Preview origin when testing clickable links in that environment. Test messages have a visible local-test banner. Never copy this URL into `BAQI_PUBLIC_URL`.

Recipients must still have a verified primary account address. The automated database tests inject a verified synthetic `.test` identity into the local adapter; that is not verification of a real mailbox or proof of inbox receipt. An unverified address leaves Messages working and email in `pending_verification`.

Run:

```sh
pnpm --filter @workspace/api-server run test:alerts
pnpm run typecheck
```

The tests use uniquely named fixture buyers, sellers, listings and alerts, and remove only those fixtures afterward. They never call Resend or charge payments.

## Exact remaining live-email setup

1. In Resend, verify a sender domain and complete its required DNS records. Choose a verified sender address on that domain.
2. Add the send-authorized **`RESEND_API_KEY`** through Replit Secrets, never source code or chat. A workspace-managed Resend integration may require a workspace manager to connect it first. No key is bundled in this implementation.
3. Set these server-side configuration values:

   | Name | Value |
   | --- | --- |
   | `ALERT_EMAIL_ADAPTER` | `resend` |
   | `BAQI_EMAIL_FROM` | Verified sender, such as `باقي <alerts@your-verified-domain>` |
   | `BAQI_PUBLIC_URL` | Actual published HTTPS website origin/path, obtained after publishing |
   | `BAQI_TEST_URL` | Optional; used only by local test captures, never live emails |

4. Publish the app and apply its managed schema changes through the Publish flow. Production refuses the local adapter and does not fall back to Preview or a test domain when live configuration is incomplete. Confirm the supplied font license permits browser delivery before publishing.
5. Use a verified buyer account and an authorized test inbox. Opt in on one saved search, publish a qualifying listing from a separate seller, inspect the recorded status, open the email and verify its listing and per-search unsubscribe links on the published domain.
6. Confirm actual mailbox receipt. **`provider_accepted` means Resend accepted the request, not that the inbox received it.** No live receipt has been verified as part of local-adapter testing.

The Arabic subject is **توفّر إعلان يناسب طلبك في باقي**. Emails include the factual reason, requested/available/sellable quantity, price, neighborhood, listing link, and an unguessable per-search unsubscribe capability.

Opening the unsubscribe link only displays confirmation; confirming turns off email for that search while keeping its Messages alerts active. Email scanners cannot unsubscribe by fetching the link. The confirmation page returns no buyer identity or full search details.

Before each send/retry the worker rechecks the alert's status, preference and current verified primary address. It durably commits a send lease and first-attempt timestamp before contacting the provider, so a crash after acceptance cannot erase that history. Expired leases recover automatically. A changed primary address cancels an old pending delivery rather than reusing an idempotency key with a different recipient.

Network/temporary provider failures back off with at most eight attempts. Permanent errors are recorded without removing the inbox message. Resend requests use the match ID as their idempotency key. Ambiguous deliveries are not retried beyond a conservative 23-hour window from the first durable attempt, avoiding duplicates after Resend's documented 24-hour idempotency expiry. Operational states include `pending`, `sending`, `pending_verification`, `blocked_configuration`, `retry`, `failed`, `uncertain`, `skipped`, `local_captured`, and `provider_accepted`.

Resend reference: https://resend.com/docs/dashboard/emails/idempotency-keys

## Verification performed

Verified on 2026-11-13:

| Check | Actual result |
| --- | --- |
| Duplicate buyer save, then refresh | Passed in browser/API: same alert ID and one saved search |
| Two separate 5 m² seller listings for an 8 m² request | Passed in browser/API/database: zero matches and zero messages |
| Seller restock to 10 m², then repeated saves | Passed: exactly one match/message and one official conversation |
| Unread official conversation and listing-card navigation | Passed: unread count cleared on opening and card opened the correct listing |
| Search-specific pause, subsequent listing and undo | Passed: no match while paused; resume found inventory once |
| Second saved search | Passed: its match joined the same conversation and worked independently of the first paused search |
| Email-only unsubscribe | Passed: GET did not change preferences; confirmation disabled only email; subsequent match still reached Messages with no mail capture |
| Official-sender and cross-buyer authorization | Passed: buyer could not post as Baqi (403); seller could not read the buyer's conversation or modify/delete the buyer's alerts (404) |
| Ordinary seller chat | Passed: normal initial message and reply remained functional |
| Mobile Arabic RTL | Passed at 390×844: no horizontal overflow; logo, listing card and actions readable |
| Wrong size/model, whole-lot budget and rounded-box budget | Passed in automated matcher/database tests; not repeated in the browser |
| Temporary email failure and concurrent retry | Passed in automated local-adapter tests: inbox intact; one captured email after retry |
| Crash lease recovery and expired provider idempotency window | Passed in automated tests: recovered send once; expired ambiguous delivery not resent |
| Visual threshold | Shared 0.55 threshold and independent size checks covered by code/tests; a real-photo browser journey was not run |
| Full workspace type check and frontend production build | Passed; build emitted existing non-blocking source-map and bundle-size warnings |
| Live Resend acceptance / live inbox receipt / published-domain links | Not tested: sender credentials and published URL are still unavailable |

The database test suite contains seven passing groups and removes its fixture rows. The browser test used separate synthetic buyer and seller accounts with unique pickup neighborhoods so existing sample stock did not invalidate the empty-search and stock scenarios. Its two alerts were left paused/email-off and its five listings unavailable. No orders, reservations or payments were created.

The browser pass identified that a tall card could auto-scroll past its explanation. The follow-up adjustment opens official alert entries at the start of the message instead; it passed type checking and production compilation, but the browser pass was not repeated for that small scroll-only change.

## 60-second demo walkthrough

Use two already signed-in browser profiles: a buyer and a seller. Use an otherwise-empty pickup neighborhood to avoid existing sample stock matching the request.

- **0–15 s — buyer:** Search for **أحتاج ٨ م² بلاط بيج ٦٠×٦٠ في الرياض** with the demonstration neighborhood. Tap **نبّهني إذا توفّر**, review the criteria and save. Explain that optional email is local-test-only until live setup is complete.
- **15–30 s — seller:** Publish a prepared beige 60×60 tile listing with 10 m² in that neighborhood. Two separate 5 m² listings would not qualify.
- **30–40 s — buyer:** Open Messages and the unread **تنبيهات باقي** conversation. Show the Baqi logo, factual match explanation and read-only behavior.
- **40–50 s:** Tap **عرض الإعلان** on the card; verify it opens that seller's listing, then return.
- **50–60 s:** Tap **إيقاف التنبيه لهذا البحث** below its card. Show **تم إيقاف التنبيه · تراجع**, and explain that only this saved search is paused. Use **تراجع** to resume.

This is a walkthrough script, not a claim that a video was recorded or that a live email was received.

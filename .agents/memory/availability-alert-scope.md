---
name: Availability alert delivery scope
description: User decisions about where Baqi alerts belong and how to work before email setup is ready.
---

Availability alerts belong inside the buyer's existing Messages inbox, in one official conversation named «تنبيهات باقي». This replaces the earlier notification-bell or separate-notification-center proposal. Email is optional per saved search.

**Why:** The user explicitly chose this experience and replaced the previous notification-center scope.

**How to apply:** Keep Messages as the only in-app destination when extending availability alerts. Do not introduce a separate notification center for these alerts.

Proceed with implementation and local mail-adapter testing while Resend or the published URL is unavailable. Label test URLs clearly. Report live inbox delivery only after someone actually verifies receipt.

**Why:** The user explicitly instructed development to proceed despite those external prerequisites, without claiming simulated delivery is live.

**How to apply:** Do not block local work solely on email setup; distinguish local captures, provider acceptance, and confirmed inbox receipt in handoffs.

# Design decisions

Why non-obvious choices were made, so they don't get re-litigated or
"fixed" back into a problem they already solved. Add an entry as soon as a
trade-off is settled, not batched at session end. Skip anything derivable
from the code. One tight paragraph per entry — no separate sections.

Starts at M3 — earlier milestones aren't retroactively documented.

---

## M3 — AI provider layer + BYOK settings UI

**Raw `fetch`, not provider SDKs.** Measured (real gzipped bundle) that
`@anthropic-ai/sdk` / `@google/genai` add meaningful weight for an app that
ships as a PWA/APK. The Custom OpenAI-compatible endpoint also needs a
generic HTTP path regardless. SDK retry/backoff was small enough to rebuild
(`src/lib/ai/http.ts`).

**Native structured-output falls back to prompt+Zod on a 400, not any
error.** JSON Schema can't express Zod refinements, so `schema.parse()` is
required either way — native mode is just a reliability upgrade. Gating the
fallback on 400 specifically keeps real failures (401, 500s) from being
silently swallowed as "no native support."

**Anthropic needs `anthropic-dangerous-direct-browser-access: true` on
every request.** Verified via `curl -X OPTIONS`: without it, CORS preflight
fails before the request reaches the API. Undocumented. Google/OpenAI need
no equivalent — don't remove this thinking it's dead code.

**Model field is free text + `<datalist>`, not a validated dropdown.**
Model catalogs churn too fast for a maintained allowlist — confirmed when
the doc-derived Google default (`gemini-2.5-flash-lite`) was already dead
for new accounts within the same session. Test Connection (a real call) is
the actual validator.

**API key field always requires re-typing to save; nothing cached in
state.** Simpler for a single-user app. The alternative (reuse the saved
key when the field's left blank) needs correct invalidation on
provider/preset switch — not worth it unless retyping becomes a real
annoyance.

**Web secure storage splits the device seed (localStorage) from the
ciphertext (IndexedDB).** Threat model per CLAUDE.md is casual
IndexedDB/backup inspection, not a compromised browser — splitting storage
backends raises that bar without a user-facing passphrase.

**`ProviderSettings` loads config via `useEffect`, not `useLiveQuery`.**
`SecureStorage` also backs onto the Capacitor Keychain, which has no Dexie
table to observe — a live query here would leak the web-only
implementation into a component that must also work natively.

## M4 — Exercise generation flow

**The current exercise lives in localStorage, not Dexie, until it's
superseded by the next one — not until it's solved.** An unsolved,
abandoned exercise is never written to `exercises`: it has no evaluative
value. A solved one stays in localStorage too and only flushes to Dexie
(`exercises` + `evaluations`, M5) when the user moves on to the next
exercise. One object shape covers both pending and solved (an optional
`evaluation` field added by M5) — there's no separate pending/solved
union, and the practice screen never reads Dexie to decide what to show.
Consequence, intentional: History (M6) won't list the exercise currently
on screen until the user has moved past it.

**There is a single generation entry point, `requestExercise(level)`,
used by both the regenerate button and the level selector.** Changing the
level immediately reloads the current exercise at the new level — there's
no reason to keep showing a sentence for a level the user just explicitly
left. Treating "regenerate" and "level changed" as the same operation
avoids two parallel code paths for what is the same intent.

**`requestExercise` commits only on success.** It generates the
replacement first; the old exercise (solved or not) is only flushed/
discarded once the new one has arrived. A failed request leaves the
screen showing exactly what it showed before, plus an inline error —
never a blank state. Flushing or discarding before the replacement is
confirmed would leave nothing to show on a failed request.

**A one-slot prefetch buffer is filled in the background right after
each exercise becomes current, keyed to its level.** Consuming it
(regenerate or level change, when the level matches) is instant; an
in-flight buffer fill is awaited rather than duplicated, so clicking
before it resolves still costs one call, not two. A level mismatch
discards the buffer outright. This shifts generation cost earlier in time
rather than duplicating it — steady-state cost is still one generation
call per exercise seen, plus exactly one wasted call at the end of each
session (the trailing unconsumed buffer) and one per level change made
while a buffer is warm. Accepted as negligible given the short
prompt/response and the cheap default models in `presets.ts`; revisit
only if a future preset defaults to an expensive model. Background fill
failures are silent — never surfaced as an error unless the user's own
consume attempt (buffer or fallback) also fails.

**Default level is `appConfig.levelSystem.levels[0]`, not a hardcoded id
like `'B1'`.** The level system is config-driven per CLAUDE.md — assuming
a CEFR id would break for any other level system the template is
reconfigured for.

**A localStorage entry that fails Zod `safeParse` is treated as empty,
not an error.** The stored shape can change across template versions; a
stale or corrupt entry should fall back to "nothing pending" (triggering
a fresh `requestExercise`) rather than crash the practice screen.

**No cross-tab sync for the current-exercise/buffer state (no `storage`
event listener).** Accepted limitation for a single-user local app —
don't add one later mistaking this for a bug.

**`requestExercise` calls are serialized through a module-level promise
queue, not left free-running.** Overlapping calls (initial-load racing a
fast level change, or two fast clicks) previously could interleave reads/
writes of the shared prefetch buffer, or resolve out of call order and let
a stale response overwrite newer state in `Practice`. Serializing means
generation cost is still one call per exercise seen — same as the buffer's
own design — just with in-order completion guaranteed instead of relying
on ad hoc sequence tokens in the component. The prefetch buffer also now
records the `providerId`/`model` it was generated with, not just the level:
provider settings can change between a background fill and its consumption,
and `CurrentExercise.aiProvider/aiModel` must reflect what actually
produced the sentence.

## M5 — Translation evaluation flow

**Evaluation categories are scored 1–5, not 1–10.** Coarser bands are
noticeably more consistent for an LLM rater than a 10-point scale, which
invites invented distinctions between e.g. a 6 and a 7 that aren't real.
The rubric judges intent/fidelity over literal word matching, per
CLAUDE.md's "judge overall meaning/intent the way a teacher would" —
full band-by-band criteria (kept here as the reference; the prompt itself
uses the compact one-line-per-category form in `evaluateTranslation.ts`
to keep per-call token cost down, since the user pays for it via their own
key):

1. **Meaning** (semantic fidelity/intent, no penalty for style): 5 =
   intention and all nuance intact; 4 = main meaning intact, a secondary
   nuance or minor emphasis lost; 3 = incomplete/distorted message — a
   relevant piece of information is missing or the pragmatic intent is
   altered, though the base idea is still recognizable; 2 = serious
   semantic error — inverted subject/object relation, wrongly
   added/omitted negation, or a critical false friend; 1 = unrecognizable,
   incomprehensible, or contradicts the original.
2. **Grammar** (morphosyntactic correctness in the target language,
   judged in isolation): 5 = flawless; 4 = one minor local error
   (agreement, article, preposition) that doesn't affect comprehension;
   3 = two minor errors, or one clear structural error (wrong tense/mood,
   anomalous word order), noticeable but understandable; 2 = multiple
   errors or serious structural failures that require rereading; 1 =
   severe syntactic breakdown.
3. **Naturalness** (fluency, collocations, idiomaticity — native-sounding
   vs. robotic calque): 5 = fully idiomatic; 4 = mostly natural, with a
   slightly rigid or infrequent turn of phrase; 3 = understandable but
   with an evident calque from the source language ("literal
   translation"); 2 = very forced, word combinations a native speaker
   would never use naturally; 1 = robotic, word-for-word, borders on
   absurd.
4. **Vocabulary** (lexical precision and register, judged in isolation —
   if a wrong term wrecks the overall meaning, that impact is scored
   under Meaning, not here): 5 = precise, varied, register-appropriate;
   4 = valid but generic or suboptimal word choice; 3 = evident lexical
   imprecision (term out of context or clearly wrong register); 2 =
   incorrect vocabulary or a repeated false friend; 1 = invented terms,
   wrong-language terms, or absurd choices.

**The overall score is computed client-side, never by the AI.**
`meaning×0.4 + grammar×0.25 + naturalness×0.2 + vocabulary×0.15`, capped
at `meaning + 0.5` and rounded to the nearest 0.5 (half-stars allowed for
overall; category scores stay strict integers) — see
`evaluationScore.ts`. Computing it in the app guarantees the weighting is
actually applied correctly, keeps the AI from having to do arithmetic,
and keeps `EvaluationResultSchema` — the AI's own output shape — down to
just the four integers plus `issues`/`alternatives`. The cap exists so a
translation with broken meaning can't score well overall just by being
grammatically clean: without it, `meaning=2` with everything else at 5
would weight out to 3.8; the cap pulls that down to 2.5.

**Evaluation only flags issues for a category scoring ≤3, and only skips
alternatives when all four categories are 5.** A 4 is a valid
translation with cosmetic room for improvement, not an error worth
frustrating the learner over — flagging it as an "issue" would
contradict the "judge intent, not literalism" principle above.

**No editing/resubmitting after evaluation.** Once `CurrentExercise.
evaluation` is set, the translation is locked — this is also what "solved"
means for the M4 discard-vs-persist rule (an exercise flushes to Dexie
only if `evaluation` is present). A "keep discussing this exercise"
follow-up mode is a plausible future feature but explicitly out of scope
here, so there's no in-between "evaluated but still editable" state to
design for.

**`submitEvaluation` has no request queue, unlike `requestExercise`.**
It doesn't touch the prefetch buffer or any other shared mutable state,
so the M4 queue's reason for existing doesn't apply. Concurrency is
instead handled by the UI simply disabling regenerate/level-select/submit
while any request (generation or evaluation) is in flight — cheaper than
merging queues or introducing response versioning for a race that a
disabled button already prevents.

**The in-progress translation draft is persisted into `CurrentExercise`
(localStorage), debounced ~300ms.** `CurrentExercise` already survives a
refresh (M4); letting the untimed draft survive one too is a small
extension of the same mechanism, not new infrastructure — worth it for
the quality-of-life win of not losing typed-but-unsubmitted work.

**Evaluation prompts don't take the exercise's level as input.** The
rubric judges translation quality in absolute terms; the level already
shaped the source sentence's difficulty during generation
(`generateExercise.ts`), so re-passing it to evaluation would be a
level-relative grading curve that CLAUDE.md's scoring criteria don't
call for.

## M6 — History/review view

**History is read-only: no retrying or re-evaluating a closed exercise.**
Re-translating a sentence whose solution was already shown loses its pull,
and a second evaluation would turn exercise→evaluation into a real 1:N
relation for little value. The intended future way to "re-engage" a closed
exercise is a _discussion_ with the AI about it — out of scope for M6, and
nothing here forecloses it.

**`exercises` and `evaluations` are merged into one table; the evaluation is
embedded in the exercise record.** With retries ruled out, and M4 never
persisting an unsolved exercise, the relation is 1:1 forever. One table
means no join in History, no cascade on delete (Dexie has none), a
single-write flush, and an M7 export that is a plain array with no
`exerciseId` remapping. Shape: `id, sentence, levelId, grammarPoints,
aiProvider, aiModel` (who generated the sentence), `userTranslation`,
`evaluation: { scores, issues, alternatives, aiProvider, aiModel }`,
`solvedAt`; indexes on `levelId` and `solvedAt`. Cost: M2's schema, hooks
and tests are rewritten, and a future need for several evaluations per
exercise would mean splitting again — accepted, since retries were
rejected. Done as a clean rewrite of `version(1)` (including
`secureConfig`), **not** a `version(3)` migration, because dev data is
disposable. Rule from here: the first time data matters, versions become
append-only. One-time dev cost: delete the `language-tutor` IndexedDB in
DevTools (Application → IndexedDB), which also wipes `secureConfig`, so the
API key must be re-entered in Settings.

**There is exactly one date: `solvedAt` — when the evaluation arrived, i.e.
when the user practiced it.** It replaces both `exercises.createdAt`
(generation time, now dropped) and `evaluations.createdAt`, which was a bug:
it was stamped at flush time, so an exercise solved today and moved past
tomorrow was dated tomorrow. `submitEvaluation` captures it and it travels
inside `CurrentExercise.evaluation` (set together with it, so `evaluation`
stays the single "solved" marker) until the flush hoists it to the record's
top level. History sorts and displays by it. Using the generation time
instead would be zero-change and sort identically (exercises are solved one
at a time), but would show the wrong day whenever a draft is left overnight
— which M5's persistent draft explicitly allows.

**The overall score is recomputed from the four category scores on render,
not stored.** Dexie can't index a derived value, so sorting/filtering by it
would happen in JS — but History already loads every row, and
`computeOverallScore` is arithmetic on four numbers, so the cost is
negligible. M6 only sorts by date and filters by level anyway. The category
scores are the source of truth; changing the weights or the meaning-cap
intentionally re-scores history rather than leaving it frozen, and it avoids
a derived field to keep in sync (and to export). If a frozen history is ever
wanted, adding the field then is a trivial change.

**The exercise currently on screen is not listed in History until the user
moves past it (M4's rule, kept), with a one-line hint in the UI.** Merging it
in from localStorage was rejected: it would be a "virtual" row with no Dexie
`id`; a `requestExercise` still in flight when the user opens History flushes
into Dexie while the row read from localStorage at mount is still shown
(duplicate); localStorage isn't reactive; and the row would be thrown away
once discussion lands. **Revisit when the discussion feature is designed:**
it needs a Dexie `id` for the just-solved exercise, so the likely move is to
persist at evaluation time instead of on supersession (reversing M4's flush
timing) — which would also fix "History link → exercise still on the
practice screen" by making Dexie the single source. Deliberately not decided
now: the design depends on product questions (chat shape, context, token
cost) that would be speculation today, and persisting earlier is just
moving one write, so deferring costs nothing.

**History is a third nav tab (`/history`) with expandable rows, not a
`/history/:id` route.** Less navigation for a mobile MVP. Row state (key and
expanded flag) is keyed by record `id`, never by index, so adding a detail
route later is trivial; real navigation will be needed once exercises become
re-enterable. Collapsed row: source sentence, level, overall score, date.
Expanded: the user's translation, the four category scores, issues,
alternatives, and — newly visible — the grammar points (hidden during
practice to avoid biasing the attempt; there is no bias left once solved),
with provider/model as secondary info.

**The evaluation block is extracted from `Practice.tsx` into a shared
`EvaluationView` (with `CategoryScore`), taking plain data props.** Both
`CurrentExercise.evaluation` and the stored record have the same shape and
both use `computeOverallScore`, so History and Practice share it without
coupling.

**Scope is deliberately minimal: newest first, a level filter, delete one,
delete all.** Out of scope: score filter, text search, pagination (local data
of a few hundred rows), and any stats/progress view — premium features, to be
built only once the basics work. Deletion is one `delete` per record (no
cascade needed after the merge). Both "delete" and "delete all" use an inline
two-step confirmation (rather than `window.confirm`, which is unreliable in
Capacitor): the single-delete button sits inside the expanded detail, right
below content being read, and there is no undo, so a stray tap shouldn't be
enough. The collapsed row hides the overall score while expanded, since the
detail already shows it — this avoids duplicating it without touching the
shared `EvaluationView`.
"Delete all" clears Dexie only, not the localStorage current exercise, so a
solved current exercise can still appear later when flushed — accepted.

**An unknown `levelId` (the level config changed) is shown as the raw id with
a discreet "no longer in config" marker, not coerced to `levels[0]` as
`Practice` does.** Only the id is stored, with no label snapshot: it would
duplicate config data, go stale if a label is reworded, and bloat the M7
export; the id alone is enough to render. The level filter's options are the
config levels plus any orphan ids present in the data.

**Export/import is its own milestone (M7), inserted before packaging.** The
APK's WebView and the PWA keep separate IndexedDB stores, so export/import is
the only way to carry history between installs — hence before M8/M9. It has
its own decisions to settle there: a versioned, Zod-validated format; API
keys excluded (the ciphertext is device-bound anyway); merge vs. replace on
import; file mechanics on web (download) vs. Capacitor (Filesystem/Share).
The single-table merge keeps the format a plain array.

### M6 review fixes

**Exercise ids are UUIDs assigned when the exercise is created
(`crypto.randomUUID()`), not Dexie auto-increment; records are written with
`put`.** The id travels with `CurrentExercise` in localStorage, so persisting
the same exercise twice overwrites its own row instead of duplicating it. It
also gives M7 stable cross-device ids: import becomes a plain `put` per
record, so re-importing a file or merging two devices can't duplicate rows —
with per-database auto-increment ids, a backup's ids would either collide with
unrelated local rows or have to be dropped, making every re-import a
duplicate. Done now because Dexie can't change a primary key in a normal
version upgrade (it needs a new table and a copy); dev data is disposable, so
`version(1)` is rewritten again (delete the `language-tutor` IndexedDB once).
Accepted risk: on a UUID v4 collision (122 random bits from the browser's
CSPRNG — practically impossible) one exercise would be silently overwritten;
deliberately not mitigated, since a check would cost a read per write for a
branch that never runs. `randomUUID` needs a secure context, which every
target (localhost dev, HTTPS PWA, Capacitor's `https://localhost`) is.

**The solved exercise is flushed to Dexie _before_ generating its
replacement, and is no longer discarded as part of the flush.** Previously
the flush ran after generation, so a failing Dexie write (quota, private
mode) threw away a sentence that had already cost an API call — and, since
the outgoing exercise was never discarded, every retry repeated it: the user
was stuck and paying per attempt. The prefetch buffer didn't help, because it
was consumed before the flush. Now a failed write costs nothing (no
generation call, buffer untouched), and if generation fails after a
successful write the exercise stays on screen (M4's "commit only once the
replacement arrives" still holds); the retried write is a no-op thanks to the
UUID + `put` above. The outgoing exercise is replaced by simply saving the new
one over it in localStorage.

**The stored record type is derived from the Zod schemas, not written by
hand.** `ExerciseRecordSchema` and `CurrentExerciseSchema` both extend one
`ExerciseBaseSchema` and share the AI's `EvaluationResultSchema` (plus
provider/model), all in `lib/exercise/types.ts`; `db.ts` only re-exports the
inferred type. The hand-written copy could drift silently: a field added to
the AI schema would be stored (the flush passes a variable, which skips TS's
excess-property check) yet be invisible to the record type. The one place the
shapes legitimately differ is `solvedAt`: an ISO string in localStorage and
JSON, a `Date` in Dexie (indexable) — M7's import schema `.extend`s the
record with `z.coerce.date()`. Trade-off: the stored format is coupled to the
AI's output format; if export ever needs to stay stable while the prompt
evolves, M7's versioned format is where they would be split.

**All Dexie writes go through `lib/db/exercises.ts` (`saveExercise`,
`deleteExercise`, `deleteExercises`); components don't call `db.*` for
writes.** Keeps persistence in one place for M7 and any future cascade (e.g.
discussion threads keyed by exercise id).

**"Delete all" is scoped to the active level filter, and delete failures are
shown inline.** With a filter set, the button reads "Delete all at this
level" and the prompt names the count and level being removed; deleting rows
the user can't see, with no undo, was the bug. Both delete actions catch
errors, log them, and show "Couldn't delete — see console." while keeping the
confirmation open, instead of an unhandled rejection with no feedback.

## Dev mock mode

**`npm run dev:mock` is an opt-in Vite mode on its own port (5174,
`--strictPort`), not a default behaviour of `npm run dev`.** Canned AI
responses plus a pre-populated history let the app be exercised without an
API key or spending requests — but `dev` must stay able to hit the real API,
because prompt changes can only be judged against a real model. The separate
port is load-bearing, not cosmetic: a different port is a different origin,
hence a separate IndexedDB and localStorage. Sharing `localhost:5173` would
make mock mode overwrite the real API-key config and mix sample rows into the
real dev history. `--strictPort` stops Vite silently falling back to 5173
when 5174 is busy. The tab title gets a `[MOCK]` prefix.

**The mock plugs in at `createProvider` and via a placeholder provider
config, so `requestExercise` / `submitEvaluation` are untouched.** Those read
the stored config before creating a provider and throw
`NoProviderConfiguredError` without one; rather than teach them about mock
mode, startup stores a throwaway config (`apiKey: 'mock'`, `model: 'mock'`)
and `createProvider` ignores it and returns a `MockProvider`. That is the
only production-code branch (one line). Records produced in mock mode carry
model `mock`, which is what tells them apart from real ones. `'mock'` is
deliberately **not** added to `ProviderIdSchema`: that enum is persisted,
shown in Settings and will be exported by M7, so dev tooling must not leak
into it.

**The history is seeded automatically at startup, only when the table is
empty.** No button or UI. The consequence is deliberate: restarting the mock
server resets an emptied history, and never duplicates a populated one. The
sample rows are deterministic and cover every level, the full range of
scores, and one level id absent from the config (to show the "no longer in
config" marker). Canned evaluations are prefixed "(mock)" so they can't be
mistaken for real feedback.

**Production builds must contain none of it, and that is verified, not
assumed.** The mode flag is a compile-time constant (`DEV && MODE ===
'mock'`). `main.tsx` imports the setup module **statically**, not with
`import()`: the bundler (Vite 8) keeps a dynamic import even inside a dead
branch — it emitted a `setup` chunk and left the sample data in the main
bundle — whereas an unused static import is tree-shaken away. Check after
touching this: build, then search `dist/` for `(mock)`; bundle size should be
unchanged. The mock reads the level from the prompt wording in
`generateExercise.ts`; `mockProvider.test.ts` runs the real generator against
it so drift fails loudly instead of silently serving the wrong level.

## M7 — Data export/import

**The export format is defined on its own and frozen per version, not
derived from `ExerciseRecordSchema`.** A backup file outlives the code that
wrote it. If "v1" were `ExerciseRecordSchema.extend(...)`, any later change to
the AI's output schema would silently redefine v1 and break old backups. So
each format version is written out explicitly (`lib/backup/`). A type-level
test keeps `ExerciseRecord` and the current format version mutually
assignable: when they diverge, the compiler forces a choice between bumping
the version and writing a mapping. A committed v1 fixture file is a golden
test that every future version must still import. Rule from here: **any field
added to `ExerciseRecord` must be optional or have a derivable default.**
Otherwise an older backup can't be migrated forward, because there is nowhere
to get the value from. Backward compatibility is best-effort in that sense:
old files always import, but they only carry what they had.

**Envelope: `{ format: 'ai-language-tutor/history', version, exportedAt,
languagePair: { source, target }, levelSystemId, exercises }`.** `format`
rejects foreign JSON with a clear message. `version` is a plain integer of its
own, independent of the Dexie schema version and the app version. Import
accepts `version ≤ current` and migrates step by step (v1→v2→…). It rejects a
newer version with "exported by a newer version of the app". With only v1
today this is a `switch`, not migration infrastructure. The real stable
contract is this format, not the IndexedDB schema: Dexie can keep being
rewritten in place until real data exists (M8), as long as the importer
works.

**A different language pair is a hard reject; a different level system is
not.** Sentences and translations from another template instance are
meaningless here. Unknown `levelId`s already render as orphans (M6), so
`levelSystemId` is informational only. The pair lives in the version-agnostic
header (with `format` and `version`) and is checked before the deep parse,
so another instance's file whose exercise shape has drifted still gets the
"wrong pair" message, not a field error. Cost: every future format version
must keep `languagePair` at the top level.

**Import is merge-only, and local rows win on id collision (insert only
missing ids, not `put`).** UUIDs make merging trivial, and records are
immutable (History is read-only), so the same id is the same exercise.
"Local wins" protects against a backup from an older format version, migrated
forward with fewer fields, overwriting a richer local row. It also gives the
"N new, M already present" summary for free. There is no replace mode:
"Delete all" followed by import already does that. Accepted consequence:
there are no tombstones, so an exercise deleted locally comes back if a
backup containing it is re-imported. For a personal backup, that is what
restoring means.

**Validation is all-or-nothing, but never opaque.** The whole file is
validated before anything is written, then inserted in one Dexie
transaction. A file that fails is rejected entirely, since files are
machine-written and a corrupt one signals something wrong. Partial imports
would hide that. To keep this from being frustrating, import is two-step,
like M6's deletes. Picking a file only validates it. A valid file shows a
summary (count, language pair, export date, new vs. already present) plus an
Import button. An invalid one shows a human-readable reason in the same spot:
not JSON; not a Language Tutor backup; newer version; wrong language pair;
duplicate id inside the file; or "exercise #17 (_"She had already left…"_):
missing `evaluation.scores.grammar`" plus "…and N more". The full Zod error
goes to the console.

**`solvedAt` is parsed with `z.iso.datetime()` + a transform to `Date`, not
`z.coerce.date()` (correcting the M6 note).** Coerce runs `new Date(x)` on
anything: `null` becomes 1970, `"2020"` becomes Jan 1 2020, and locale-style
strings parse ambiguously. A garbage value would turn into a valid but false
date with no error. The file is always written by this app, so strict ISO
costs a legitimate user nothing. It must be a real `Date` in Dexie: Dexie
orders all Dates before all strings, so a string `solvedAt` would break
History's sort.

**The export includes the current exercise if it is solved.** By M4's flush
rule, a solved exercise still on screen isn't in Dexie yet, so "practice on
the phone, then export" would lose exactly the latest one. It carries its
UUID, so the later flush on the source device can't duplicate it. Import
leaves localStorage untouched. Accepted edge: importing a backup on the same
device can make the on-screen exercise appear in History early (bending
M6's hint). It is still never duplicated, because of "local wins". API keys
and the non-secret provider settings are excluded; the latter live inside
the encrypted blob and are settings, not data.

**File mechanics sit behind a platform switch, like `secureStorage`. M7
ships the web path; the native path is an explicit M8 task.** Web/PWA uses
`Blob` + `<a download>` to export and `<input type="file">` to import. In
Android's WebView `<a download>` doesn't work, so native export needs
`@capacitor/filesystem` + `@capacitor/share`. The file input does work there.
There is no `android/` project yet, so writing the native branch now would
mean shipping untested code. The input's `accept=".json,application/json"`
is only a hint, since some Android pickers ignore MIME types; Zod is the real
check. The file name is `language-tutor-<src>-<tgt>-<YYYY-MM-DD>.json`. The
JSON is indented, with rows sorted by `solvedAt`, so backups are
deterministic and diffable. Export is always the full history, never the
History level filter. It is disabled, with a hint, when there is nothing to
export.

**Import refuses files over 100 MB.** The limit guards against reading a
wrongly picked file (a 2 GB video) into the WebView's memory; it is not a cap
on data. Measured on the pretty-printed format: ~0.85 KB for a typical
record, ~1.9 KB for a deliberately heavy one (four issues, three
alternatives). That makes 100 MB ~55k–125k exercises, decades of daily use;
`backup.test.ts` keeps that true (50k heavy records must fit) and parses a
10k-record file in well under a second. 20 MB was considered and rejected: ~10k records is
reachable by a consistent user within a couple of years. Up to that scale,
`JSON.parse`, Zod and a single `bulkAdd` transaction take seconds at most
(the UI shows a "validating…" state), so streaming or compression would be
complexity with no real case. If the limit is ever hit, the error says so
explicitly, and that's when to revisit.

**Known debt, outside M7: History doesn't scale to thousands of rows.** M6
loads and renders every record unpaginated, on the premise of "a few hundred
rows". With a 10k-row import, History will slow down long before
export/import does. Virtualize or paginate it when volume calls for it.

**Lives in Settings, as a "Data" section next to the provider settings.**
Export/import manage data; they aren't part of browsing History. Mock-mode
exports (`aiModel: 'mock'`) are not guarded against being imported into the
real dev origin: that is tooling for a case that only affects the developer.

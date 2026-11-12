# Texlex clinician experience

Fresh overview of the visit-day functions in ASD and ADHD report engines (branch `adhd-module`). Written for clinicians and product review — what you see, what you do, what happens next.

---

## Ideal day flow

1. Open **ASD** or **ADHD** report.
2. Use **Cliniko calendar** (or **Hey Tex**) to load today’s patient.
3. Confirm **client details** (registration form + Cliniko demographics).
4. Optionally import **Cliniko files** into collateral.
5. Use **Scribe** during the session → Whisper transcript → append to raw notes.
6. Generate / edit report sections as usual → Preview / PDF.

Everything below lives at the top of the report (calendar → scribe), then the usual report sections.

---

## 1. Cliniko calendar

**Where:** Top of ASD and ADHD reports · sidebar: *Cliniko calendar* (ASD).

**Purpose:** Solo-practice workflow — see your bookings and load a patient without searching every name.

### What you see

- **My Cliniko calendar** with range chips:
  - Today
  - Tomorrow
  - This week
  - Last week
  - Prev / Next week (when in week mode)
- Optional **practitioner** filter if more than one Cliniko practitioner is available
- **Refresh**
- List of appointments (time + patient name)
- Toggle: **Also import Cliniko files into collateral…** (remembered in the browser)

### What you do

| Action | Result |
| --- | --- |
| Click an appointment | Loads that Cliniko patient into the report |
| Toggle file import on, then click | Also pulls Cliniko attachments into collateral (ASRS / forms / reports where detected) |
| Change patient | Clears / resets Cliniko linkage (with save/reset behaviour already wired on the report) |

### What loads with the patient

- Name, DOB, and related Cliniko fields into **client details**
- **Registration form** answers when present (Autism or ADHD assessment registration), preferring forms that actually have answers
- **Date seen** from the appointment start (ASD assessment dates / ADHD assessment date)
- Optional **attachments → collateral** if the toggle (or voice “files for…”) is on

### Search fallback

If you need someone not on the visible calendar, the Cliniko search card is still available after **Change patient**.

---

## 2. Hey Tex (voice commands)

**Where:** Inside the Cliniko calendar block.

**Purpose:** Hands-free load of patients and quick questions — not full ambient scribing.

### Controls

| Control | Meaning |
| --- | --- |
| **Hey Tex** | Opens the mic (Chrome / Edge). Speak one command. |
| **Stop** | Appears while listening / working / talking. Stops speech and cancels in-flight work. |
| **Talk back on/off** | Spoken replies via browser / Mac voices (not a cloud voice API) |
| **Voice** dropdown | Pick which system voice Tex uses |

Talk-back is silenced before the mic opens so Tex does not talk over itself.

### Voice commands

| You say (examples) | Tex does |
| --- | --- |
| “Hey Tex, pull up my 9am today” | Finds that booking → loads patient |
| “Load 2:30 pm next Monday” | Same, for that day/time |
| “Open 10am 18 August” | Calendar date + time |
| “Pull up Florence Apps” | Name search in Cliniko → load best match |
| “Pull up files for Florence Apps” | Load patient **and** import Cliniko files |
| “List collateral” / “What collateral information” | Speaks and shows uploaded collateral filenames + categories; notes if written collateral summary is filled |
| “Stop” / “Cancel” / “Quiet” / “Stop talking” | Stops talk-back and cancels; no spoken reply |

Days understood: today, tomorrow, yesterday, weekdays (this / next / last), and spoken calendar dates.

### Browser notes

- Best in **Chrome or Edge**
- Mic permission required
- Commands are short; long encounter capture belongs in **Scribe**, not Hey Tex

---

## 3. Texlex Scribe (Whisper)

**Where:** Directly under Cliniko calendar · sidebar: *Scribe* (ASD).

**Purpose:** Highest-quality encounter transcription for raw clinical notes.

### How it works

1. Tap **Record** (mic permission).
2. Run the session naturally (ambient capture).
3. Tap **Stop**.
4. Audio is sent to the server → **OpenAI Whisper** (`whisper-1`) → transcript appears.
5. Edit the transcript if needed.
6. **Copy** and/or **Append to raw notes** (adds a clear `--- Whisper transcript ---` separator if notes already exist).
7. **Generate sections from session** (option A): drafts **presenting concerns** + all four **background** sections from the transcript. Does **not** generate collateral, criteria, formulation, or recommendations.

### Important UX rules

- Transcript is a **draft** — always review before Generate Report.
- Requires `OPENAI_API_KEY` on the server (never in the browser).
- Max audio size ~25 MB per OpenAI limit.
- Uses browser `MediaRecorder` (webm/mp4/ogg depending on device).

### Hey Tex vs Scribe

| | Hey Tex | Scribe |
| --- | --- | --- |
| Job | Commands (load patient, list files, stop) | Encounter transcript |
| Engine | Browser speech recognition | Whisper API |
| Talk-back | Yes (optional) | No |
| Output | Patient load / status | Editable transcript → raw notes |

---

## 4. Collateral from Cliniko

**Where:** Calendar toggle + collateral section (import UI).

**Purpose:** Pull supporting documents already in Cliniko into Texlex collateral without re-upload.

### Behaviour

- Lists patient attachments from Cliniko
- Downloads content server-side
- Heuristics categorise common items (e.g. ASRS)
- Skips duplicates already present by filename
- Calendar toggle / “files for …” voice path can auto-run import on patient load

Collateral remains clinician-reviewed; AI summary readiness still follows existing PDF vs image/DOCX rules.

---

## 5. Registration forms → demographics

**Where:** Invisible helper on patient load.

**Purpose:** Prefill client details from Cliniko **Autism Assessment Registration Form** or **ADHD Assessment Registration Form**.

### Behaviour

- Engine preference: Autism form for ASD report, ADHD form for ADHD report when both exist
- Prefers forms that have **answers** (avoids blank re-issued Florence-style forms winning)
- Merges into client details with Cliniko patient fields
- Appointment click still sets **date seen**

Always spot-check demographics after load.

---

## 6. Rest of the report (unchanged core)

After calendar + scribe, the familiar Texlex report continues:

- Report header, assessment context, consent  
- Client details  
- Diagnostic conclusion  
- Raw clinical notes → Generate Report / per-section generate  
- Background sections  
- Collateral summary + documents  
- DSM criteria / ADHD criteria  
- Functional impact, formulation, recommendations, limitations, signature  
- Preview / PDF export  
- Draft save / resume by name  
- Finished-report import (where enabled)

Scribe and Cliniko feed **into** this pipeline; they do not replace clinician authorship.

---

## 7. Setup checklist

| Need | Where |
| --- | --- |
| Cliniko | `CLINIKO_API_KEY`, subdomain, region |
| Whisper scribe | `OPENAI_API_KEY` in `.env.local` (restart dev server after change) |
| Section generation | Existing Anthropic key / models |
| Browser | Chrome or Edge for Hey Tex + recording |
| Mic | Allow microphone for Hey Tex and Scribe |

---

## 8. Safety & clinical posture

- PHI stays in normal Texlex + Cliniko paths; Whisper audio is sent to OpenAI for transcription — treat as PHI under your BAA / policy.
- No auto-finalisation: load → review → edit → generate → export.
- Stop is always available for voice talk-back.
- Change patient is intentional; generation-in-flight can disable it.

---

## Quick reference card

```
Calendar  → click booking (optional: import files)
Hey Tex   → “9am today” / “pull up Name” / “list collateral” / “stop”
Scribe    → Record → Stop → edit → Append to raw notes
Report    → Generate / edit sections → Preview / PDF
```

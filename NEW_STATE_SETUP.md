# EG-MMS: Setting it up for a new state (Rajasthan first)

Written 1 October 2026, describing the Uttar Pradesh system as it stands at pages **Version 1.39** and Apps Script deployment **@142**.

This is the handover for building EG-MMS again, from scratch, for Rajasthan. It covers what the system does, how it is built, how it came to be built that way, every step to stand up a new copy, every place where the UP version is tied to UP, and the lessons that cost real time the first time round.

`ARCHITECTURE.md` is the companion document. It explains **why** each part works the way it does, in more depth. This one is about **what** to do and **in what order**.

---

## 0. Read this first

**The decision for Rajasthan:** a completely separate copy. Its own Google Sheet, its own Apps Script project, its own website, built in a separate chat. Nothing is shared with UP at runtime.

**The trade-off, stated once:** two copies means every later fix has to be made in both. That is acceptable for a start. The earlier plan for all twelve states (one app, one sheet per state, routed by email) is still possible later, and nothing in a separate copy blocks it.

**If you are a new Claude chat reading this:** you do not have the UP conversation history or its memory. Everything you need is in this file and in `ARCHITECTURE.md`. Read both fully before changing anything. Section 11 describes how Alok likes to work, and it matters as much as the technical parts.

---

## 1. What EG-MMS is

Educate Girls field officers meet government officials: district education officers, block officers, district collectors, DIET principals. Before EG-MMS those meetings lived in WhatsApp messages and notebooks, and the monthly report was put together by hand.

EG-MMS covers the whole loop:

| Stage | What happens |
|---|---|
| Plan | The officer records who they will meet, when, where, and what they want from it |
| Conduct | After the meeting: what was discussed, what the official said, what happens next, the outcome, photos |
| Record | Minutes document written automatically, photos filed in Drive, colleague emailed |
| Report | District, zone and state views; an open analytics portal; a monthly report emailed on the 1st |
| Follow | AI tags meetings that need attention, escalations go to seniors, a prep brief before the next meeting |

**Who uses it, and what each role sees** (the `Role` column in `Employee_DB`):

| Role | Sees | Extra |
|---|---|---|
| Field | Own meetings only | Cannot delete a meeting (keeps the audit trail) |
| District | Own meetings, plus every meeting in their district(s) | District Meetings tab; a district switcher if they hold more than one district; monthly report for their district(s) |
| Zone | Every meeting in their zone | Zone Meetings tab; Send feedback on conducted meetings; zone monthly report; receives escalations from their zone |
| State | Everything | State Meetings tab (conducted only); Send feedback; state monthly report |

**UP scale at the time of writing:** about 440 meetings, around 300 people in the employee master, 24 districts in three zones.

---

## 2. Everything it does today

### Sign-in
- Email and password. A first-time user, or one who forgot, gets a one-time code by email, then must set a password.
- Only `@educategirls.ngo` addresses that are in `Employee_DB` can sign in.
- Passwords are never stored: salted SHA-256 in Script Properties, five tries per fifteen minutes, the same message for every kind of failure.
- The session lasts up to twelve hours in the browser; the server stays the authority.
- Sign-in never reads the spreadsheet. The employee list is mirrored into Script Properties, so a Sheets outage cannot lock everyone out.

### Plan a meeting
- District, date, approximate time, duration, meeting type, the official's **post** and name, their block if block level, purpose, agenda, an optional colleague, optional documents (PDF/Word/Excel/PPT).
- The district list is built into the page, so it fills instantly.
- Validation names the exact missing field and outlines it in red.
- The same plan saved twice within ten minutes is filed once.
- **Last met line:** pick a post and a line appears, e.g. "BSA last met on 12 Aug 2026, with Ramesh Kumar, about Enrollment".
- **Draft:** what is typed is kept on the phone and restored after an interruption.
- **Type-ahead:** grey suggestion of the rest of the phrase; Tab (or tap the pill on a phone) takes it.
- A Google Calendar event is created for the officer.

### Manage, conduct, postpone, not held
- Manage Meetings lists the officer's open meetings, with overdue ones grouped first, and a "My Month" card.
- **Conduct:** three questions (what was discussed, what the official said, what happens next) plus an outcome dropdown (Commitment, Information, Permission, Courtesy, Awaiting, Nothing concrete). Conduct date defaults to today, can go back, never forward.
- Up to five photos, resized in the browser before upload.
- MoM (minutes) Google Doc, optional, off by default.
- Follow-up meeting can be scheduled from the conduct form.
- **Voice note:** speak the three answers for up to two minutes; Gemini fills the boxes; the officer reads and corrects before saving. A line also points to the phone keyboard's own mic.
- Draft of the conduct form is kept if a save fails.
- A conducted meeting cannot be conducted twice; a note copied word for word from an earlier one is refused.
- **Postpone** and **Not held** close the form at once and save in the background; the meeting leaves the list while it saves and comes back if the server refuses. The server writes each of these only once, even if the request arrives twice.
- **Prep brief:** on demand, AI reads all past meetings with that post and writes what was done, what is pending, and what to raise.

### Viewing
- My Meetings (by month, with CSV download), District Meetings, Zone Meetings, State Meetings.
- District filter with several districts at once, as tap chips.
- **Govt MoM:** the officer can upload the official government minutes (PDF) to a conducted meeting.
- **Send feedback:** State and Zone users can email the officer about a conducted meeting; the reply comes back by email; nothing is stored in the portal.

### Analytics portal (open, no login)
- Four pages: Overview, District Reports, Team Performance, Stakeholders.
- Reads a snapshot (`docs/data/*.json`) refreshed by a GitHub Action, so it loads in half a second; falls back to live data.
- Relationship health by **office**, not person (officials get transferred), transfers, offices gone quiet, coverage gaps.
- **Chatbot:** an icon opens a chat that answers questions about all meetings (counts are computed in code, the model only words the answer).

### AI (Gemini first, Mistral as fallback)
- Hourly tagging of conducted meetings: priority, flag, next action, escalate, category.
- Escalation emails to the officer's senior, with the State Head in CC, decided by a fixed rule, not by the model.
- Prep brief, monthly report narrative, chatbot, voice transcription.

### Emails and scheduled jobs
- Code email, colleague notification after a meeting, escalations, feedback.
- **Monthly report** on the 1st at 7am, scoped to each lead (state, zone, district), as email plus PDF.
- **Weekly reminder** on Monday around 8am: each officer's meetings for the coming seven days.
- Hourly: tagging, escalation, calendar sync (which also refreshes the employee and purpose mirrors).

### Language
- **Hindi interface:** a switch under the name in the menu changes the whole app to official Hindi; data stays as typed. See section 7 for the words that must change for Rajasthan.

### Resilience
- Circuit breaker when the sheet stops answering, a time budget per request, retries only where safe, resending a request whose body was lost on the way, maintenance switch.

---

## 3. How it is built

```
Browser (mostly phones)
   |
   |-- Website on GitHub Pages (static, custom domain)
   |      index.html        sign-in
   |      dashboard.html    the officer app
   |      report.html + 3   the open analytics portal
   |      data/*.json       snapshot of the portal's data
   |
   +-- Apps Script web app (one URL, doGet and doPost)
          |
          +-- Google Sheets    the database
          +-- Google Drive     photos, documents, government PDFs
          +-- Google Docs      minutes of meeting
          +-- Gmail            codes, notifications, escalations, reports
          +-- Google Calendar  meeting events
          +-- Gemini, Mistral  AI features
```

| | |
|---|---|
| Backend | Google Apps Script, `Code.gs` (about 6,900 lines) and `Setup.gs` |
| Frontend | Plain HTML and JavaScript, no framework: `docs/index.html` (650 lines), `docs/dashboard.html` (5,000), `docs/report.html` (2,300) |
| Database | One Google Spreadsheet, eight tabs |
| Hosting | GitHub Pages on a custom domain (UP: `dataimpact.in`) |
| Deploy | `clasp` for the script, `git push` for the website |
| Runs as | The owner Google account (UP: `gr@educategirls.ngo`), web app access "Anyone" |
| Cost | Zero, inside the existing Google Workspace |

**Why this stack:** the organisation had Google Workspace and nothing else, so no server or database to run. The website is on GitHub Pages rather than served by Apps Script because Apps Script takes 3 to 17 seconds before any code runs, while a static page arrives in half a second. Read `ARCHITECTURE.md` section 3.

### Files in the repository

| File | What it is |
|---|---|
| `Code.gs` | The whole backend: API, sheet access, email, AI, jobs, editor helpers |
| `Setup.gs` | `setupSheets()` creates the four meeting tabs with headers (only the early columns, see section 6, step 3) |
| `Index.html`, `MeetingForm.html`, `Stylesheet.html` | The old Apps Script frontend. Not used by anyone, but `doGet` still references `Index` and `MeetingForm`, so keep them in the script project |
| `appsscript.json` | Script manifest: timezone, permissions, web app settings |
| `.clasp.json`, `.claspignore` | clasp settings; the ignore list decides what gets uploaded to Apps Script |
| `docs/` | The website (GitHub Pages serves this folder) |
| `docs/CNAME` | The custom domain |
| `build-pages.js` | Generates `districtreports.html`, `teamperformance.html`, `stakeholders.html` from `report.html` |
| `scripts/snapshot.js` | Fetches the portal's public data and writes `docs/data/*.json` |
| `.github/workflows/snapshot.yml` | Runs the snapshot every 30 minutes (GitHub often runs it less often) |
| `ARCHITECTURE.md` | The why |

### The spreadsheet: eight tabs

A meeting is born as a row in **Plan Meetings** and stays there; its Status changes. Conducting writes a second row into **Conducted Meetings**. Postponed and Cancelled work the same way. The code reads and writes by **column position**, so the order of columns must be exactly as below.

**Employee_DB** (A to H)
`District, Block, Employee Name, Designation, Email, Role, Zone, Additional Districts`
- Role: `State`, `Zone`, `District` or `Field`.
- Zone: read **only** for the Zone role (e.g. `UP ZONE-2`). For everyone else it is ignored; their zone comes from their district.
- Additional Districts: comma separated, names must match exactly how the district is written everywhere else.

**Plan Meetings** (A to X, 24 columns)
`Meeting ID, District, Employee Name, Post, Email, Meeting Date, Meeting Time, Duration, Meeting Type, Stakeholder Name, Stakeholder Post, Meeting Purpose, Meeting Agenda, Status, Start Time, End Time, Reason, Colleague Name, Colleague Post, Submitted At, Parent Meeting ID, Documents Folder, Calendar Event ID, Stakeholder Block`

**Conducted Meetings** (A to AF, 32 columns)
`Meeting ID, District, Employee Name, Post, Email, Original Date, Original Time, Duration, Meeting Type, Stakeholder Name, Stakeholder Post, Meeting Purpose, Meeting Agenda, Conduct Date, Conduct Time, Key Discussion Points, Photos Folder Link, MoM Doc Link, Colleague Name, Colleague Post, Conducted At, Govt MoM, Priority, Flag, Next Action, Escalate, Category, Govt MoM Summary, Tagged At, Escalation Sent At, Stakeholder Block, Outcome`

**Postponed Meetings** (A to K)
`Meeting ID, District, Employee Name, Email, Stakeholder Name, Stakeholder Post, Meeting Purpose, Original Date, New Date, Reason, Postponed At`

**Cancelled Meetings** (A to Q)
`Meeting ID, District, Employee Name, Post, Email, Meeting Date, Meeting Time, Duration, Meeting Type, Stakeholder Name, Stakeholder Post, Meeting Purpose, Meeting Agenda, Colleague Name, Colleague Post, Reason, Cancelled At`

**Meeting Purpose** (A): `Meeting Purpose`, then one purpose per row. This list feeds the Purpose dropdown.

**Officials** (A to D): `District, Post, Name, Contact`. Reference only; waiting for data in UP.

**Stakeholder Type** (A): reference list only. **The Post dropdown does not read it**; the posts are written into `Code.gs` (see section 7).

---

## 4. How it was built in UP (the timeline)

About 770 commits between 22 May and 1 October 2026. Nothing was designed up front: almost every feature came from someone using the system and saying what was wrong.

| When | What arrived |
|---|---|
| 22 May | Website on GitHub Pages: mobile sign-in and dashboard |
| 25 May | MoM document, colleague email, photos, postpone, analytics moved into `report.html`, EG branding |
| 26-27 May | District Meetings and State Meetings tabs |
| 1 June | Server-side sign-in gate and role enforcement |
| 3 June | Zone Meetings, zone leads |
| 20 July | Additional Districts and the district switcher |
| 11 August | Upload of the official government MoM (PDF) |
| 19 August | Portal reads a snapshot from the website (instant load) |
| 21 August | Plan agreed for all twelve states |
| 1 September | Monthly report (computed, then AI narrative), AI tagging, escalations, calendar sync, weekly reminder (built) |
| 15 September | Relationship health, Stakeholders page |
| 16 September | Three-question conduct form, outcome dropdown, note quality audit |
| 17 September | The spreadsheet stopped answering for a night: employee mirror, circuit breaker, maintenance switch |
| 18 September | Password sign-in, code only for first time and recovery |
| 19 September | Send feedback; `ARCHITECTURE.md` written |
| Late September | Type-ahead, last-met line, plan draft, voice notes, chatbot, weekly reminder switched on, Hindi interface, cancel and postpone written once |
| 1 October | Logo hosted on our own site, monthly report sections kept on one page, `EMP_show()` |

---

## 5. Before you start: decide and collect

Get these from the Rajasthan team **before** building. Most of the setup is filling these in.

| # | Item | Why it matters | UP example |
|---|---|---|---|
| 1 | **Owner Google account** for Rajasthan | Everything runs as this account, and Apps Script quotas (email per day, script run time per day) are **per account**. Using the UP account would make both states share one allowance. A separate account is strongly recommended | `gr@educategirls.ngo` |
| 2 | **District list**, exact spelling in capitals | Used for every filter and report; must match the Employee_DB spellings character for character | `LAKHIMPUR KHERI`, `MAHRAJGANJ` |
| 3 | **Zones** and which districts are in each | Hard-coded in two places (section 7) | `UP ZONE-1` to `UP ZONE-3` |
| 4 | Any **state-level place** with no district team (like Lucknow in UP), selectable by everyone | `STATE_EXTRA_DISTRICTS` | `LUCKNOW` |
| 5 | **Employee master**: district, block, name, designation, email, role, zone (zone leads only), additional districts | Who can sign in and what they see | the `Employee_DB` tab |
| 6 | **Official posts** used in Rajasthan (state, district, block level) | The Post dropdown is hard-coded with UP posts | BSA, ABSA, ARP, DC-Gender |
| 7 | **Meeting purposes** | The Purpose dropdown | Introductory Meeting, Enrollment, Learning |
| 8 | **State Head** who is copied on escalations | `ESC_CC_STATE` | UP State Head |
| 9 | **Admin emails** (can run admin actions) and the **test email** for reports | `ADMIN_EMAILS`, `REPORT_TEST_EMAIL`, `DEMO_EMAIL` | |
| 10 | **Subdomain name** (decided: a subdomain of dataimpact.in, e.g. `rajasthan.dataimpact.in`) and who can edit dataimpact.in's DNS | One DNS record has to be added | `dataimpact.in` |
| 11 | Gemini and Mistral **API keys** | AI features; can reuse UP's keys, but they then share rate limits | |

Ask, rather than guess, for anything in this list. A wrong district spelling shows up as "0 meetings" weeks later.

---

## 6. Step by step

### Step 0. The new folder: copy the code, not everything

The Rajasthan work starts in a new, empty folder (for example `D:\EG-MMS-RJ`), opened in a new chat. That folder needs the UP **code** as the starting point, because the Rajasthan copy is built by changing it. It must **not** receive everything in the UP folder.

**Copy these:**

| What | Why |
|---|---|
| `Code.gs`, `Setup.gs` | The backend |
| `Index.html`, `MeetingForm.html`, `Stylesheet.html` | `doGet` still references them |
| `appsscript.json`, `.claspignore`, `.gitignore` | Manifest, upload rules, and the git ignore list (it keeps `.clasp.json` out of git) |
| `docs/` **without** `docs/data/*.json` and **without** `docs/CNAME` | The website. The JSON files are UP's data, and `CNAME` says `dataimpact.in`, which belongs to UP; step 10 writes a new one |
| `build-pages.js`, `scripts/snapshot.js`, `.github/workflows/snapshot.yml` | Portal pages and the snapshot job |
| `ARCHITECTURE.md`, `NEW_STATE_SETUP.md` | The two documents |

**Never copy these:**

| What | Why |
|---|---|
| `.git/` | Rajasthan gets its own repository and history |
| `.clasp.json` | Points at the UP script; uploading with it would overwrite UP |
| `.claude/` | Local settings and worktrees of the UP chat |
| `github-recovery-codes.txt` | **A secret.** Recovery codes for the GitHub account |
| `restore-gr-clasp.sh` | UP's clasp login helper |
| `*.xlsx`, `*.docx`, `doc_content.txt` | UP staff lists and working files |
| `scripts/report-proto.js` | An unfinished UP prototype |
| `docs/data/*.json` | UP's published data |

After copying, search the new folder for `1a7068K07gE40PLkxIs39A6OJvalCK7IgDJTZB5NQH40` (UP's sheet) and `AKfycbw2JJ5xmZ` (UP's web app). Every hit must be replaced during steps 5 and 9; none may remain when Rajasthan goes live.

### Step 1. Owner account and Drive folder
1. Sign in as the Rajasthan owner account.
2. In Drive, create a folder, e.g. `EG-GR-Meetings-RJ`. Photos, documents and MoMs will go under it.
3. Copy its folder ID from the URL; it goes into `DRIVE_ROOT_ID`.

### Step 2. The spreadsheet
1. Create a new Google Sheet, e.g. `EG-MMS - Rajasthan`, owned by the owner account.
2. Copy its ID from the URL; it goes into `SPREADSHEET_ID`.

### Step 3. Tabs and headers
1. Create the eight tabs with **exactly** the names and column orders in section 3.
2. `setupSheets()` in `Setup.gs` can create the four meeting tabs, but it was written early and only creates Plan Meetings up to column T and Conducted Meetings up to column U. Add the later headers by hand (Plan: U to X; Conducted: V to AF). The code writes those columns by position, so the headers are for people, but keep them right.
3. Create `Employee_DB`, `Meeting Purpose`, `Officials`, `Stakeholder Type` by hand.
4. Fill `Employee_DB` and `Meeting Purpose`.

### Step 4. The Apps Script project
1. Create a new standalone Apps Script project as the owner account, e.g. `EG-MMS Rajasthan`.
2. Work in the new folder from step 0, and start a fresh Git repository there (`git init`), not a branch of the UP one.
3. Install clasp and sign in **as the owner account**:
   ```bash
   npm install -g @google/clasp
   ```
   ```bash
   clasp login
   ```
4. Create a new `.clasp.json` in the new folder with the new script's ID (`scriptId`) and `rootDir` set to the new folder. Never reuse UP's `.clasp.json`.
5. Keep `.claspignore` as it is. It must exclude `docs/**`, `scripts/**`, `.github/**`, `build-pages.js`, `*.md`, `*.sh`, `.claude/**`.

### Step 5. Change everything that says UP
Work through section 7 line by line. Do this **before** the first deploy.

### Step 6. Script Properties
In the Apps Script editor: Project Settings, Script Properties. Add:
- `GEMINI_KEY`
- `MISTRAL_KEY`

**Never put a key in the code.** The UP repository is public, and the Rajasthan one probably will be too.

### Step 7. Upload and check what will be uploaded
```bash
clasp show-file-status
```
Expect exactly six files: `appsscript.json`, `Code.gs`, `Index.html`, `MeetingForm.html`, `Setup.gs`, `Stylesheet.html`. Anything else (a `.js` from `docs` or `scripts`) would be uploaded too, and a Node script inside Apps Script takes the whole web app down.
```bash
clasp push -f
```

### Step 8. First deployment
1. In the editor: Deploy, New deployment, type Web app. Execute as **Me** (the owner account). Who has access: **Anyone**.
2. Approve the permissions it asks for (Drive, Sheets, Docs, send mail, external requests, triggers, Calendar).
3. Copy the web app URL (`https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`). This is the `GAS_URL`.
4. Every later release updates **this same deployment**, so the URL never changes:
   ```bash
   clasp deploy -i <DEPLOYMENT_ID> -d "what changed"
   ```
   Functions run from the editor use the latest pushed code without a deploy; the web app only changes on deploy.

### Step 9. The website
1. Put the new `GAS_URL` into `docs/index.html`, `docs/dashboard.html`, `docs/report.html`, `docs/monthly-report.html` and `scripts/snapshot.js`. (The other three portal pages are generated from `report.html`.)
2. Make the UP-specific changes in `docs/` from section 7.
3. Reset the footer version in `index.html`, `dashboard.html` and `report.html` (e.g. `Version 1.0`), then:
   ```bash
   node build-pages.js
   ```
4. Empty `docs/data/` of UP's JSON files (the snapshot will refill it with Rajasthan's).

### Step 10. Hosting: a separate repository and a subdomain

Decided: a **separate GitHub repository under the same GitHub login** as UP (`educategirls-gr`), served on a **subdomain of dataimpact.in**. UP's site at `dataimpact.in` is not touched by any of this.

1. Create the repository under `educategirls-gr`, e.g. `mms-rajasthan`, and push the Rajasthan folder to it. Add it as its own remote; never push Rajasthan code to the UP repository (`educategirls-gr/mms`).
2. Settings, Pages: deploy from branch `main`, folder `/docs`.
3. Pick the subdomain, e.g. `rajasthan.dataimpact.in`, and write exactly that, alone on one line, in `docs/CNAME` (replacing `dataimpact.in`). Pages, Custom domain shows the same value.
4. In the DNS settings of `dataimpact.in` (wherever the domain is managed), add one record:
   | Type | Name / Host | Points to |
   |---|---|---|
   | CNAME | `rajasthan` | `educategirls-gr.github.io` |
   Leave UP's existing records exactly as they are.
5. Wait for GitHub's DNS check to pass (minutes to a few hours), then tick **Enforce HTTPS**.
6. Until then the site works at `https://educategirls-gr.github.io/mms-rajasthan/`.

The same login means the same limitation as UP: its token cannot push files in `.github/workflows/`, so the snapshot workflow is added through the GitHub web page (step 11).

### Step 11. The snapshot job
1. Settings, Actions, General, Workflow permissions: **Read and write**.
2. Add `.github/workflows/snapshot.yml`. In UP the local token could not push workflow files, so it was added through the GitHub web page.
3. Run it once by hand (Actions tab, Run workflow) and check `docs/data/*.json` appear.

### Step 12. People
1. Run `EMP_refreshMirror()` and `PURPOSE_refresh()` in the editor.
2. Run `EMP_show()` to see everyone with more than one district, with spelling warnings.
3. Sign in yourself: get a code, set a password.

### Step 13. Test before anyone else uses it
- Plan a meeting, conduct it with photos and with the MoM ticked, postpone one, mark one not held.
- Check the four rows land in the right tabs and the Drive folder fills.
- Check District, Zone and State views with a test account of each role.
- Open the portal, check the snapshot time.
- `REPORT_STATE_test()` sends the state report to the test email only.
- `ESC_preview()` shows what escalation would send, sending nothing.

### Step 14. Switch on the scheduled jobs
Only once real meetings are flowing:

| Run in the editor | Installs | When |
|---|---|---|
| `TAG_installAuto()` | `taggingJob` | Hourly |
| `ESC_installAuto()` | `escalationJob` | Hourly |
| `CAL_installAuto()` | `calendarJob` (also refreshes the employee and purpose mirrors) | Hourly |
| `REPORT_step3_INSTALL_AUTO()` | `monthlyReportJob` | 1st of the month, 7am |
| `NUDGE_installAuto()` | `nudgeJob` (weekly reminder) | Monday, around 8am |

`TRIGGER_status()` lists what is installed. Try each first: `TAG_run()`, `ESC_step1_TEST()`, `CAL_test()`, `REPORT_step1_TEST()`, `NUDGE_preview()` then `NUDGE_test()`.

---

## 7. Every place the UP copy is tied to UP

Line numbers are from the UP code on 1 October 2026 and will drift; search for the name.

### `Code.gs`

| Name / place | UP value | For Rajasthan |
|---|---|---|
| `SPREADSHEET_ID` (top) | UP sheet | The new sheet's ID |
| `DRIVE_ROOT_ID` (top) | UP Drive folder | The new folder's ID |
| `ALLOWED_DOMAIN` | `educategirls.ngo` | Same |
| `ADMIN_EMAILS` | gr@ and Alok | Rajasthan owner account and admin |
| `DEMO_EMAIL` and `demoSetField/District/State` | Alok | The admin's email |
| `ZONE_DISTRICTS` | `UP ZONE-1/2/3` with their districts | Rajasthan zones and districts, exact spellings |
| `STATE_EXTRA_DISTRICTS` | `['LUCKNOW']` | Rajasthan's equivalent, or `[]` |
| `DISTRICT_ALIASES` | UP spelling pairs (MAHRAJGANJ, BHADOHI) | Start with `{}`; add pairs only when two spellings of one district turn up |
| Post list in `getDropdownData` | ACS, DGSE, UIC, SPD, ASPD, JD, BSA, DC-..., ABSA, ARP... | **Rajasthan's posts** (item 6 in section 5) |
| `ESC_CC_STATE` | UP State Head | Rajasthan State Head |
| `REPORT_TEST_EMAIL` | Alok | Rajasthan test address |
| `'Uttar Pradesh'` in `getMonthlyReport` (state scope label), `previewReportRecipients`, `REPORT_clearNarrative` | `Uttar Pradesh` | `Rajasthan` (keep them identical, the cache key uses it) |
| `'UP'` in the `sendMonthlyReports` log line | `UP` | `RJ` |
| `.replace('UP ','')` in the report email's leaderboard | strips `UP ` from zone names | Match the Rajasthan zone naming |
| `VOICE_PROMPT` | "a field officer from Uttar Pradesh" | Rajasthan |
| Chatbot system prompt (`askMeetings`) | "Government Relations team in Uttar Pradesh" | Rajasthan |
| Glossary in the tagging and prep prompts (search `GLOSSARY`) | BEO, BDO, BRC, CRC, BSA as block-level offices | Rajasthan's block-level offices |
| `insertSampleData()` | Inserts UP sample meetings with real UP names | **Never run it**; delete it in the Rajasthan copy |

### `docs/dashboard.html`

| Place | UP value | For Rajasthan |
|---|---|---|
| `GAS_URL` | UP web app | New web app URL |
| `ZONE_DISTRICTS`, `STATE_EXTRA_DISTRICTS` | Copy of the `Code.gs` lists | Same lists as `Code.gs`. **They must match** |
| `SUGGEST_PHRASES` (type-ahead) | UP phrases: Basic Shiksha Adhikari, Samagra Shiksha, Shiksha Rath, BSA | Rajasthan phrases and post names; the Hinglish verbs can stay |
| `mbJunk` regex | `beo|bsa|absa|arp|brc|crc|dm|cdo|dc|dios|dfo|...` | Add Rajasthan post abbreviations, so a post typed as a name is not treated as a person |
| Block hint under Stakeholder Block | "ABSA, BEO or ARP" | Rajasthan block-level posts (also its Hindi line in `HI`) |
| Placeholders | "Shiksha Rath route", "KGBV attendance", "BSA agreed to share..." | Rajasthan examples (and their Hindi lines in `HI`) |
| Hindi dictionary `HI` | **जनपद** for district, **विकास खंड** for block | UP official usage. Rajasthan says **जिला**; confirm the word for block with the team. Change every occurrence, including the role badges |
| Footer version | `Version 1.39` | Start again |

### `docs/report.html` and the rest

| Place | For Rajasthan |
|---|---|
| `GAS_URL` in `report.html` | New URL, then `node build-pages.js` |
| `mbJunk` regex in `report.html` | Same change as the dashboard |
| `docs/index.html` `GAS_URL`, footer version | New URL, new version |
| `docs/monthly-report.html` `GAS_URL` | New URL (the monthly report page linked from the report email) |
| `docs/CNAME` | The Rajasthan domain |
| `scripts/snapshot.js` `GAS` | New URL |
| `docs/eg-logo.png` | Keep. **Do not link the logo from educategirls.ngo**; that site now blocks image requests |

---

## 8. Running it day to day

| Task | How |
|---|---|
| Add a person | Add the row in `Employee_DB`, then `EMP_refreshMirror()`. First sign-in sends them a code |
| Someone moves district | Change their row, `EMP_refreshMirror()`, they log out and in |
| Give charge of more districts | Column H, comma separated, exact spellings; `EMP_refreshMirror()`; they log out and in. Check with `EMP_show()` |
| Make someone a zone lead | Role `Zone`, Zone column = the exact zone name; refresh; log out and in. They then get escalations and the Send feedback button |
| Someone leaves | Remove the row, `EMP_refreshMirror()`; they are logged out on their next page load |
| Clear a password | `PW_clear("email")` |
| Test the monthly report | `REPORT_clearNarrative()` then `REPORT_STATE_test()`, only to the test email |
| The sheet is not answering | `BREAKER_status()`, `SHEET_probe()`; `MAINT_on()` while it is fixed, `MAINT_off()` after |
| Release the website | Bump the version in the three files, `node build-pages.js`, `git push` |
| Release the script | `clasp show-file-status` (six files), `clasp push -f`, `clasp deploy -i <ID> -d "..."` |

**Important for additional districts:** before the change, an officer working in several districts could only choose their own, so their meetings elsewhere were filed under their home district. The change fixes future meetings only.

---

## 9. Editor functions

Run from the Apps Script editor. The Run button cannot pass arguments, so the few that need one (`PW_clear("email")`, `MTG_trace("MTG-...")`, `LOGIN_debug("email")`, `EMP_seedOne(...)`) are called from a two-line wrapper function written for the occasion.

| Area | Functions |
|---|---|
| People | `EMP_refreshMirror`, `EMP_show`, `EMP_mirrorStatus`, `EMP_seedOne` (outage only), `PW_status`, `PW_clear` |
| Lists | `PURPOSE_refresh`, `PURPOSE_seedFallback` |
| Health | `TRIGGER_status`, `BREAKER_status`, `BREAKER_reset`, `ROWS_status`, `SHEET_sizes`, `SHEET_probe`, `SHEET_trimTail`, `MAINT_on`, `MAINT_off`, `LLM_probe`, `LOGIN_debug` |
| Data checks | `MTG_trace`, `CONDUCT_findDupes`, `PLAN_findDupes`, `PLAN_findBlank`, `NOTE_quality` |
| AI tags | `TAG_run`, `TAG_installAuto`, `TAG_showBlocked`, `TAG_recheckBlocked` |
| Escalation | `ESC_preview`, `ESC_step1_TEST`, `ESC_step2_LIVE`, `ESC_installAuto`, `ESC_stopAuto` |
| Calendar | `CAL_status`, `CAL_test`, `CAL_live`, `CAL_installAuto` |
| Monthly report | `REPORT_STATE_preview`, `REPORT_STATE_test`, `REPORT_clearNarrative`, `REPORT_step1_TEST`, `REPORT_step2_SEND_LIVE`, `REPORT_step3_INSTALL_AUTO` |
| Weekly reminder | `NUDGE_preview`, `NUDGE_test`, `NUDGE_live`, `NUDGE_installAuto`, `NUDGE_stopAuto` |
| Hourly jobs | `TRIGGERS_pauseHourly`, `TRIGGERS_restoreHourly` |
| Experiments | `VOICE_test`, `COMMIT_dryRun`, `MOM_measure` |

**Row numbers are per tab.** Row 127 of Conducted Meetings is not row 127 of Plan Meetings; bulk deletes go bottom up.

---

## 10. Lessons that cost time (do not learn them again)

**The platform**
- Apps Script takes **3 to 17 seconds** (measured up to 63) before your code runs, every request. The cost is the round trip, not the work. Cross it rarely; parallel requests help, merging endpoints does not.
- A POST sometimes arrives **without its body** (the browser follows a redirect as a GET). Writes that must be POSTs refuse with `BODY_MISSING` and the page resends. Never let a body-less request write a half row.
- An error page means the script never ran (safe to retry). Silence means it may have run (do not blindly retry a write). Make writes **idempotent**: same plan in ten minutes, conduct twice, cancel twice, postpone to the same date twice, all write once.
- `fetch` has no timeout; the pages abandon after 45 seconds.
- Six minutes per execution and a daily run-time allowance **per account**. One hanging read can eat the day for everyone; hence the circuit breaker and the per-request budget.
- Cache per **sheet**, shared, not per user. Every write must clear the shared copy, including district and zone lists.

**Data**
- District names must match **exactly**. `MAHARAJGANJ` in one place and `MAHRAJGANJ` in another silently shows 0 meetings. Decide the spellings on day one.
- Relationships are by **office (post)**, not by person, because officials transfer. Name matching for transfers: no edit-distance rule; it cannot tell Dileep/Dilip from Amit/Ajit.
- Old meetings keep whatever district they were filed under; changing someone's districts only changes the future.

**AI**
- Gemini 3.6 flash is a thinking model: disable thinking and raise the token budget, or it returns empty text with status 200.
- Count in code, let the model only word it. The chatbot and the report narrative get computed numbers.
- Tell the model the truth about labels: the report once said "7 zones" because the prompt called seven districts zones.
- Glossaries in prompts matter: "block" is an administrative unit, past-tense Hinglish means work done.
- Measure before building: a keyword rule for "urgent" was measured at 7% recall and not built.

**Deployment**
- `clasp push` uploads every `.js`/`.html` in the folder unless ignored. Always `clasp show-file-status` first.
- Never `clasp pull` (it writes `.js` copies next to the `.gs` files).
- `clasp login` on a machine overwrites the stored account; make sure it is the owner account before pushing.
- Keep `appsscript.json` on `ANYONE_ANONYMOUS`.
- The deployment ID must never change, or every page's `GAS_URL` breaks.
- Pushing workflow files needs a token with `workflow` scope; add them through the web page instead.
- Bump the footer version on every website release; it is the only way to see a stale cached page.

**Look and print**
- Do not hotlink anything from educategirls.ngo; its bot check returns a 503 page instead of the image.
- In the PDF report, keep each section on one page (`page-break-inside: avoid`), or a heading ends up alone at the foot of a page.

**The sheet outage (17 September)**
- The spreadsheet became unreadable for a night. Because sign-in read the sheet, nobody could log in. Since then the employee list is mirrored into Script Properties. Do not undo that.

---

## 11. How Alok likes to work

This is the part a new chat most needs.

- **Conversation in Hinglish**, short and clear. Emails, reports and anything for others in **English**.
- **Never use em dashes**, anywhere, in code comments, messages or documents. Use commas or hyphens.
- **Explain what a function does before asking him to run it.** He often asks "ye kya karega".
- **Measure before believing.** Several confident diagnoses in UP were wrong; a two-minute measurement settled each one.
- **Test on the real code** with stub data before deploying, and check the live site after.
- **Show before writing to the sheet.** Any change to existing records: first a preview that changes nothing, then the real run.
- **Do not touch sign-in** unless he asks. "Login me koi change mat karna."
- **Keys only in Script Properties**, never in code; the repository is public.
- **Say plainly what was tested and what was not.** If something is only verified on a stub, say so.
- **Ask, do not guess**, for names, spellings, emails and who should receive what.
- He tests on his phone; most users are on phones, often on weak connections.

---

## Appendix A. First message for the new chat

> We are building EG-MMS for Rajasthan as a separate copy: its own Google Sheet, Apps Script project, its own GitHub repository under the same login (educategirls-gr), and a subdomain of dataimpact.in. This folder holds a copy of the UP code to start from. Read `NEW_STATE_SETUP.md` and `ARCHITECTURE.md` fully before changing anything, and check step 0 was followed (no UP `.clasp.json`, no secrets, no UP data). Then go through section 5 of `NEW_STATE_SETUP.md` with me and ask me for each input. Do not guess any district name, post, email or zone. Follow section 6 step by step, and use section 7 as the checklist of everything that must change from UP. Talk to me in Hinglish, never use em dashes.

## Appendix B. Inputs sheet to send to the Rajasthan team

| What | Format |
|---|---|
| Districts | One per line, capitals, exact official spelling |
| Zones | Zone name, then its districts |
| State-level places (no team) | One per line |
| Employee list | District, Block, Name, Designation, Email, Role (State/Zone/District/Field), Zone (zone leads only), Additional Districts |
| Official posts | Name of each post, and whether it is state, district or block level |
| Meeting purposes | One per line |
| State Head for escalation CC | Name, email |
| Admins and test email | Emails |
| Subdomain | The name wanted (e.g. rajasthan.dataimpact.in), and who can edit dataimpact.in's DNS |

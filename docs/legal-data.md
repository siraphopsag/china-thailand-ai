# Legal reference data (v2 model, Nov 2026)

What the fixed rules, the contract check and the help page rely on, where each item was checked and what is still open.
Nothing here is legal advice; the faculty advisor should confirm the Thai texts against the Royal Gazette before real use.

## Minimum wage (`src/data/minwage.ts`)

Thailand (all 77 provinces, 337–400 baht a day): Wage Committee Notification No. 14 (ประกาศคณะกรรมการค่าจ้าง เรื่อง อัตราค่าจ้างขั้นต่ำ
ฉบับที่ 14), Royal Gazette Vol. 142 Special Part 236 ง pp. 29–31, in force 1 July 2025, read from the Gazette PDF
(ratchakitcha.soc.go.th/documents/76681.pdf). No newer notification was found (the Wage Committee declined a rise on 17 Mar 2026;
"No. 15" of Jan 2026 is the separate skill-standard series), but the Gazette index itself could not be searched. Higher district
or sector rates are not used: Mueang Chiang Mai 380, Hat Yai 380, Ko Samui 400, hotels of types 2–4 and entertainment venues 400.

China (31 provinces): MOHRSS table "全国各地区月最低工资标准情况（截至2026年10月1日）" (mohrss.gov.cn, published 8 Oct 2026), lowest
tier of each province. Ningxia uses its 1 Nov 2026 notice (2190, newer than the table). Heilongjiang changes from 1910 to 2050 on
1 Dec 2026 (notice of 18 Nov 2026; `CN_MIN_MONTHLY_NEXT`). Weaker checks: Tianjin and Hebei (portal news items), Shanxi (PDF seen
only through search text), Xinjiang (document number not seen). Drafts not in force and not used: Sichuan, Guizhou.

Rule: a post or contract is flagged only when it pays less than the LOWEST legal rate anywhere in its province, so a lawful post is
never accused. Thailand: daily rate × 30 days for monthly pay. China: the province's lowest monthly tier. A salary in the other
country's currency is not compared.

## Jobs closed to foreigners in Thailand

Ministry of Labour notification of 2020 (ประกาศกระทรวงแรงงาน เรื่อง กำหนดงานที่ห้ามคนต่างด้าวทำ พ.ศ. 2563), under the Emergency
Decree on Managing the Work of Foreigners B.E. 2560, s.7. List 1 patterns are in `src/domain/match/postText.ts` (unchanged); since
v2 the post check also tells the employer why the post stays inside Thailand.

## Contract check (`src/domain/match/contract.ts`, labels `c2.law.*`)

Checked for the v2 plan on 21 Nov 2026: CN Labour Contract Law Arts. 8 and 9; TH Labour Protection Act ss.10, 28, 76;
TH Anti-Trafficking Act s.6/1(4) (added by the 2019 Emergency Decree). Named for the advisor to confirm: CN Labour Law Art. 38
(weekly rest) and CN Interim Provisions on Wage Payment Art. 16 (deductions). The 20% deduction threshold follows TH LPA s.76's
one-fifth cap.

## Hotlines (`src/data/helplines.ts`, checked 22 Nov 2026)

| Number | Purpose | Official page |
| --- | --- | --- |
| 191 | Police emergency (TH) | thailand.go.th (essential tourist assistance numbers) |
| 1669 | Medical emergency (TH) | thailand.go.th (same page) |
| 1191 | Police anti-trafficking (TH) | Thai MFA trafficking country report (image.mfa.go.th) |
| 1300 | Social help centre, trafficking reports 24 h (TH) | thailand.go.th/event-detail/007-012 |
| 1155 | Tourist police, several languages (TH) | touristpolice.go.th |
| 1546 | Department of Labour Protection and Welfare (TH) | labour.go.th |
| 1694 | Department of Employment (TH) | prd.go.th |
| 1441 | Anti Online Scam Operation Center, phone only (TH) | mdes.go.th/AOC1441 |
| +86 10 12308 | Chinese MFA consular emergency line (Chinese citizens abroad) | th.china-embassy.gov.cn |
| +66 2 245 7010 | Chinese Embassy Bangkok, consular protection | th.china-embassy.gov.cn |
| 110 | Police, including fraud reports (CN) | gov.cn (2021 gazette) |
| 120 | Ambulance (CN) | gov.cn |
| 12333 | Human resources and social security (CN) | Shanghai HRSS document (mohrss.gov.cn blocked automated reading) |
| 12345 | Government service line 24 h (CN) | gov.cn (2021 gazette) |
| 96110 | Police anti-fraud warning line, not for reporting (CN) | sz.gov.cn |
| +66 2 572 8442 | Thai MFA consular call centre 24 h (Thai citizens) | image.mfa.go.th |

Left out because no official emergency number could be confirmed: the Thai consulates in Shanghai and Nanning. Confirmed but not
shown (kept for a later per-city view): Thai missions in Beijing, Guangzhou, Kunming, Chengdu and Xiamen; Chinese consulates in
Chiang Mai, Songkhla and Khon Kaen; 1506 and 1377 (Thailand).

## Report pack offices

No addresses are stored. Each agency is the province's own office of that agency (Thai provincial labour protection and
employment offices, police; Chinese labour inspection and police), found through a map search (Google Maps in Thailand, Amap in
China), so no invented address is ever shown.

## Middle system: identity and signing (added 22 Nov 2026, for the advisor to confirm)

Passport lines: ICAO Doc 9303 part 4 (TD3 format, check digits with weights 7-3-1). Checked on the device only; tested against
the ICAO specimen (ERIKSSON, Utopia). The sample worker (SOMCHAI JAIDEE, AC1234567) is invented, using the usual Thai placeholder name.

Working age: Thailand LPA s.44 (no one under 15) and s.45 (workers under 18); China Labour Law Art. 15 (no one under 16) and
Art. 58 (young workers 16–18). Passport validity: most visas ask for 6 months; this is a warning only, not a legal rule.

Electronic signature: Thai Electronic Transactions Act s.9; Chinese Electronic Signature Law Arts. 13–14. The signature is bound to
a SHA-256 fingerprint of the exact bilingual text, so any later change voids it. The partner law firms are samples: no real firm
is named or connected.

## End system: check-ins, review and complaints (added 22 Nov 2026)

Check-ins on the arrival day, day 7 and day 30 follow the plan's anti-trafficking advice (early checks catch people who are
held). A missed check-in, an "unsafe" answer or the worker's secret word alerts the C.A.L.L. team only; the employer never sees
the answers or the timeline. Complaints that may endanger life or freedom (forced work, violence, "unsafe", secret word) are
passed to the agency at once without the credibility check, in line with TH Anti-Trafficking Act s.6/1 and ACTIP Art. 14
(victim protection); others are scored from evidence and the case record to stop false reports. Employer reviews are stars and
fixed points with no free text, shown only as an anonymous total, to limit defamation and PDPA risk. No office addresses or
building photos are stored: offices are found by map search (Google Maps in Thailand, Amap in China); building photos and a 3D
model are roadmap items.

## Front system: anti-spam, job-seeker verification, special posts, chat (added 22 Nov 2026)

Anti-spam: casino and online-gambling work is refused (gambling is illegal in Thailand under the Gambling Act B.E. 2478 and in
mainland China under Criminal Law Art. 303) together with scam-compound wording; copies of existing posts, more than 5 new posts a
day and "easy money" lures are caught by rules; reported posts are hidden after 3 reports (unchanged, SQL 0005). Job-seeker
verification keeps only the last 4 digits of the phone and passport numbers, the nationality and the expiry (PDPA data
minimisation). Special posts use sample organisations only; paid posts say "Sponsored". Chat hides phone numbers, e-mail, links and
LINE / WeChat ids so conversations stay on the platform, where scams can be reported; AI translation of a typed message uses the
signed-in person's question allowance.

## Shared records: chat, contracts, verification, aftercare (added 23 Nov 2026, SQL `0014_shared_records.sql`)

- **Who sees what** is enforced in the database, not the website: a chat only by the job seeker and the employer of that application (not the C.A.L.L. team); a contract by both sides of the case and read-only by the team; aftercare (check-ins, secret word, complaints) by the worker and the team, never the employer; employer reviews only as an anonymous list of stars and fixed points.
- **Data minimisation (PDPA s.22–23; PIPL Art. 6):** job-seeker verification keeps only the last 4 digits of the phone and passport numbers, the nationality and the expiry date. The contract keeps the passport lines because the contract itself names the worker and the passport number (PDPA s.24(3), performance of a contract). Advisor to confirm.
- **Contact details hidden in chat** (e-mail, links, phone numbers) by the database as well as the website, so a scammer cannot move the worker to a private chat by skipping the website.
- **Signatures:** each side can add only its own signature; a signature belongs to the SHA-256 fingerprint of the exact text (Thai ETA s.9; CN Electronic Signature Law Art. 13–14, as listed above).

## Market data from outside sources (added 24 Nov 2026, `src/domain/openData.ts`, `api/market.ts`)

- Thailand, monthly, per province and per industry: job vacancies (`dataset13_08`) and job seekers (`dataset13_04`) registered with the Department of Employment, read from data.go.th's public CKAN API. Used with the source named under data.go.th's conditions of use ("Open Data Common"). The advisor should confirm the licence text; the full DGA licence document could not be opened online on 24 Nov 2026.
- Thailand and China, yearly, national: World Bank WDI (modelled ILO estimates), CC BY 4.0 — unemployment, youth unemployment, labour force, employment by sector.
- Government job boards are linked, not copied: ไทยมีงานทำ (DOE), 中国公共招聘网 (MOHRSS), 国家大学生就业服务平台.
- Totals only; no personal data is read or sent. The server reads the sources at most about once a week (Vercel cache).

## Data on one page (added 24 Nov 2026, `src/pages/dataMap.tsx`, texts `src/locales/v2g.ts`) — for the advisor to confirm

- The privacy notice (`pri.*`) did not yet mention the records shared since SQL 0014 (chat, contracts with the full passport lines, aftercare). The new table does; the numbered notice below it should be brought into line.
- Transfers: PDPA ss. 28–29 for users in Thailand; PIPL arts. 38–39 for users in China. The page says a route under art. 38 and separate consent under art. 39 must be in place before opening in China; the sign-up flow does not collect that separate consent today.
- Retention: `purge_expired()` deletes a post 182 days after release once its worker has arrived, and the case, contract, chat and complaints go with it. Whether complaints and contracts should be kept longer is an open question.
- Job-seeker verification is written by the person's own account (column grants in 0014); the team does not confirm it as it does for employers.
- 李明's demo job was changed to Chinese-speaking guest relations (24 Nov). The closed-jobs patterns do not match it, but the patterns only look for words (they miss "tour coordinator" too), so the 2020 notification itself should be checked.

## Group B and the code review (27 Nov 2026) — for the advisor

- **Business profile / work history (SQL 0019):** short fixed fields and short text, no contact details. Business details are readable by anyone signed in; work history only by employers the person applied to, the person and the team.
- **Map near an incident:** an OpenStreetMap view loads only when the person asks, because OpenStreetMap receives the coordinates. "Find near here" opens Google Maps (Thailand) or AMap (China) in the person's own browser.
- **Document photos:** checked for size, brightness and sharpness on the device only; the picture is not sent to any AI or server (the blueprint said "AI"; changed because passports and permits are sensitive and the free Gemini tier may be read by people).
- **AI triage of complaints:** team only; the AI gets fixed fields (problem type, evidence held, case/arrival, rule score), never the worker's words, and never decides.
- **Chat strikes (SQL 0017/0020):** the database decides whether a message had contact details; three in one conversation end the match. Phone numbers are recognised by their Thai/Chinese shape, so salary ranges, dates and times are not counted. Known limit: a number sent one digit per message is not caught.
- **Still open:** job-seeker verification is written by the person's own account; the sign-up flow does not collect separate consent under PIPL art. 39.

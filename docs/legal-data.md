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

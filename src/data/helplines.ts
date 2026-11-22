// Emergency and help lines for the help page (v2 model, owner Nov 2026: "the help button shows emergency numbers at once, with no
// form and no waiting"). Grouped by the country the worker is in. Every number was checked on an official page on 22 Nov 2026
// (see docs/legal-data.md); lines that could not be confirmed officially (e.g. some consulates' emergency mobiles) are left out.
export type HelpCountry = 'TH' | 'CN'
export interface Helpline {
  /** what is dialled (tel: link) */
  tel: string
  /** what is shown */
  show: string
  /** locale key of the one-line purpose (hp.line.*) */
  key: string
  /** the first, red buttons: life or freedom in danger */
  urgent?: boolean
}
export const HELPLINES: Record<HelpCountry, Helpline[]> = {
  TH: [
    { tel: '191', show: '191', key: 'hp.line.th191', urgent: true },
    { tel: '1669', show: '1669', key: 'hp.line.th1669', urgent: true },
    { tel: '1191', show: '1191', key: 'hp.line.th1191', urgent: true },
    { tel: '1300', show: '1300', key: 'hp.line.th1300', urgent: true },
    { tel: '1155', show: '1155', key: 'hp.line.th1155' },
    { tel: '1546', show: '1546', key: 'hp.line.th1546' },
    { tel: '1694', show: '1694', key: 'hp.line.th1694' },
    { tel: '1441', show: '1441', key: 'hp.line.th1441' },
    { tel: '+861012308', show: '+86 10 12308', key: 'hp.line.cn12308' },
    { tel: '+6622457010', show: '+66 2 245 7010', key: 'hp.line.cnEmbassyBkk' },
  ],
  CN: [
    { tel: '110', show: '110', key: 'hp.line.cn110', urgent: true },
    { tel: '120', show: '120', key: 'hp.line.cn120', urgent: true },
    { tel: '12333', show: '12333', key: 'hp.line.cn12333' },
    { tel: '12345', show: '12345', key: 'hp.line.cn12345' },
    { tel: '96110', show: '96110', key: 'hp.line.cn96110' },
    { tel: '+6625728442', show: '+66 2 572 8442', key: 'hp.line.thMfa' },
  ],
}

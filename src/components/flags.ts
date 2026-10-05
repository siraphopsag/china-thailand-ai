// National flags for the map's opening scene (owner, Oct 2026). From the flag-icons package (MIT licence), bundled with the site:
// emoji flags show as letters ("TH") on Windows, so pictures are used. Each file is only fetched when the scene is shown.
import type { GeoCode } from '../geo'
import th from 'flag-icons/flags/4x3/th.svg'
import cn from 'flag-icons/flags/4x3/cn.svg'
import vn from 'flag-icons/flags/4x3/vn.svg'
import mm from 'flag-icons/flags/4x3/mm.svg'
import la from 'flag-icons/flags/4x3/la.svg'
import sg from 'flag-icons/flags/4x3/sg.svg'
import kh from 'flag-icons/flags/4x3/kh.svg'
import my from 'flag-icons/flags/4x3/my.svg'
import id from 'flag-icons/flags/4x3/id.svg'
import ph from 'flag-icons/flags/4x3/ph.svg'
import bn from 'flag-icons/flags/4x3/bn.svg'
import tl from 'flag-icons/flags/4x3/tl.svg'

export const FLAGS: Record<GeoCode, string> = { TH: th, CN: cn, VN: vn, MM: mm, LA: la, SG: sg, KH: kh, MY: my, ID: id, PH: ph, BN: bn, TL: tl }

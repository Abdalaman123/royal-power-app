import type { Sop } from './types'

/** Default SOP library. Admins can edit it from Admin → IT SOP Library (stored in system_settings.sops). */
export const DEFAULT_SOPS: Sop[] = [
  {
    id: 'sop-01',
    code: 'SOP 01',
    title: 'IT Equipment Request',
    icon: 'ClipboardList',
    summary: 'How to request new or replacement IT equipment.',
    points: [
      'All IT equipment requests must be submitted through the official portal.',
      'Requests must contain accurate employee and department information.',
      'Requests require approval from the authorized IT administrator.',
      'Equipment must only be issued after proper verification.',
    ],
  },
  {
    id: 'sop-02',
    code: 'SOP 02',
    title: 'Hardware Troubleshooting',
    icon: 'Wrench',
    summary: 'First checks to perform before raising a hardware issue.',
    points: [
      'Check power connections.',
      'Verify physical cable connections.',
      'Restart the device when appropriate.',
      'Report recurring hardware issues through the portal.',
      'Do not open or repair hardware without authorization.',
    ],
  },
  {
    id: 'sop-03',
    code: 'SOP 03',
    title: 'Network & Connectivity',
    icon: 'Network',
    summary: 'Steps for diagnosing and reporting connectivity problems.',
    points: [
      'Verify LAN cable connections.',
      'Check network adapter status.',
      'Report network connectivity issues.',
      'Do not change network configurations without IT authorization.',
    ],
  },
  {
    id: 'sop-04',
    code: 'SOP 04',
    title: 'IT Asset Management',
    icon: 'PackageCheck',
    summary: 'Responsibilities for company-issued equipment.',
    points: [
      'Every issued asset must be documented.',
      'Maintain equipment allocation records.',
      'Report damaged or missing assets immediately.',
      'Return company equipment when requested.',
    ],
  },
  {
    id: 'sop-05',
    code: 'SOP 05',
    title: 'Data Security',
    icon: 'ShieldCheck',
    summary: 'Everyday habits that keep company data safe.',
    points: [
      'Never share passwords.',
      'Lock your computer when leaving your workstation.',
      'Do not install unauthorized software.',
      'Report suspicious emails and security incidents immediately.',
      'Follow company data protection policies.',
    ],
  },
  {
    id: 'sop-06',
    code: 'SOP 06',
    title: 'Printer & Peripheral Support',
    icon: 'Printer',
    summary: 'Quick checks for printers and other peripherals.',
    points: [
      'Check cables and power.',
      'Verify printer connectivity.',
      'Check paper, toner and consumables.',
      'Submit a support request if the problem persists.',
    ],
  },
]

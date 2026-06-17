// DataBridge endpoint catalog — mirrors the Bruno "databridge" collection in
// the pace-api repo. Every endpoint is a GET against the legacy "block" API and
// authenticates with the X-Token header (the same token stored under
// `pace.apiToken`). Requests run in the browser, so they originate from the
// user's (whitelisted) IP — no proxy needed.
//
// NOTE: the Bruno "Get Stats Dashboard" request is intentionally omitted here:
// it targets a different host (fieldlinq.f2ftech.nl), uses no X-Token, and is
// outside the extension's host_permissions, so it can't be fetched from here.

export const DATABRIDGE_BASE = 'https://pace-bp.xsdirect.nl/block'
export const RPHP_BASE = 'https://pace-bp.xsdirect.nl/r.php'

export type ParamKind = 'text' | 'number' | 'dateStart' | 'dateEnd'

export interface DbParam {
  name: string
  example: string
  kind: ParamKind
  required?: boolean
}

export interface DbEndpoint {
  /** Path segment after /block, e.g. 'getAppPledges'. */
  id: string
  label: string
  group: string
  params: DbParam[]
  /** True when the endpoint accepts a dateStart/dateEnd range (period guard applies). */
  hasPeriod: boolean
}

export const DATABRIDGE_ENDPOINTS: DbEndpoint[] = [
  {
    id: 'getCompanyEmployee', label: 'Company Employee', group: 'Employees', hasPeriod: false,
    params: [{ name: 'employeeId', example: '21531', kind: 'number', required: true }],
  },
  {
    id: 'getEmployeeEarningsPayment', label: 'Employee Earnings Payment', group: 'Employees', hasPeriod: true,
    params: [
      { name: 'employeeId', example: '18465', kind: 'number', required: true },
      { name: 'dateStart', example: '2025-04-07', kind: 'dateStart', required: true },
      { name: 'dateEnd', example: '2025-05-11', kind: 'dateEnd', required: true },
    ],
  },
  {
    id: 'getEmployeeQualityAssurance', label: 'Employee Quality Assurance', group: 'Employees', hasPeriod: false,
    params: [
      { name: 'employeeId', example: '18380', kind: 'number', required: true },
      { name: 'paymentPeriodId', example: '85', kind: 'number', required: true },
    ],
  },
  {
    id: 'getInvoiceWeeks', label: 'Invoice Weeks', group: 'Invoices', hasPeriod: false,
    params: [
      { name: 'clientId', example: '1', kind: 'number', required: true },
      { name: 'domainsInclude', example: 'app', kind: 'text' },
    ],
  },
  {
    id: 'getInvoicesDownload', label: 'Invoices Download', group: 'Invoices', hasPeriod: false,
    params: [{ name: 'invoiceIds', example: '13442,13445', kind: 'text', required: true }],
  },
  {
    id: 'downloadPaymentItems', label: 'Download Payment Items', group: 'Payments', hasPeriod: false,
    params: [{ name: 'paymentPeriodId', example: '90', kind: 'number', required: true }],
  },
  {
    id: 'getPaymentPeriodQualityBonus', label: 'Payment Period Quality Bonus', group: 'Payments', hasPeriod: true,
    params: [
      { name: 'dateStart', example: '2025-04-07', kind: 'dateStart', required: true },
      { name: '_limit', example: '1,1', kind: 'text' },
    ],
  },
  {
    id: 'getSelfEmployedPledgesPayment', label: 'Self Employed Pledges Payment', group: 'Payments', hasPeriod: true,
    params: [
      { name: 'employeeId', example: '18465', kind: 'number', required: true },
      { name: 'dateStart', example: '2025-04-07', kind: 'dateStart', required: true },
      { name: 'dateEnd', example: '2025-05-11', kind: 'dateEnd', required: true },
    ],
  },
  {
    id: 'getAppPledges', label: 'App Pledges', group: 'Pledges', hasPeriod: true,
    params: [
      { name: 'employeeId', example: '20396', kind: 'number', required: true },
      { name: 'dateStart', example: '2025-04-07', kind: 'dateStart', required: true },
      { name: 'dateEnd', example: '2025-05-11', kind: 'dateEnd', required: true },
    ],
  },
  {
    id: 'getInvoiceDataPledges', label: 'Invoice Data Pledges', group: 'Pledges', hasPeriod: true,
    params: [
      { name: 'jobTitleIdsExclude', example: '8,46', kind: 'text' },
      { name: 'dateStart', example: '2025-04-14', kind: 'dateStart', required: true },
      { name: 'dateEnd', example: '2025-04-20', kind: 'dateEnd', required: true },
      { name: 'clientId', example: '46', kind: 'number', required: true },
    ],
  },
  {
    id: 'getAppProjects', label: 'App Projects', group: 'Projects', hasPeriod: false,
    params: [
      { name: 'methodStreet', example: '17', kind: 'number' },
      { name: 'clientId', example: '36', kind: 'number', required: true },
    ],
  },
  {
    id: 'getProjectFormCheckboxes', label: 'Project Form Checkboxes', group: 'Projects', hasPeriod: false,
    params: [{ name: 'projectId', example: '143', kind: 'number', required: true }],
  },
  {
    id: 'getProjectMail', label: 'Project Mail', group: 'Projects', hasPeriod: false,
    params: [{ name: 'projectId', example: '143', kind: 'number', required: true }],
  },
  {
    id: 'getDataClientsCompanyReport', label: 'Data Clients Company Report', group: 'Reports', hasPeriod: true,
    params: [
      { name: 'clientId', example: '36', kind: 'number', required: true },
      { name: 'dateStart', example: '2025-06-02', kind: 'dateStart', required: true },
      { name: 'dateEnd', example: '2025-06-08', kind: 'dateEnd', required: true },
      { name: 'dataColumns', example: 'extended', kind: 'text' },
    ],
  },
  {
    id: 'getShiftSignup', label: 'Shift Signup', group: 'Shifts', hasPeriod: false,
    params: [{ name: 'shiftId', example: '81661', kind: 'number', required: true }],
  },
]

// --- Period guard -----------------------------------------------------------
// Running an export over a huge date range can hammer the legacy system, so the
// UI enforces a maximum span. The default is deliberately conservative; the
// user can raise it in the Export tab.
export const DEFAULT_MAX_PERIOD_DAYS = 31

/** Whole days between two yyyy-mm-dd dates. NaN if either is unparseable. */
export function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00`)
  const b = new Date(`${endIso}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Returns an error string if the period is invalid or exceeds `maxDays`,
 * otherwise null. Used as the single gate before any period-based request.
 */
export function validatePeriod(startIso: string, endIso: string, maxDays: number): string | null {
  if (!startIso || !endIso) return 'Kies een begin- en einddatum.'
  const span = daysBetween(startIso, endIso)
  if (Number.isNaN(span)) return 'Ongeldige datum.'
  if (span < 0) return 'Einddatum ligt vóór begindatum.'
  if (span > maxDays) {
    return `Periode is ${span} dagen — max is ${maxDays}. Verklein de periode of verhoog de max hieronder.`
  }
  return null
}

/** encodeURIComponent but keep commas — the API uses bare commas in list params. */
export function encParam(v: string): string {
  return encodeURIComponent(v).replace(/%2C/g, ',')
}

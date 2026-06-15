/**
 * Public attorney search pages for each supported state.
 * Links go to the state bar's search tool — not deep links — so workers
 * can look up the attorney by name or bar number themselves.
 * one3Seven displays these links; it does not verify bar status.
 */
export const STATE_BAR_SEARCH_URLS: Record<string, string> = {
  CA: 'https://apps.calbar.ca.gov/attorney/LicenseeSearch/QuickSearch',
  NY: 'https://iapps.courts.state.ny.us/attorney/AttorneySearch',
  TX: 'https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer',
  FL: 'https://www.floridabar.org/directories/find-mbr/',
  IL: 'https://www.iardc.org/lawyer-search/',
  PA: 'https://www.padisciplinaryboard.org/for-the-public/find-attorney',
  OH: 'https://www.supremecourt.ohio.gov/attorney-services/public/attorney-search',
  GA: 'https://www.gabar.org/MemberSearchApplication.cfm',
  NC: 'https://www.ncbar.gov/for-the-public/find-a-lawyer/',
  MI: 'https://www.michbar.org/member/attorney_directory',
};

export const STATE_LABELS: Record<string, string> = {
  CA: 'California',
  NY: 'New York',
  TX: 'Texas',
  FL: 'Florida',
  IL: 'Illinois',
  PA: 'Pennsylvania',
  OH: 'Ohio',
  GA: 'Georgia',
  NC: 'North Carolina',
  MI: 'Michigan',
};

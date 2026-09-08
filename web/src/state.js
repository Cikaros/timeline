const appState = {
  meetings: [],
  total: 0,
  calYear: new Date().getUTCFullYear(),
  calMonth: new Date().getUTCMonth(),
  firstMeetingYear: null,
  firstMeetingDate: null,
  subscriptions: [],
  accounts: [],
  maxAccounts: 2,
  currentUser: null
}

export function getState() {
  return appState
}

export function setState(updates) {
  Object.assign(appState, updates)
}

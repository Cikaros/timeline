const appState = {
  meetings: [],
  total: 0,
  calYear: new Date().getUTCFullYear(),
  calMonth: new Date().getUTCMonth(),
  firstMeetingYear: null,
  firstMeetingDate: null
}

export function getState() {
  return appState
}

export function setState(updates) {
  Object.assign(appState, updates)
}

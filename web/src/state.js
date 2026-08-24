// src/state.js

const appState = {
  meetings: [],
  total: 0,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  firstMeetingYear: null,
  firstMeetingDate: null
}

export function getState() {
  return appState
}

export function setState(updates) {
  Object.assign(appState, updates)
}

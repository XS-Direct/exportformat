/**
 * Returns true if today is Monday (day 1).
 * Used to guard weekly endpoints that run via daily Heroku Scheduler.
 */
export function isMonday(): boolean {
  return new Date().getDay() === 1
}

/**
 * Creates a standard "not Monday" response for skipped runs.
 */
export function notMondayResponse() {
  return {
    skipped: true,
    reason: 'Not Monday — weekly task only runs on Mondays.',
    day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
  }
}

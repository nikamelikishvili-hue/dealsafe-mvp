const exactEnabled = (value: string | undefined) => value === 'enabled';

// Support cases remain staged until their reviewed database migration,
// rollback proof, operator queue, and environment-specific activation gate
// have all passed. Any missing or unrecognized value fails closed.
export const supportCasesEnabled = exactEnabled(
  import.meta.env.VITE_SUPPORT_CASES_ENABLED,
);

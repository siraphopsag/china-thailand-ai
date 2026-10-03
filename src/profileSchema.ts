// Pure validation helper (no React, no DOM): stored data is checked before it is trusted.

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)


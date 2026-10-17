export function deliveryTokenCache(now?: () => number): (subject: string, login: () => Promise<string>, signal: AbortSignal) => Promise<string>

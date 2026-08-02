export function getBroadcastingAuthUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/api\/v1\/?$/, "") + "/broadcasting/auth";
}

export function getSanctumCsrfCookieUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/api\/v1\/?$/, "") + "/sanctum/csrf-cookie";
}

import "server-only";

export class MissingLogiflowServiceTokenError extends Error {
  constructor() {
    super(
      "LogiFlow RSC authentication is misconfigured: " +
        "LOGIFLOW_RSC_SERVICE_TOKEN is missing. Configure a Sanctum personal access token " +
        "for the dedicated RSC service principal before serving server components.",
    );
    this.name = "MissingLogiflowServiceTokenError";
  }
}

interface LogiflowFetchOptions extends RequestInit {
  tenant: string;
}

export async function fetchLogiflow(
  input: RequestInfo | URL,
  { tenant, ...init }: LogiflowFetchOptions,
): Promise<Response> {
  const serviceToken = process.env.LOGIFLOW_RSC_SERVICE_TOKEN?.trim();
  if (!serviceToken) {
    throw new MissingLogiflowServiceTokenError();
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${serviceToken}`);
  headers.set("X-Tenant-ID", tenant);

  return fetch(input, {
    ...init,
    headers,
  });
}
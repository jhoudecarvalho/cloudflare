import type { CfApiResponse } from "@/lib/types";

const CF_BASE = "https://api.cloudflare.com/client/v4";

export async function cfRequest<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<CfApiResponse<T>> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  return res.json() as Promise<CfApiResponse<T>>;
}

export async function cfGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${CF_BASE}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Erro GraphQL");
  }
  return json.data as T;
}

export async function fetchAllZonesServer(token: string) {
  let page = 1;
  const all: {
    id: string;
    name: string;
    status: string;
    plan?: { name: string };
    development_mode?: number;
  }[] = [];

  while (true) {
    const d = await cfRequest<typeof all>(
      token,
      `/zones?per_page=50&page=${page}`
    );
    if (!d.success) throw new Error(d.errors?.[0]?.message || "Erro ao buscar zonas");
    all.push(...(d.result as typeof all));
    if (!d.result_info || page >= d.result_info.total_pages) break;
    page++;
  }
  return all;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

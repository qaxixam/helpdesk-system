export async function fetchJson<T>(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    const response = await fetch(input, {
        ...init,
        headers,
    });

    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
}

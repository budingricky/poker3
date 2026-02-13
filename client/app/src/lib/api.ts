export async function fetchHealth(baseUrl: string): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { method: 'GET' })
    const json = (await res.json()) as any
    const message =
      typeof json?.message === 'string'
        ? json.message
        : typeof json?.data?.message === 'string'
          ? json.data.message
          : res.ok
            ? 'ok'
            : 'error'
    return { ok: res.ok && json?.success !== false, text: message }
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : String(e) }
  }
}


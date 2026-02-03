import * as Network from 'expo-network';

type DiscoverResult =
  | { ok: true; baseUrl: string }
  | { ok: false; error: string };

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const probeServer = async (baseUrl: string, timeoutMs: number): Promise<boolean> => {
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/room`;
    const res = await fetchWithTimeout(url, timeoutMs);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.success;
  } catch {
    return false;
  }
};

const getSubnetCandidates = (ip: string): string[] => {
  const parts = ip.split('.');
  if (parts.length !== 4) return [];
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
  const host = Number(parts[3]);

  const ips: number[] = [];
  for (let d = 0; d <= 60; d += 1) {
    const a = host - d;
    const b = host + d;
    if (a >= 1 && a <= 254) ips.push(a);
    if (b >= 1 && b <= 254 && b !== a) ips.push(b);
  }

  const unique = Array.from(new Set(ips));
  return unique.map(n => `${prefix}${n}`);
};

export const discoverServer = async (): Promise<DiscoverResult> => {
  const common = [
    'http://poker3.local',
    'http://poker3.local:8080',
    'http://poker3.local:80'
  ];

  for (const baseUrl of common) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await probeServer(baseUrl, 700);
    if (ok) return { ok: true, baseUrl };
  }

  let ip: string | null = null;
  try {
    ip = await Network.getIpAddressAsync();
  } catch {
    ip = null;
  }

  if (!ip || !ip.includes('.')) {
    return { ok: false, error: '无法获取局域网 IP，请手动输入服务器地址。' };
  }

  const ips = getSubnetCandidates(ip);
  const ports = [80, 8080, 3001];
  const concurrency = 10;

  for (const port of ports) {
    for (let i = 0; i < ips.length; i += concurrency) {
      const batch = ips.slice(i, i + concurrency);
      const baseUrls = batch.map(candidate => `http://${candidate}:${port}`);
      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.all(baseUrls.map(u => probeServer(u, 500)));
      const idx = results.findIndex(Boolean);
      if (idx >= 0) return { ok: true, baseUrl: baseUrls[idx] };
    }
  }

  return { ok: false, error: '未发现服务器：请确认手机与服务器在同一 Wi‑Fi，并已启动服务端。' };
};

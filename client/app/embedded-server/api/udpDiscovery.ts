import dgram from 'dgram';
import os from 'os';

const DEFAULT_DISCOVERY_PORT = 32100;
const DEFAULT_SERVER_NAME = process.env.POKER3_SERVER_NAME || os.hostname() || 'poker3';

const isPrivateIpv4 = (ip: string): boolean => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  const [a, b] = ip.split('.').map(n => Number(n));
  if ([a, b].some(n => Number.isNaN(n))) return false;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const getIpv4Candidates = (): string[] => {
  const nets = os.networkInterfaces();
  const results: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net) continue;
      if (net.family !== 'IPv4') continue;
      if (net.internal) continue;
      const addr = net.address;
      if (!addr || addr.startsWith('169.254.')) continue;
      results.push(addr);
    }
  }
  return Array.from(new Set(results));
};

const pickBestIpv4ForClient = (clientIp: string): string | null => {
  const candidates = getIpv4Candidates();
  if (!candidates.length) return null;

  const clientParts = clientIp.split('.');
  if (clientParts.length === 4) {
    const prefix24 = `${clientParts[0]}.${clientParts[1]}.${clientParts[2]}.`;
    const sameSubnet = candidates.find(ip => ip.startsWith(prefix24));
    if (sameSubnet) return sameSubnet;
  }

  const privateIp = candidates.find(isPrivateIpv4);
  return privateIp || candidates[0] || null;
};

export type UdpDiscoveryHandle = { close: () => void };

export const startUdpDiscovery = ({
  httpPort,
  protocol = 'http',
  udpPort = DEFAULT_DISCOVERY_PORT,
  enabled = process.env.DISABLE_UDP_DISCOVERY !== '1'
}: {
  httpPort: number;
  protocol?: 'http' | 'https';
  udpPort?: number;
  enabled?: boolean;
}): UdpDiscoveryHandle => {
  if (!enabled) return { close: () => {} };

  const socket = dgram.createSocket('udp4');

  socket.on('error', err => {
    try {
      console.error('[UDP] discovery error', err);
    } finally {
      try {
        socket.close();
      } catch {
      }
    }
  });

  socket.on('message', (msg, rinfo) => {
    try {
      const text = msg.toString('utf8');
      if (!text.toLowerCase().includes('poker3')) return;
      const ip = pickBestIpv4ForClient(rinfo.address) || '';
      const payload = {
        type: 'poker3_discovery_response',
        name: DEFAULT_SERVER_NAME,
        ip,
        httpPort,
        httpUrl: ip ? `${protocol}://${ip}:${httpPort}` : '',
        protocol,
        wsPath: '/ws',
        apiPrefix: '/api'
      };
      const out = Buffer.from(JSON.stringify(payload), 'utf8');
      socket.send(out, 0, out.length, rinfo.port, rinfo.address);
    } catch {
    }
  });

  socket.bind(udpPort, '0.0.0.0', () => {
    try {
      socket.setBroadcast(true);
    } catch {
    }
    console.log(`[UDP] discovery listening udp:${udpPort} httpPort=${httpPort}`);
  });

  return {
    close: () => {
      try {
        socket.close();
      } catch {
      }
    }
  };
};

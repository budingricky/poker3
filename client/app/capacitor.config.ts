import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.poker3.client',
  appName: 'Poker3',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    cleartext: true,
  },
}

export default config


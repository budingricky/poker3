import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.poker4.client',
  appName: 'Poker3',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
}

export default config


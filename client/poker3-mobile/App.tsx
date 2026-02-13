import { StatusBar } from 'expo-status-bar'
import { useMemo, useState } from 'react'
import { Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'
import { WebView } from 'react-native-webview'

export default function App() {
  const defaultWebUrl = String(process.env.EXPO_PUBLIC_WEB_URL || '').trim()
  const [webUrlInput, setWebUrlInput] = useState(defaultWebUrl || 'https://')
  const [connected, setConnected] = useState(!!defaultWebUrl)

  const normalizedUrl = useMemo(() => {
    const raw = webUrlInput.trim().replace(/\/+$/, '')
    if (!raw) return ''
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    return `https://${raw}`
  }, [webUrlInput])

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      {!connected ? (
        <View style={styles.container}>
          <Text style={styles.title}>Poker3</Text>
          <Text style={styles.desc}>输入 Web 客户端地址（你部署的 Vite 站点），例如：https://poker3.example.com</Text>
          <TextInput
            value={webUrlInput}
            onChangeText={setWebUrlInput}
            placeholder="https://poker3.example.com"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <View style={styles.row}>
            <Button title="连接" onPress={() => setConnected(true)} disabled={!normalizedUrl} />
          </View>
          <Text style={styles.hint}>在网页内再选择/输入你的游戏服务端地址（http/https）。</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: normalizedUrl }}
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          onError={() => {
            setConnected(false)
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  desc: {
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
  },
});

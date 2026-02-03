import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { discoverServer } from './lanDiscovery';

type Stage = 'searching' | 'ready' | 'web';

export default function App() {
  const [stage, setStage] = useState<Stage>('searching');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [manualUrl, setManualUrl] = useState<string>('http://poker3.local:8080');
  const [message, setMessage] = useState<string>('正在搜索局域网服务器…');

  const normalizedManualUrl = useMemo(() => manualUrl.trim().replace(/\/$/, ''), [manualUrl]);

  const startDiscovery = async () => {
    setStage('searching');
    setMessage('正在搜索局域网服务器…');
    const res = await discoverServer();
    if (res.ok) {
      setBaseUrl(res.baseUrl.replace(/\/$/, ''));
      setStage('ready');
      setMessage('已发现服务器');
      return;
    }
    setMessage(res.error);
    setStage('ready');
  };

  useEffect(() => {
    startDiscovery();
  }, []);

  const openWeb = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('地址格式错误', '请输入 http:// 或 https:// 开头的地址');
      return;
    }
    setBaseUrl(url.replace(/\/$/, ''));
    setStage('web');
  };

  if (stage === 'web' && baseUrl) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b3b22' }}>
        <StatusBar style="light" />
        <WebView
          source={{ uri: baseUrl }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b3b22' }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>Poker3</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 18 }}>
          局域网自动发现服务器并连接
        </Text>

        {stage === 'searching' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{message}</Text>
          </View>
        )}

        {stage === 'ready' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 10 }}>{message}</Text>
            {baseUrl ? (
              <TouchableOpacity
                onPress={() => openWeb(baseUrl)}
                style={{
                  backgroundColor: '#22c55e',
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginBottom: 10
                }}
              >
                <Text style={{ color: '#06250f', fontWeight: '800', fontSize: 18 }}>进入牌桌</Text>
                <Text style={{ color: '#06250f', opacity: 0.7, marginTop: 2 }}>{baseUrl}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={startDiscovery}
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderColor: 'rgba(255,255,255,0.18)',
                borderWidth: 1,
                paddingVertical: 12,
                borderRadius: 16,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>重新搜索</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ backgroundColor: 'rgba(0,0,0,0.28)', padding: 14, borderRadius: 18 }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>手动连接</Text>
          <TextInput
            value={manualUrl}
            onChangeText={setManualUrl}
            placeholder="http://poker3.local:8080"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.18)',
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 10
            }}
          />
          <TouchableOpacity
            onPress={() => openWeb(normalizedManualUrl)}
            style={{
              backgroundColor: '#60a5fa',
              paddingVertical: 12,
              borderRadius: 16,
              alignItems: 'center'
            }}
          >
            <Text style={{ color: '#081a2f', fontWeight: '800' }}>连接</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 14, fontSize: 12, lineHeight: 16 }}>
          提示：服务端 Android APP 会广播 mDNS 名称 poker3.local（端口 80/8080）。如果自动发现失败，可手动输入服务器 IP。
        </Text>
      </View>
    </SafeAreaView>
  );
}


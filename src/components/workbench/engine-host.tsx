import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ENGINE_HTML } from '@/components/workbench/engine-html';

export type HostProps = {
  onMessage: (text: string) => void;
  // Lets the engine send a request once the page is up.
  connect: (post: (text: string) => void) => void;
};

// Phone: a tiny, invisible web view.
export function EngineHost({ onMessage, connect }: HostProps) {
  const ref = useRef<WebView>(null);
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ html: ENGINE_HTML, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onLoadEnd={() =>
          connect((text) => ref.current?.injectJavaScript(`window.__run(${text});true;`))
        }
        onMessage={(event) => onMessage(event.nativeEvent.data)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 2, height: 2, left: 0, top: 0, opacity: 0 },
});

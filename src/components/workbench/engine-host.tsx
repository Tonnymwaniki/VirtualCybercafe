import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ENGINE_HTML } from '@/components/workbench/engine-html';
import { keepPdfJs, keptPdfJs } from '@/components/workbench/pdfjs-cache';

export type HostProps = {
  onMessage: (text: string) => void;
  // Lets the engine send a request once the page is up.
  connect: (post: (text: string) => void) => void;
};

// Phone: a tiny, invisible web view. It hands the page the kept copy of
// pdf.js when there is one, and keeps a copy after the first online use.
export function EngineHost({ onMessage, connect }: HostProps) {
  const ref = useRef<WebView>(null);
  const [kept, setKept] = useState<{ main: string; worker: string } | null | undefined>(undefined);

  useEffect(() => {
    keptPdfJs().then(setKept);
  }, []);

  if (kept === undefined) return null;
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ html: ENGINE_HTML, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onLoadEnd={() => {
          if (kept) ref.current?.injectJavaScript(`window.__pdfCode = ${JSON.stringify(kept)};true;`);
          connect((text) => ref.current?.injectJavaScript(`window.__run(${text});true;`));
        }}
        onMessage={(event) => {
          if (event.nativeEvent.data === '{"type":"pdfjs-from-web"}') keepPdfJs();
          else onMessage(event.nativeEvent.data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 2, height: 2, left: 0, top: 0, opacity: 0 },
});

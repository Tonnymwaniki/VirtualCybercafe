import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine } from '@/components/workbench/engine';
import { FileRow, Problem, ResultList, Toggle, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { pickFiles, type WorkFile } from '@/lib/workbench/files';
import { pageCount, parsePages, WorkbenchError } from '@/lib/workbench/pdf';

const QUALITY = {
  standard: { scale: 2, maxSide: 2000, quality: 0.85 },
  high: { scale: 3, maxSide: 3200, quality: 0.92 },
};

export default function PdfToJpgScreen() {
  const engine = useEngine();
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [pagesText, setPagesText] = useState('');
  const [quality, setQuality] = useState<keyof typeof QUALITY>('standard');
  const [pictures, setPictures] = useState<WorkFile[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = async () => {
    setProblem(null);
    try {
      const [file] = await pickFiles({ pdf: true });
      if (!file) return;
      await pageCount(file);
      setOriginal(file);
      setPictures([]);
      setPagesText('');
    } catch (error) {
      setProblem(error instanceof WorkbenchError ? error.message : 'That PDF couldn’t be opened. Try another one.');
    }
  };

  const convert = async () => {
    if (!original) return;
    const total = original.pages ?? 1;
    const pages = pagesText.trim() ? parsePages(pagesText, total) : undefined;
    if (typeof pages === 'string') {
      setProblem(pages);
      return;
    }
    setProblem(null);
    setPictures([]);
    const count = pages?.length ?? total;
    setProgress(`Page 1 of ${count}…`);
    try {
      const done: WorkFile[] = [];
      await engine.renderPdf(original, { ...QUALITY[quality], pages }, (page) => {
        done.push(page);
        setPictures([...done]);
        setProgress(done.length < count ? `Page ${done.length + 1} of ${count}…` : 'Finishing…');
      });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That PDF couldn’t be read.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen>
      <SubHeader title="PDF to JPG" />
      <Text style={ui.intro}>Turn PDF pages into pictures, for forms that only accept JPG.</Text>
      <View style={ui.row}>
        <Button label={original ? 'Choose another PDF' : 'Choose PDF'} icon="document" variant={original ? 'secondary' : 'primary'} onPress={choose} />
      </View>
      {original && (
        <>
          <FileRow file={original} />
          <Text style={ui.label}>Pages (leave empty for all)</Text>
          <TextInput value={pagesText} onChangeText={setPagesText} placeholder="e.g. 1-2, 4" style={ui.input} accessibilityLabel="Pages" />
          <Toggle
            options={[
              { value: 'standard', label: 'Standard (smaller files)' },
              { value: 'high', label: 'High quality' },
            ]}
            value={quality}
            onChange={(value) => setQuality(value as keyof typeof QUALITY)}
          />
          <View style={ui.row}>
            <Button label="Make JPGs" icon="images" onPress={convert} busy={!!progress} />
          </View>
        </>
      )}
      {progress && <Working text={progress} />}
      {problem && <Problem text={problem} />}
      {pictures.length > 0 && !progress && <ResultList files={pictures} title={`${pictures.length} picture${pictures.length === 1 ? '' : 's'} ready`} />}
    </Screen>
  );
}

import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine } from '@/components/workbench/engine';
import { checksFor, FileRow, Problem, ResultCard, SizeLimit, sizeLabel, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { formatSize, pickFiles, type WorkFile } from '@/lib/workbench/files';
import { pageCount, WorkbenchError } from '@/lib/workbench/pdf';
import { shrinkPdf, type PdfShrinkResult } from '@/lib/workbench/shrink-pdf';

export default function ShrinkPdfScreen() {
  const engine = useEngine();
  const [limitKb, setLimitKb] = useState(1024);
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [result, setResult] = useState<PdfShrinkResult | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = async () => {
    setProblem(null);
    try {
      const [file] = await pickFiles({ pdf: true });
      if (!file) return;
      await pageCount(file);
      setOriginal(file);
      setResult(null);
    } catch (error) {
      setProblem(error instanceof WorkbenchError ? error.message : 'That PDF couldn’t be opened. Try another one.');
    }
  };

  const shrink = async () => {
    if (!original) return;
    setProblem(null);
    setResult(null);
    setProgress('Starting…');
    try {
      setResult(await shrinkPdf(original, limitKb * 1024, engine, setProgress));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That PDF couldn’t be shrunk.');
    } finally {
      setProgress(null);
    }
  };

  const already = original && original.bytes.byteLength <= limitKb * 1024;

  return (
    <Screen>
      <SubHeader title="Shrink a PDF" />
      <Text style={ui.intro}>Make a PDF small enough for an upload limit. Works best on scanned documents and photos of pages.</Text>
      <SizeLimit value={limitKb} onChange={(kb) => { setLimitKb(kb); setResult(null); }} choices={[200, 500, 1024, 2048, 5120]} />
      <View style={ui.row}>
        <Button label={original ? 'Choose another PDF' : 'Choose PDF'} icon="document" variant={original ? 'secondary' : 'primary'} onPress={choose} />
      </View>
      {original && <FileRow file={original} />}
      {already && <Text style={ui.intro}>This PDF is already under {sizeLabel(limitKb)}. You can upload it as it is.</Text>}
      {original && !already && (
        <View style={ui.row}>
          <Button label={`Shrink under ${sizeLabel(limitKb)}`} icon="contract" onPress={shrink} busy={!!progress} />
        </View>
      )}
      {progress && <Working text={progress} />}
      {problem && <Problem text={problem} />}
      {result && original && (
        <ResultCard
          file={result.file}
          checks={checksFor(result.file, { maxBytes: limitKb * 1024 })}
          note={[
            `Was ${formatSize(original.bytes.byteLength)}.`,
            result.asPictures ? 'Pages are now pictures, so text can’t be selected or searched. Check that it is still easy to read.' : 'Text and quality are unchanged.',
            result.reached ? '' : `This is the smallest it can go while staying readable. Try a limit above ${sizeLabel(limitKb)}, or split it into parts.`,
          ].filter(Boolean).join(' ')}
        />
      )}
    </Screen>
  );
}

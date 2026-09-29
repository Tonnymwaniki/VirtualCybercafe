import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine } from '@/components/workbench/engine';
import { checksFor, FileRow, Problem, ResultCard, SizeLimit, sizeLabel, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { useLanguage } from '@/lib/i18n';
import { pickFiles, type WorkFile } from '@/lib/workbench/files';
import { pageCount, WorkbenchError } from '@/lib/workbench/pdf';
import { shrinkPdf, type PdfShrinkResult } from '@/lib/workbench/shrink-pdf';

export default function ShrinkPdfScreen() {
  const engine = useEngine();
  const { t } = useLanguage();
  const [limitKb, setLimitKb] = useState(1024);
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [result, setResult] = useState<PdfShrinkResult | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [targetKb, setTargetKb] = useState(1024);

  const choose = async () => {
    setProblem(null);
    try {
      const [file] = await pickFiles({ pdf: true });
      if (!file) return;
      await pageCount(file);
      setOriginal(file);
      setResult(null);
    } catch (error) {
      setProblem(error instanceof WorkbenchError ? error.message : t('wb.err.pdfOpen'));
    }
  };

  const shrink = async (kb = limitKb) => {
    if (!original) return;
    setTargetKb(kb);
    setProblem(null);
    setResult(null);
    setProgress(t('wb.starting'));
    try {
      setResult(await shrinkPdf(original, kb * 1024, engine, setProgress));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t('wb.shrinkPdf.failed'));
    } finally {
      setProgress(null);
    }
  };

  const already = original && original.bytes.byteLength <= limitKb * 1024;

  return (
    <Screen>
      <SubHeader title={t('wb.shrinkPdf.title')} />
      <Text style={ui.intro}>{t('wb.shrinkPdf.intro')}</Text>
      <SizeLimit value={limitKb} onChange={(kb) => { setLimitKb(kb); setResult(null); }} choices={[200, 500, 1024, 2048, 5120]} />
      <View style={ui.row}>
        <Button label={original ? t('wb.chooseAnotherPdf') : t('wb.choosePdf')} icon="document" variant={original ? 'secondary' : 'primary'} onPress={choose} />
      </View>
      {original && <FileRow file={original} />}
      {already && <Text style={ui.intro}>{t('wb.shrinkPdf.already', { limit: sizeLabel(limitKb) })}</Text>}
      {original && !already && (
        <View style={ui.row}>
          <Button label={t('wb.shrinkPdf.button', { limit: sizeLabel(limitKb) })} icon="contract" onPress={() => shrink()} busy={!!progress} />
        </View>
      )}
      {progress && <Working text={progress} />}
      {problem && <Problem text={problem} />}
      {result && original && (
        <ResultCard
          file={result.file}
          before={original}
          retry={{
            smaller: result.reached ? () => shrink(Math.max(50, Math.round((result.file.bytes.byteLength / 1024) * 0.7))) : undefined,
            clearer: targetKb < limitKb ? () => shrink(limitKb) : undefined,
          }}
          checks={checksFor(result.file, { maxBytes: limitKb * 1024 }, t)}
          note={[
            result.asPictures ? t('wb.shrinkPdf.asPictures') : t('wb.shrinkPdf.unchanged'),
            result.reached ? '' : t('wb.shrinkPdf.smallest', { limit: sizeLabel(limitKb) }),
          ].filter(Boolean).join(' ')}
        />
      )}
    </Screen>
  );
}

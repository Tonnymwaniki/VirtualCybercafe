import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine } from '@/components/workbench/engine';
import { FileRow, Problem, type ProblemValue, ResultList, Toggle, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { useLanguage } from '@/lib/i18n';
import { explainError } from '@/lib/workbench/explain';
import { pickFiles, type WorkFile } from '@/lib/workbench/files';
import { pageCount, parsePages } from '@/lib/workbench/pdf';

const QUALITY = {
  standard: { scale: 2, maxSide: 2000, quality: 0.85 },
  high: { scale: 3, maxSide: 3200, quality: 0.92 },
};

export default function PdfToJpgScreen() {
  const engine = useEngine();
  const { t } = useLanguage();
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [pagesText, setPagesText] = useState('');
  const [quality, setQuality] = useState<keyof typeof QUALITY>('standard');
  const [pictures, setPictures] = useState<WorkFile[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<ProblemValue | null>(null);

  const choose = async () => {
    setProblem(null);
    let file: WorkFile | undefined;
    try {
      [file] = await pickFiles({ pdf: true });
      if (!file) return;
      await pageCount(file);
      setOriginal(file);
      setPictures([]);
      setPagesText('');
    } catch (error) {
      setProblem(explainError(error, 'openPdf', t, [file]));
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
    setProgress(t('wb.pdfToJpg.pageOf', { n: 1, total: count }));
    try {
      const done: WorkFile[] = [];
      await engine.renderPdf(original, { ...QUALITY[quality], pages }, (page) => {
        done.push(page);
        setPictures([...done]);
        setProgress(done.length < count ? t('wb.pdfToJpg.pageOf', { n: done.length + 1, total: count }) : t('wb.finishing'));
      });
    } catch (error) {
      setProblem(explainError(error, 'pdfToJpg', t, [original]));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen>
      <SubHeader title={t('wb.pdfToJpg.title')} />
      <Text style={ui.intro}>{t('wb.pdfToJpg.intro')}</Text>
      <View style={ui.row}>
        <Button label={original ? t('wb.chooseAnotherPdf') : t('wb.choosePdf')} icon="document" variant={original ? 'secondary' : 'primary'} onPress={choose} />
      </View>
      {original && (
        <>
          <FileRow file={original} />
          <Text style={ui.label}>{t('wb.pdfToJpg.pagesLabel')}</Text>
          <TextInput value={pagesText} onChangeText={setPagesText} placeholder={t('wb.pdfToJpg.placeholder')} style={ui.input} accessibilityLabel={t('wb.pagesA11y')} />
          <Toggle
            options={[
              { value: 'standard', label: t('wb.pdfToJpg.standard') },
              { value: 'high', label: t('wb.pdfToJpg.high') },
            ]}
            value={quality}
            onChange={(value) => setQuality(value as keyof typeof QUALITY)}
          />
          <View style={ui.row}>
            <Button label={t('wb.pdfToJpg.make')} icon="images" onPress={convert} busy={!!progress} />
          </View>
        </>
      )}
      {progress && <Working text={progress} />}
      {problem && <Problem text={problem} onRetry={original ? convert : undefined} />}
      {pictures.length > 0 && !progress && <ResultList files={pictures} title={pictures.length === 1 ? t('wb.pdfToJpg.readyOne') : t('wb.pdfToJpg.ready', { n: pictures.length })} />}
    </Screen>
  );
}

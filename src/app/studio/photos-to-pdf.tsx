import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { checksFor, OrderList, Problem, type ProblemValue, ResultCard, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { useLanguage } from '@/lib/i18n';
import { explainError } from '@/lib/workbench/explain';
import { pickImages } from '@/lib/images';
import type { WorkFile } from '@/lib/workbench/files';
import { editImage, imageFromPicked } from '@/lib/workbench/image';
import { joinFiles } from '@/lib/workbench/pdf';

// Pages are kept at most this many pixels on the long side, so the PDF stays
// small enough to upload but sharp enough to read and print.
const PAGE_MAX_SIDE = 2000;

export default function PhotosToPdfScreen() {
  const { t } = useLanguage();
  const [pages, setPages] = useState<WorkFile[]>([]);
  const [result, setResult] = useState<WorkFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ProblemValue | null>(null);

  const add = async (source: 'camera' | 'library') => {
    setProblem(null);
    try {
      const picked = await pickImages(source, source === 'library');
      if (!picked.length) return;
      setBusy(true);
      const files = await Promise.all(
        picked.map(async (image) => editImage(await imageFromPicked(image), { maxSide: PAGE_MAX_SIDE }, 'jpg', 0.85)),
      );
      setPages((current) => [...current, ...files.map((file, i) => ({ ...file, name: `page-${current.length + i + 1}.jpg` }))]);
      setResult(null);
    } catch (error) {
      setProblem(explainError(error, 'openPhoto', t));
    } finally {
      setBusy(false);
    }
  };

  const make = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await joinFiles(pages, 'documents.pdf'));
    } catch (error) {
      setProblem(explainError(error, 'photosToPdf', t, pages));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SubHeader title={t('wb.photosToPdf.title')} />
      <Text style={ui.intro}>{t('wb.photosToPdf.intro')}</Text>
      <PickButtons onPick={add} busy={busy} libraryLabel={pages.length ? t('wb.addMore') : t('wb.addPhotos')} />
      <OrderList files={pages} onChange={(next) => { setPages(next); setResult(null); }} />
      {pages.length > 0 && (
        <View style={ui.row}>
          <Button label={pages.length === 1 ? t('wb.photosToPdf.makeOne') : t('wb.photosToPdf.make', { n: pages.length })} icon="document" onPress={make} busy={busy} />
        </View>
      )}
      {busy && <Working text={t('wb.working')} />}
      {problem && <Problem text={problem} onRetry={pages.length ? make : undefined} />}
      {result && <ResultCard file={result} checks={checksFor(result, {}, t)} />}
    </Screen>
  );
}

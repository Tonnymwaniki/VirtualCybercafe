import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { checksFor, OrderList, Problem, type ProblemValue, ResultCard, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { useLanguage } from '@/lib/i18n';
import { explainError } from '@/lib/workbench/explain';
import { pickFiles, type WorkFile } from '@/lib/workbench/files';
import { joinFiles, pageCount } from '@/lib/workbench/pdf';

export default function MergeScreen() {
  const { t } = useLanguage();
  const [files, setFiles] = useState<WorkFile[]>([]);
  const [result, setResult] = useState<WorkFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ProblemValue | null>(null);

  const add = async () => {
    setProblem(null);
    let picked: WorkFile[] = [];
    try {
      picked = await pickFiles({ pdf: true, images: true, multiple: true });
      for (const file of picked) if (file.kind === 'pdf') await pageCount(file);
      setFiles((current) => [...current, ...picked]);
      setResult(null);
    } catch (error) {
      setProblem(explainError(error, 'openPdf', t, picked));
    }
  };

  const join = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await joinFiles(files, 'joined.pdf'));
    } catch (error) {
      setProblem(explainError(error, 'merge', t, files));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SubHeader title={t('wb.merge.title')} />
      <Text style={ui.intro}>{t('wb.merge.intro')}</Text>
      <View style={ui.row}>
        <Button label={files.length ? t('wb.addMoreFiles') : t('wb.chooseFiles')} icon="add-circle" variant={files.length ? 'secondary' : 'primary'} onPress={add} />
      </View>
      <OrderList files={files} onChange={(next) => { setFiles(next); setResult(null); }} />
      {files.length > 0 && (
        <View style={ui.row}>
          <Button label={files.length === 1 ? t('wb.merge.joinOne') : t('wb.merge.join', { n: files.length })} icon="git-merge" onPress={join} busy={busy} disabled={files.length < 1} />
        </View>
      )}
      {busy && <Working text={t('wb.merge.working')} />}
      {problem && <Problem text={problem} onRetry={files.length ? join : undefined} />}
      {result && <ResultCard file={result} checks={checksFor(result, {}, t)} />}
    </Screen>
  );
}

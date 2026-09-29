import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { checksFor, OrderList, Problem, ResultCard, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { pickFiles, type WorkFile } from '@/lib/workbench/files';
import { joinFiles, pageCount, WorkbenchError } from '@/lib/workbench/pdf';

export default function MergeScreen() {
  const [files, setFiles] = useState<WorkFile[]>([]);
  const [result, setResult] = useState<WorkFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const add = async () => {
    setProblem(null);
    try {
      const picked = await pickFiles({ pdf: true, images: true, multiple: true });
      for (const file of picked) if (file.kind === 'pdf') await pageCount(file);
      setFiles((current) => [...current, ...picked]);
      setResult(null);
    } catch (error) {
      setProblem(error instanceof WorkbenchError ? error.message : 'That file couldn’t be opened. Try another one.');
    }
  };

  const join = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await joinFiles(files, 'joined.pdf'));
    } catch (error) {
      setProblem(error instanceof WorkbenchError ? error.message : 'The files couldn’t be joined. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SubHeader title="Join PDFs" />
      <Text style={ui.intro}>Add PDFs and photos, put them in order, and join them into one PDF. Photos become A4 pages.</Text>
      <View style={ui.row}>
        <Button label={files.length ? 'Add more files' : 'Choose files'} icon="add-circle" variant={files.length ? 'secondary' : 'primary'} onPress={add} />
      </View>
      <OrderList files={files} onChange={(next) => { setFiles(next); setResult(null); }} />
      {files.length > 0 && (
        <View style={ui.row}>
          <Button label={`Join ${files.length} file${files.length === 1 ? '' : 's'}`} icon="git-merge" onPress={join} busy={busy} disabled={files.length < 1} />
        </View>
      )}
      {busy && <Working text="Joining…" />}
      {problem && <Problem text={problem} />}
      {result && <ResultCard file={result} checks={checksFor(result)} />}
    </Screen>
  );
}

import { useRef, useState } from 'react';
import { Text } from 'react-native';

import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { checksFor, FileRow, Problem, ResultCard, SizeLimit, sizeLabel, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { pickImages } from '@/lib/images';
import { formatSize, type WorkFile } from '@/lib/workbench/files';
import { imageFromPicked, shrinkImage, type ShrinkResult } from '@/lib/workbench/image';

export default function ShrinkPhotoScreen() {
  const [limitKb, setLimitKb] = useState(200);
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [result, setResult] = useState<ShrinkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = useRef(0);

  const shrink = async (file: WorkFile, kb: number) => {
    const mine = ++run.current;
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      const out = await shrinkImage(file, kb * 1024);
      if (mine === run.current) setResult(out);
    } catch {
      if (mine === run.current) setProblem('That photo couldn’t be read. Try another one.');
    } finally {
      if (mine === run.current) setBusy(false);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    const [picked] = await pickImages(source);
    if (!picked) return;
    const file = await imageFromPicked(picked);
    setOriginal(file);
    shrink(file, limitKb);
  };

  const changeLimit = (kb: number) => {
    setLimitKb(kb);
    if (original) shrink(original, kb);
  };

  return (
    <Screen>
      <SubHeader title="Shrink a photo" />
      <Text style={ui.intro}>Pick the size limit the website asks for, then your photo. It keeps as much quality as fits.</Text>
      <SizeLimit value={limitKb} onChange={changeLimit} />
      <PickButtons onPick={pick} busy={busy} />
      {original && <FileRow file={original} />}
      {busy && <Working text="Shrinking…" />}
      {problem && <Problem text={problem} />}
      {result && original && (
        <ResultCard
          file={result.file}
          checks={checksFor(result.file, { maxBytes: limitKb * 1024 })}
          note={
            result.reached
              ? `Was ${formatSize(original.bytes.byteLength)}.`
              : `This is the smallest it can go while staying readable. Try a limit above ${sizeLabel(limitKb)}, or crop the photo first.`
          }
        />
      )}
    </Screen>
  );
}

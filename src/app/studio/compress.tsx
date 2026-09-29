import { useRef, useState } from 'react';
import { Text } from 'react-native';

import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { checksFor, FileRow, Problem, ResultCard, SizeLimit, sizeLabel, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { useLanguage } from '@/lib/i18n';
import { pickImages } from '@/lib/images';
import { type WorkFile } from '@/lib/workbench/files';
import { imageFromPicked, shrinkImage, type ShrinkResult } from '@/lib/workbench/image';

export default function ShrinkPhotoScreen() {
  const { t } = useLanguage();
  const [limitKb, setLimitKb] = useState(200);
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [result, setResult] = useState<ShrinkResult | null>(null);
  // What the last shrink aimed for: the limit, or less after "Try smaller".
  const [targetKb, setTargetKb] = useState(200);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = useRef(0);

  const shrink = async (file: WorkFile, kb: number) => {
    const mine = ++run.current;
    setTargetKb(kb);
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      const out = await shrinkImage(file, kb * 1024);
      if (mine === run.current) setResult(out);
    } catch {
      if (mine === run.current) setProblem(t('wb.err.photoRead'));
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
      <SubHeader title={t('wb.compress.title')} />
      <Text style={ui.intro}>{t('wb.compress.intro')}</Text>
      <SizeLimit value={limitKb} onChange={changeLimit} />
      <PickButtons onPick={pick} busy={busy} libraryLabel={t('wb.choosePhoto')} />
      {original && <FileRow file={original} />}
      {busy && <Working text={t('wb.compress.working')} />}
      {problem && <Problem text={problem} />}
      {result && original && (
        <ResultCard
          file={result.file}
          before={original}
          retry={{
            smaller: result.reached ? () => shrink(original, Math.max(20, Math.round((result.file.bytes.byteLength / 1024) * 0.7))) : undefined,
            clearer: targetKb < limitKb ? () => shrink(original, limitKb) : undefined,
          }}
          checks={checksFor(result.file, { maxBytes: limitKb * 1024 }, t)}
          note={
            result.reached
              ? undefined
              : t('wb.compress.smallest', { limit: sizeLabel(limitKb) })
          }
        />
      )}
    </Screen>
  );
}

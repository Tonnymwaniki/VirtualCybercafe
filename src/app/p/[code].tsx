import { useLocalSearchParams } from 'expo-router';

import { CyberPrint } from '@/components/print/cyber-print';

// Opened from a customer's QR code: the code is in the address.
export default function PrintCodePage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <CyberPrint initialCode={code ?? ''} />;
}

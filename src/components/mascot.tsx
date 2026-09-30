import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// The attendant robot: white with a navy visor, glowing eyes and a headset,
// waving. `full` draws the whole robot; otherwise just the head, for small
// spots like the header and chat.
export function Mascot({ size = 40, full = false }: { size?: number; full?: boolean }) {
  const viewBox = full ? '0 0 200 236' : '24 12 152 124';
  const height = full ? (size * 236) / 200 : (size * 124) / 152;
  return (
    <Svg width={size} height={height} viewBox={viewBox} accessibilityLabel="Virtual attendant">
      <Defs>
        <LinearGradient id="shell" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#DCE7F8" />
        </LinearGradient>
        <LinearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1E3A8A" />
          <Stop offset="1" stopColor="#0B1B4D" />
        </LinearGradient>
      </Defs>

      {full && (
        <G>
          <Ellipse cx="100" cy="226" rx="56" ry="8" fill="#0B1B4D" opacity={0.15} />
          {/* Left arm, resting */}
          <Ellipse cx="50" cy="170" rx="13" ry="28" fill="url(#shell)" stroke="#C9D8F0" strokeWidth={2} />
          {/* Right arm, waving */}
          <Ellipse cx="160" cy="128" rx="12" ry="28" fill="url(#shell)" stroke="#C9D8F0" strokeWidth={2} transform="rotate(35 160 128)" />
          <Circle cx="174" cy="100" r="14" fill="url(#shell)" stroke="#C9D8F0" strokeWidth={2} />
          {/* Body */}
          <Rect x="92" y="118" width="16" height="12" fill="#C9D8F0" />
          <Rect x="58" y="126" width="84" height="88" rx="38" fill="url(#shell)" stroke="#C9D8F0" strokeWidth={2} />
          <Circle cx="100" cy="164" r="15" fill="#2563EB" />
          <Circle cx="100" cy="164" r="7" fill="#38BDF8" />
        </G>
      )}

      {/* Headset */}
      <Rect x="26" y="58" width="22" height="36" rx="11" fill="#2563EB" />
      <Rect x="152" y="58" width="22" height="36" rx="11" fill="#2563EB" />
      <Path d="M36 60 C36 20 164 20 164 60" stroke="#1E3A8A" strokeWidth={6} fill="none" strokeLinecap="round" />
      {/* Head */}
      <Rect x="40" y="22" width="120" height="104" rx="50" fill="url(#shell)" stroke="#C9D8F0" strokeWidth={2} />
      {/* Visor and face */}
      <Rect x="54" y="42" width="92" height="62" rx="30" fill="url(#visor)" />
      <Rect x="76" y="58" width="15" height="22" rx="7.5" fill="#38BDF8" />
      <Rect x="109" y="58" width="15" height="22" rx="7.5" fill="#38BDF8" />
      <Path d="M86 88 Q100 99 114 88" stroke="#38BDF8" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Ellipse cx="72" cy="50" rx="10" ry="4" fill="#FFFFFF" opacity={0.25} />
      {/* Microphone */}
      <Path d="M37 92 Q42 118 70 116" stroke="#1E3A8A" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Circle cx="72" cy="116" r="5" fill="#1E3A8A" />
    </Svg>
  );
}

/**
 * Original hand-drawn SVG pose figures.
 *
 * Poses are drawn as simple stick figures from joint coordinates (see
 * lib/yoga.ts). No third-party imagery is used, so there is no licensing
 * exposure from pose art.
 */

import type { YogaPose } from "../lib/yoga";

function line(
  a: [number, number],
  b: [number, number],
  stroke: string,
  width: number,
): React.ReactNode {
  return (
    <line
      key={`${a[0]},${a[1]}-${b[0]},${b[1]}`}
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
}

export function YogaPoseFigure({ pose, className }: { pose: YogaPose; className?: string }) {
  const j = pose.joints;
  const primary = "#f0abfc";
  const secondary = "rgba(240,171,252,0.45)";

  // Spine
  const hipMid: [number, number] = [
    (j.hipL[0] + j.hipR[0]) / 2,
    (j.hipL[1] + j.hipR[1]) / 2,
  ];

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`${pose.name} figure`}>
      {/* Ground */}
      <line x1="18" y1="172" x2="182" y2="172" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="3 5" />
      {/* Head */}
      <circle cx={j.head[0]} cy={j.head[1]} r="11" fill="none" stroke={primary} strokeWidth="3.5" />
      {/* Torso */}
      {line(j.neck, hipMid, primary, 5)}
      {/* Left side (primary) */}
      {line(j.neck, j.shoulderL, primary, 4.5)}
      {line(j.shoulderL, j.elbowL, primary, 4.5)}
      {line(j.elbowL, j.handL, primary, 4.5)}
      {line(j.hipL, j.kneeL, primary, 5)}
      {line(j.kneeL, j.footL, primary, 5)}
      {line(j.hipL, hipMid, primary, 5)}
      {/* Right side (secondary, for depth) */}
      {line(j.neck, j.shoulderR, secondary, 4.5)}
      {line(j.shoulderR, j.elbowR, secondary, 4.5)}
      {line(j.elbowR, j.handR, secondary, 4.5)}
      {line(j.hipR, j.kneeR, secondary, 5)}
      {line(j.kneeR, j.footR, secondary, 5)}
      {line(j.hipR, hipMid, secondary, 5)}
    </svg>
  );
}

// Inline SVG icons (Lucide-style: 24x24 viewBox, currentColor stroke, 1.75 width).
// Replaces emoji/text glyphs used as icons — SVG scales crisply and respects
// the surrounding text color. All are decorative by default (aria-hidden);
// the calling icon-only button supplies the accessible label.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Menu</title>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Close</title>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Logout</title>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Chart</title>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  );
}

// Diamond marker used as a decorative bullet before panel titles.
export function DiamondMarker(props: IconProps) {
  return (
    <svg {...base({ width: 12, height: 12, ...props })}>
      <title>Marker</title>
      <path d="M12 2 22 12 12 22 2 12z" fill="currentColor" stroke="none" />
    </svg>
  );
}

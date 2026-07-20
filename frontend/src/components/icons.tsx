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

// Hamburger toggle for the mobile header menu.
export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Menu</title>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

// Close (X) for the open mobile header menu.
export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Đóng</title>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
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

// Alchemy cauldron (đan lô) used on the Đan Phòng header button.
export function CauldronIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Đan Phòng</title>
      <path d="M8 3c0 1.5 1 2 1 3M12 3c0 1.5 1 2 1 3" />
      <path d="M4 8h16" />
      <path d="M6 8v5a6 6 0 0 0 12 0V8" />
      <path d="M9 21h6" />
      <path d="M12 19v2" />
    </svg>
  );
}

// Admin shield used on the Quản trị menu item.
export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Quản trị</title>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
      <path d="M9.5 12l2 2 3.5-4" />
    </svg>
  );
}

// Bar-chart icon for the admin "Thống kê" (stats) tab.
export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Thống kê</title>
      <path d="M3 3v18h18" />
      <path d="M7 15v3" />
      <path d="M12 9v9" />
      <path d="M17 5v13" />
    </svg>
  );
}

// Mountain/peak icon for the admin "Cảnh giới" (realms) tab.
export function MountainIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Cảnh giới</title>
      <path d="M3 20h18L14 6l-3 6-2-3z" />
    </svg>
  );
}

// Alert/warning triangle for the "đang chịu phạt" (punished) stat.
export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Cảnh báo</title>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.5" />
    </svg>
  );
}

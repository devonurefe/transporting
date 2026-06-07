interface IconProps {
  className?: string;
}

export function IconAll({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}

// Trailer-mounted articulating boom lift ("Toe & Go")
export function IconAanhanger({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Trailer frame */}
      <rect x="1" y="14" width="12" height="2.5" rx="1"/>
      {/* Hitch arm */}
      <line x1="13" y1="15.25" x2="15.5" y2="15.25"/>
      {/* Wheels */}
      <circle cx="4" cy="18.5" r="2"/>
      <circle cx="10" cy="18.5" r="2"/>
      {/* Articulated boom arm */}
      <polyline points="9,14 11.5,7.5 20.5,4"/>
      {/* Work basket */}
      <rect x="19" y="2.5" width="4.5" height="3" rx="0.75"/>
    </svg>
  );
}

// Spider lift / rupshoogwerker with outrigger legs
export function IconSpin({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Machine body */}
      <rect x="7" y="13" width="10" height="4" rx="1.5"/>
      {/* Spider outrigger legs */}
      <line x1="8.5" y1="17" x2="2" y2="22"/>
      <line x1="15.5" y1="17" x2="22" y2="22"/>
      {/* Vertical mast */}
      <line x1="12" y1="13" x2="12" y2="5"/>
      {/* Boom jib */}
      <line x1="12" y1="5" x2="20" y2="2"/>
      {/* Work basket */}
      <rect x="18.5" y="0.5" width="4.5" height="3" rx="0.75"/>
    </svg>
  );
}

// Scissor lift 8m — wide single scissor mechanism
export function IconSchaarlift({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Platform deck + guard rail */}
      <rect x="3" y="3" width="18" height="2.5" rx="1"/>
      <line x1="6" y1="3" x2="6" y2="1.5"/>
      <line x1="18" y1="3" x2="18" y2="1.5"/>
      {/* Scissor X mechanism */}
      <line x1="6" y1="17.5" x2="18" y2="5.5"/>
      <line x1="18" y1="17.5" x2="6" y2="5.5"/>
      {/* Base frame */}
      <rect x="3" y="17.5" width="18" height="2.5" rx="1"/>
      {/* Drive wheels */}
      <circle cx="6.5" cy="22" r="1.5"/>
      <circle cx="17.5" cy="22" r="1.5"/>
    </svg>
  );
}

// Narrow scissor lift 10m — double-stacked scissors, tall
export function IconSchaarliftSmal({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Narrow platform */}
      <rect x="7" y="1.5" width="10" height="2.5" rx="1"/>
      <line x1="9" y1="1.5" x2="9" y2="0.25"/>
      <line x1="15" y1="1.5" x2="15" y2="0.25"/>
      {/* Upper scissor */}
      <line x1="8.5" y1="10.5" x2="15.5" y2="4"/>
      <line x1="15.5" y1="10.5" x2="8.5" y2="4"/>
      {/* Lower scissor */}
      <line x1="8.5" y1="18" x2="15.5" y2="10.5"/>
      <line x1="15.5" y1="18" x2="8.5" y2="10.5"/>
      {/* Base */}
      <rect x="7" y="18" width="10" height="2" rx="1"/>
      {/* Wheels */}
      <circle cx="9.5" cy="22" r="1.5"/>
      <circle cx="14.5" cy="22" r="1.5"/>
    </svg>
  );
}

// Vertical mast lift with cantilevered platform
export function IconMastlift({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Mast column */}
      <rect x="9" y="4" width="4" height="15" rx="1"/>
      {/* Cantilevered work platform */}
      <rect x="13" y="4" width="7" height="4" rx="1"/>
      {/* Guard rail on platform */}
      <line x1="14.5" y1="4" x2="14.5" y2="2.5"/>
      <line x1="19" y1="4" x2="19" y2="2.5"/>
      <line x1="14.5" y1="2.5" x2="19" y2="2.5"/>
      {/* Base */}
      <rect x="7" y="19" width="10" height="2" rx="1"/>
      <circle cx="9.5" cy="22.5" r="1.5"/>
      <circle cx="14.5" cy="22.5" r="1.5"/>
    </svg>
  );
}

// Truck-mounted ladder/furniture lift (ladderlift / verhuislift)
export function IconLadderlift({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Truck body */}
      <rect x="1" y="15" width="9" height="6" rx="1.25"/>
      {/* Cab */}
      <path d="M1 15 L1 12.5 Q1 11.5 2 11.5 L5.5 11.5 L7 15"/>
      {/* Wheels */}
      <circle cx="3" cy="22.5" r="1.5"/>
      <circle cx="8" cy="22.5" r="1.5"/>
      {/* Diagonal ladder rails */}
      <line x1="9.5" y1="18" x2="22" y2="3"/>
      <line x1="11.5" y1="20" x2="24" y2="5"/>
      {/* Rungs */}
      <line x1="12" y1="16.5" x2="13.5" y2="18.5"/>
      <line x1="15.5" y1="12.5" x2="17" y2="14.5"/>
      <line x1="19" y1="8.5" x2="20.5" y2="10.5"/>
      {/* Box at top of track */}
      <rect x="20.5" y="1" width="3.5" height="3.5" rx="0.5"/>
    </svg>
  );
}

// Ecolift — eco/manual platform, leaf motif
export function IconEcolift({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Leaf (eco) */}
      <path d="M12 2 C9 2 7 4 8 7 C9.5 9 12 8.5 12 7 C12 8.5 14.5 9 16 7 C17 4 15 2 12 2Z"/>
      {/* Leaf stem */}
      <line x1="12" y1="7" x2="12" y2="11"/>
      {/* Work platform */}
      <rect x="4" y="11" width="16" height="2.5" rx="1"/>
      {/* Guard rail */}
      <line x1="6" y1="11" x2="6" y2="9.5"/>
      <line x1="18" y1="11" x2="18" y2="9.5"/>
      <line x1="6" y1="9.5" x2="18" y2="9.5"/>
      {/* Vertical supports */}
      <line x1="7" y1="13.5" x2="7" y2="19.5"/>
      <line x1="17" y1="13.5" x2="17" y2="19.5"/>
      <line x1="7" y1="19.5" x2="17" y2="19.5"/>
      {/* Wheels */}
      <circle cx="7" cy="22" r="1.5"/>
      <circle cx="17" cy="22" r="1.5"/>
    </svg>
  );
}

// Kluspakket — bundled job packages / toolbox
export function IconKlussensets({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Toolbox body */}
      <rect x="2" y="10" width="15" height="12" rx="1.5"/>
      {/* Toolbox lid */}
      <path d="M2 10 L4.5 7 L14.5 7 L17 10"/>
      {/* Handle */}
      <path d="M7 7 L7 5 Q9.5 3 12 5 L12 7"/>
      {/* Wrench sticking out top-right */}
      <line x1="14" y1="8" x2="21.5" y2="2.5"/>
      <circle cx="22.5" cy="1.5" r="1.5"/>
      <circle cx="13.5" cy="8.5" r="1"/>
      {/* Divider line on box */}
      <line x1="9.5" y1="10" x2="9.5" y2="22" strokeWidth="1" opacity="0.4"/>
    </svg>
  );
}

import type { ReactElement } from "react";

export const categoryIconMap: Record<string, (props: IconProps) => ReactElement | null> = {
  all: IconAll,
  aanhanger: IconAanhanger,
  spin: IconSpin,
  schaarlift: IconSchaarlift,
  "schaarlift-smal": IconSchaarliftSmal,
  mastlift: IconMastlift,
  ladderlift: IconLadderlift,
  ecolift: IconEcolift,
  klussensets: IconKlussensets,
};

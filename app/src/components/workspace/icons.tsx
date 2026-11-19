import type { ReactNode } from "react";

/* Line icons on a 24px grid at 1.8 stroke, matching src/components/icons.tsx. All decorative (aria-hidden). */

type P = { className?: string };

function Svg({ className = "h-4 w-4", children, fill = "none" }: P & { children: ReactNode; fill?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" />
  </Svg>
);
export const LibraryIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="4" height="16" rx="1" />
    <rect x="10" y="4" width="4" height="16" rx="1" />
    <path d="m16.5 5.2 3.6-.9 3 15.2-3.6.8z" transform="translate(-2.2 0)" />
  </Svg>
);
export const CompassIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Svg>
);
export const PlugIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" />
  </Svg>
);
export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);
export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const XIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const ChevronUp = (p: P) => (
  <Svg {...p}>
    <path d="m6 15 6-6 6 6" />
  </Svg>
);
export const ArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const ArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const ExternalIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Svg>
);
export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Svg>
);
export const UploadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />
  </Svg>
);
export const PrintIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2" />
    <rect x="7" y="14" width="10" height="6" rx="1" />
  </Svg>
);
export const RefreshIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5L20 15.5M20 20v-4.5h-4.5" />
  </Svg>
);
export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5" />
  </Svg>
);
export const CopyIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Svg>
);
export const LockIcon = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Svg>
);
export const ClockIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const InfoIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.8v.2" />
  </Svg>
);
export const AlertIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10.3 4.6 3 18a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z" />
    <path d="M12 10v4.5M12 17.5v.2" />
  </Svg>
);
export const PanelLeftIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M9.5 4.5v15" />
  </Svg>
);
export const PanelRightIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M14.5 4.5v15" />
  </Svg>
);
export const DotsIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3} />
  </Svg>
);
export const KeyboardIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6.5" width="18" height="11" rx="2" />
    <path d="M7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17.5 10.5h.01M8 14h8" />
  </Svg>
);
export const FilterIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
);
export const MenuIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const EyeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const LayersIcon = (p: P) => (
  <Svg {...p}>
    <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
  </Svg>
);
export const FlagIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5" />
  </Svg>
);
export const MapIcon = (p: P) => (
  <Svg {...p}>
    <path d="m9 4.5-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </Svg>
);
export const SlidersIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 4v16M12 4v16M19 4v16" />
    <circle cx="5" cy="15" r="2" fill="currentColor" />
    <circle cx="12" cy="9" r="2" fill="currentColor" />
    <circle cx="19" cy="13" r="2" fill="currentColor" />
  </Svg>
);
export const GripIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={2.6} />
  </Svg>
);

/* Resource types */
export const NotesIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 12.5h6M9 16h4" />
  </Svg>
);
export const QuizIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <path d="m7.5 9 1.5 1.5L12 7.5M14 9h3M7.5 15l1.5 1.5L12 13.5M14 15h3" />
  </Svg>
);
export const ExamIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" />
    <rect x="9" y="3" width="6" height="3.5" rx="1" />
    <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </Svg>
);
export const PlanIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13.5h3M7.5 17h6" />
  </Svg>
);
export const WorksheetIcon = (p: P) => (
  <Svg {...p}>
    <path d="M13 3.5H6.5A1.5 1.5 0 0 0 5 5v14.5A1.5 1.5 0 0 0 6.5 21H12" />
    <path d="M8 8h6M8 11.5h4" />
    <path d="m14.5 19.5 5.6-5.6a1.6 1.6 0 0 0-2.3-2.3l-5.6 5.6-.7 3z" />
  </Svg>
);
export const HomeworkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 20.5V10l8-6 8 6v10.5" />
    <path d="M9 20.5v-6h6v6M8 11h8" />
  </Svg>
);
export const SlidesIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12.5" rx="1.5" />
    <path d="M12 16.5V20M8.5 20h7M7 8.5h6M7 12h4" />
  </Svg>
);
export const GraphIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 4v16h16" />
    <path d="m7 16 4-5 3 2.5L19 7" />
  </Svg>
);
export const FileIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

/* Status marks: filled shapes so state never depends on colour alone */
export const SparkIcon = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
    <path d="M12 1.8c.7 6 2.2 7.6 8.6 8.4v.4c-6.4.8-7.9 2.4-8.6 8.6h-.2c-.7-6.2-2.2-7.8-8.6-8.6v-.4c6.4-.8 7.9-2.4 8.6-8.4z" transform="translate(0 1.6)" fill="currentColor" />
  </svg>
);
export const ShieldCheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);
export const ShieldHalfIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z" />
    <path d="M12 3v18c-4-1.5-7-5.1-7-9.5V6z" fill="currentColor" stroke="none" />
  </Svg>
);
export const DashedCircleIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 3.2" />
  </Svg>
);
export const PersonCheckIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 19.5c.8-3.3 3.3-5 6.5-5 1.3 0 2.5.3 3.5.8M15 18l2 2 4-4" />
  </Svg>
);

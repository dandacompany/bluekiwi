import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
};

function createIcon(displayName: string, children: React.ReactNode) {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(
    ({ size = 24, className, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {children}
      </svg>
    ),
  );

  Icon.displayName = displayName;
  return Icon;
}

export const ArrowRight = createIcon(
  "ArrowRight",
  <>
    <path d="M5 12h14" />
    <path d="m13 5 7 7-7 7" />
  </>,
);

export const ChevronUp = createIcon("ChevronUp", <path d="m18 15-6-6-6 6" />);

export const ChevronDown = createIcon("ChevronDown", <path d="m6 9 6 6 6-6" />);

export const Plus = createIcon(
  "Plus",
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const Play = createIcon("Play", <path d="M8 5v14l11-7z" />);

export const Pause = createIcon(
  "Pause",
  <>
    <path d="M7 5h4v14H7z" />
    <path d="M13 5h4v14h-4z" />
  </>,
);

export const CheckCircle = createIcon(
  "CheckCircle",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-5" />
  </>,
);

export const CheckCircle2 = CheckCircle;

export const XCircle = createIcon(
  "XCircle",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </>,
);

export const Clock = createIcon(
  "Clock",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>,
);

export const AlertCircle = createIcon(
  "AlertCircle",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </>,
);

export const Loader2 = createIcon(
  "Loader2",
  <>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
  </>,
);

export const Trash2 = createIcon(
  "Trash2",
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 16h10l1-16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
);

export const Zap = createIcon(
  "Zap",
  <>
    <path d="M13 2 3 14h8l-1 8 10-12h-8z" />
  </>,
);

export const Repeat = createIcon(
  "Repeat",
  <>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </>,
);

export const MessageSquare = createIcon(
  "MessageSquare",
  <>
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </>,
);

export const FileText = createIcon(
  "FileText",
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h8" />
    <path d="M8 9h2" />
  </>,
);

export const FileCode = createIcon(
  "FileCode",
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 13 2 2-2 2" />
  </>,
);

export const Workflow = createIcon(
  "Workflow",
  <>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M8 6h8" />
    <path d="M18 8v8" />
    <path d="M6 8v10a4 4 0 0 0 4 4h4" />
  </>,
);

export const ListTodo = createIcon(
  "ListTodo",
  <>
    <path d="M8 6h13" />
    <path d="M8 12h13" />
    <path d="M8 18h13" />
    <path d="m3 6 1 1 2-2" />
    <path d="m3 12 1 1 2-2" />
    <path d="M4 18h.01" />
  </>,
);

export const BookOpen = createIcon(
  "BookOpen",
  <>
    <path d="M2 4h8a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2H2z" />
    <path d="M22 4h-8a2 2 0 0 0-2 2v16a2 2 0 0 1 2-2h8z" />
  </>,
);

export const KeyRound = createIcon(
  "KeyRound",
  <>
    <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
    <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
  </>,
);

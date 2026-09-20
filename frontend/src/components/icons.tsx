// frontend/src/components/icons.tsx
// Set de íconos trazados a mano (stroke 1.8, cabos redondeados) — un solo estilo
// consistente en toda la app (cliente y panel de gestión), ver docs/DESIGN_SYSTEM.md.
import React from "react";

type IconProps = { className?: string };

const base = "none";

export function IconScissors({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6.5" cy="17.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.4 8 19 18.5M19 5.5 8.3 16.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3.2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 9.8h16M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconMapPin({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path
        d="M12 21s7-6.4 7-11.5A7 7 0 1 0 5 9.5C5 14.6 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.3" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlert({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="M12 3.8 21 19H3L12 3.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.3" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconHome({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 10v8.5a1 1 0 0 0 1 1h3.2v-5.4h3.6V19.5H17a1 1 0 0 0 1-1V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <circle cx="9" cy="8.3" r="3.1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.2 19c.7-3.3 3-5 5.8-5s5.1 1.7 5.8 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M15.5 5.6c1.5.3 2.6 1.6 2.6 3.1 0 1.4-.9 2.6-2.2 3M17.4 14.3c2.2.5 3.7 2 4.2 4.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="2.9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLogout({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="M9.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M14 16l4.5-4-4.5-4M9.5 12h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconPhone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path
        d="M6 3.6h2.6l1.3 3.7-1.9 1.6a12 12 0 0 0 5.3 5.3l1.6-1.9 3.7 1.3V16a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4 4.8 2 2 0 0 1 6 3.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconImage({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m5 17.5 4.6-4.6a1.8 1.8 0 0 1 2.5 0l1 1 3-3.2a1.8 1.8 0 0 1 2.6 0l2.3 2.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBeard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path
        d="M6 8.5V11c0 4.5 2.6 8.5 6 8.5s6-4 6-8.5V8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 5.5C4.5 4 5.8 3 7.5 3h9c1.7 0 3 1 3 2.5 0 1.8-1.2 3.3-2.7 3.3-1.1 0-1.7-.8-2.3-.8s-.8 1.6-2 1.6-1.4-1.6-2-1.6-1.2.8-2.3.8C5.7 8.8 4.5 7.3 4.5 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDroplet({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path
        d="M12 3.5s6 6.7 6 11a6 6 0 1 1-12 0c0-4.3 6-11 6-11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSparkles({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path
        d="M11 3.5c.4 2.6 1 3.9 4 4.5-3 .6-3.6 1.9-4 4.5-.4-2.6-1-3.9-4-4.5 3-.6 3.6-1.9 4-4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18 13.2c.28 1.7.66 2.5 2.5 2.9-1.84.4-2.22 1.2-2.5 2.9-.28-1.7-.66-2.5-2.5-2.9 1.84-.4 2.22-1.2 2.5-2.9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCopy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <rect x="8.5" y="8.5" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9.5a2 2 0 0 0 2 2h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c.6-3.6 3.3-5.6 7-5.6s6.4 2 7 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconShare({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11.5v6.2A2.3 2.3 0 0 0 8.3 20h7.4a2.3 2.3 0 0 0 2.3-2.3v-6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconCamera({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.8a1 1 0 0 1 .8-.4h4a1 1 0 0 1 .8.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconNavigation({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <path d="M20.5 3.5 3.8 10.6l6.6 2.9 2.9 6.6 7.2-16.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconInstagram({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function IconFacebook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.4 20.4v-6.5h2.2l.4-2.6h-2.6V9.8c0-.8.4-1.3 1.4-1.3H16V6.2c-.4 0-1.1-.1-2-.1-2 0-3.3 1.2-3.3 3.3v1.9H8.5v2.6h2.2v6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const paths: Record<string, React.ReactNode> = {
  Administration: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
  "Customer Service": <><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19a3 3 0 0 1-3 3h-3" /></>,
  Design: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5-4-10-9-10Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="11" cy="7" r="1" /><circle cx="16" cy="8.5" r="1" /></>,
  Education: <><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></>,
  Engineering: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  Finance: <><path d="M3 20h18M5 20V10M10 20V10M14 20V10M19 20V10M2 10l10-6 10 6" /></>,
  Healthcare: <><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11Z" /><path d="M12 10v4M10 12h4" /></>,
  "Human Resources": <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14a4 4 0 0 1 4 4v1" /></>,
  "Information Technology": <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M9 9l-2 1.5L9 12M15 9l2 1.5-2 1.5" /></>,
  Marketing: <><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1Z" /><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" /></>,
  Sales: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  Other: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
};

export function CategoryIcon({ category, className = "h-5 w-5" }: { category: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[category] ?? paths.Other}
    </svg>
  );
}

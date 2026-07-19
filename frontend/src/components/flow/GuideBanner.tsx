import { Info } from 'lucide-react';

interface GuideBannerProps {
  children: React.ReactNode;
}

export function GuideBanner({ children }: GuideBannerProps) {
  return (
    <div className="guide-banner">
      <Info className="h-4 w-4 shrink-0 text-indigo-600" />
      <div className="text-sm leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

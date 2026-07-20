'use client';

import { Building2, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyImageProps {
  type: 'residential' | 'commercial' | 'mixed';
  name?: string;
  image?: string | null;
  className?: string;
}

const TYPE_CONFIG: Record<string, {
  gradient: string;
  iconBg: string;
  patternColor: string;
  Icon: typeof Building2;
}> = {
  residential: {
    gradient: 'from-emerald-400 to-teal-500',
    iconBg: 'bg-white/20',
    patternColor: 'rgba(255,255,255,0.07)',
    Icon: Building2,
  },
  commercial: {
    gradient: 'from-sky-400 to-blue-500',
    iconBg: 'bg-white/20',
    patternColor: 'rgba(255,255,255,0.07)',
    Icon: Building,
  },
  mixed: {
    gradient: 'from-purple-400 to-violet-500',
    iconBg: 'bg-white/20',
    patternColor: 'rgba(255,255,255,0.07)',
    Icon: Building2,
  },
};

export default function PropertyImage({ type, name, image, className }: PropertyImageProps) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.residential;
  const { Icon } = config;

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-gradient-to-br flex items-center justify-center',
        config.gradient,
        className,
      )}
    >
      {image && (
        <>
          <img src={image} alt={name || 'Property'} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        </>
      )}
      {/* Dot pattern overlay */}
      <div
        className={cn('absolute inset-0', image && 'hidden')}
        style={{
          backgroundImage: `radial-gradient(circle, ${config.patternColor} 1px, transparent 1px)`,
          backgroundSize: '16px 16px',
        }}
      />

      {/* Building icon overlay */}
      <div className={cn('relative z-10 flex flex-col items-center justify-center gap-2', image && 'hidden')}>
        <div className={cn('p-3 rounded-2xl', config.iconBg)}>
          <Icon className="h-10 w-10 text-white/80" />
        </div>
      </div>

      {/* Property name watermark at bottom */}
      {name && (
        <div className="absolute bottom-0 inset-x-0 z-10">
          <div className="bg-black/20 backdrop-blur-[2px] px-4 py-2">
            <p className="text-white/70 text-sm font-medium truncate">{name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

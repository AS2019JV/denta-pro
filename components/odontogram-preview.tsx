"use client"

import React from 'react';
import { cn } from "@/lib/utils";

interface OdontogramPreviewProps {
  data: any;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function OdontogramPreview({ data = {}, className, size = 'sm' }: OdontogramPreviewProps) {
  const ADULT_UP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const ADULT_DOWN = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  const getToothColor = (toothId: number) => {
    const tooth = data[toothId];
    if (!tooth) return 'bg-slate-100';
    
    // If it has pathology (red) prioritize it for preview
    if (tooth.status === 'planned') return 'bg-red-500';
    if (tooth.status === 'completed') return 'bg-blue-600';
    
    // Check surfaces
    const surfaces = Object.values(tooth.surfaces || {});
    if (surfaces.some((s: any) => s?.includes('red'))) return 'bg-red-400';
    if (surfaces.some((s: any) => s?.includes('blue'))) return 'bg-blue-400';
    
    return 'bg-slate-200';
  };

  const toothSizeClass = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }[size];

  return (
    <div className={cn("inline-flex flex-col gap-1 p-2 bg-white rounded-lg border shadow-sm", className)}>
      <div className="flex gap-0.5">
        {ADULT_UP.map(id => (
          <div 
            key={id} 
            className={cn(toothSizeClass, "rounded-sm transition-colors", getToothColor(id))}
            title={`Pieza ${id}`}
          />
        ))}
      </div>
      <div className="flex gap-0.5">
        {ADULT_DOWN.map(id => (
          <div 
            key={id} 
            className={cn(toothSizeClass, "rounded-sm transition-colors", getToothColor(id))}
            title={`Pieza ${id}`}
          />
        ))}
      </div>
    </div>
  );
}

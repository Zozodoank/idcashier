import React from 'react';

export const StatSkeleton = () => (
  <div className="relative overflow-hidden rounded-xl bg-card border shadow-lg">
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-lg bg-muted animate-pulse">
          <div className="w-6 h-6 bg-gray-300 rounded"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-300 rounded w-1/2 animate-pulse"></div>
        <div className="h-6 bg-gray-300 rounded w-3/4 animate-pulse"></div>
      </div>
    </div>
  </div>
);

export const TransactionSkeleton = () => (
  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
    <div className="space-y-2">
      <div className="h-4 bg-gray-300 rounded w-32 animate-pulse"></div>
      <div className="h-3 bg-gray-300 rounded w-16 animate-pulse"></div>
    </div>
    <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
  </div>
);

export const ProductSkeleton = () => (
  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
    <div className="space-y-2">
      <div className="h-4 bg-gray-300 rounded w-24 animate-pulse"></div>
      <div className="h-3 bg-gray-300 rounded w-16 animate-pulse"></div>
    </div>
    <div className="h-2 bg-gray-300 rounded-full w-16 animate-pulse"></div>
  </div>
);
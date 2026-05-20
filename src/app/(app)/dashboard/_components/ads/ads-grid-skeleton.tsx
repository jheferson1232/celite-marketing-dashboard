"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const SKELETON_COUNT = 8

export function AdsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <Card key={index} className="gap-0 overflow-hidden py-0 shadow-none">
          <Skeleton className="aspect-9/16 w-full rounded-none" />
          <CardContent className="space-y-3 px-4 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((__, metricIndex) => (
                <div
                  key={metricIndex}
                  className="flex items-center justify-between gap-3"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton";

export function AlbumCardSkeleton() {
  return (
    <div className="bg-white rounded-[20px] p-4 flex gap-4 items-center shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
      <Skeleton className="w-20 h-20 shrink-0 rounded-[14px] bg-secondary/60" />
      <div className="flex-1 min-w-0 space-y-3">
        <Skeleton className="h-5 w-[140px] bg-secondary/60 rounded-full" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-12 bg-secondary/40 rounded-full" />
          <Skeleton className="h-3.5 w-16 bg-secondary/40 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function FeedCardSkeleton() {
  return (
    <div className="bg-white rounded-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full bg-secondary/60" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[100px] bg-secondary/60 rounded-full" />
          <Skeleton className="h-3 w-[70px] bg-secondary/40 rounded-full" />
        </div>
      </div>
      <Skeleton className="aspect-square w-full rounded-none bg-secondary/50" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-4 w-[90%] bg-secondary/60 rounded-full" />
        <Skeleton className="h-4 w-[60%] bg-secondary/60 rounded-full" />
      </div>
      <div className="p-4 pt-0 flex gap-2">
        <Skeleton className="h-11 w-11 rounded-full bg-secondary/50" />
        <Skeleton className="h-11 flex-1 rounded-full bg-secondary/40" />
        <Skeleton className="h-11 w-11 rounded-full bg-secondary/50" />
      </div>
    </div>
  );
}

import PageSkeleton from '@/components/system/PageSkeleton';

export default function AppSegmentLoading() {
  return <PageSkeleton title="Loading workspace" subtitle="Fetching store metrics, stock, and cashier tools." rows={6} />;
}

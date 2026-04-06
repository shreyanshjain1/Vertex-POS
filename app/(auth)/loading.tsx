import PageSkeleton from '@/components/system/PageSkeleton';

export default function AuthSegmentLoading() {
  return <PageSkeleton title="Loading access flow" subtitle="Preparing secure sign-in and account recovery screens." rows={3} />;
}

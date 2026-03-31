import AppHeader from '@/components/layout/AppHeader';
import StaffCreateForm from '@/components/staff/StaffCreateForm';
import { requirePagePermission } from '@/lib/authz';
import { getManagedShops } from '@/lib/staff';

export default async function NewStaffPage() {
  const { userId, shopId } = await requirePagePermission('MANAGE_STAFF');
  const shops = await getManagedShops(userId);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Add staff"
        subtitle="Create a new employee account, choose the managed shop assignment, and set the initial role without touching the rest of the auth flow."
      />
      <StaffCreateForm shops={shops} defaultShopId={shopId} />
    </div>
  );
}

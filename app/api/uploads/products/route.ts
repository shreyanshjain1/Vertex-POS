import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { saveProductImageUpload } from '@/lib/product-images';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { shopId } = await requirePermission('EDIT_PRODUCTS');
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Select an image to upload.' }, { status: 400 });
    }

    const imageUrl = await saveProductImageUpload(shopId, file);

    return NextResponse.json({ imageUrl });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to upload product image.');
  }
}

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { saveProductImageFile } from '@/lib/product-images';

export async function POST(request: Request) {
  try {
    const { shopId } = await requirePermission('EDIT_PRODUCTS');
    const formData = await request.formData();
    const files = formData.getAll('files').filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: 'Add at least one image file.' }, { status: 400 });
    }

    if (files.length > 6) {
      return NextResponse.json({ error: 'Upload up to 6 images at a time.' }, { status: 400 });
    }

    const uploaded = [] as Array<{ imageUrl: string; bytes: number; contentType: string }>;
    for (const file of files) {
      const saved = await saveProductImageFile(file, shopId);
      uploaded.push(saved);
    }

    return NextResponse.json({ images: uploaded });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return apiErrorResponse(error, 'Unable to upload product image.');
  }
}

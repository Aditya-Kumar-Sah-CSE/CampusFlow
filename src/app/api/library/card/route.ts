import { NextRequest, NextResponse } from 'next/server';
import { getStudentLibraryCardData } from '@/lib/library/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get('collegeId');
    const identifier = searchParams.get('identifier') || undefined;
    const fullName = searchParams.get('name') || undefined;
    const registrationNumber = searchParams.get('regNo') || undefined;
    const branch = searchParams.get('branch') || undefined;
    const academicLevel = searchParams.get('academicLevel') || undefined;
    const email = searchParams.get('email') || undefined;

    if (!collegeId) {
      return NextResponse.json({ error: 'collegeId parameter is required.' }, { status: 400 });
    }

    const cardData = await getStudentLibraryCardData(collegeId, identifier, {
      fullName,
      registrationNumber,
      branch,
      academicLevel,
      email,
    });

    return NextResponse.json({ success: true, card: cardData });
  } catch (err: any) {
    console.error('[LIBRARY_CARD_API_ERROR]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate library card data.' },
      { status: 500 }
    );
  }
}

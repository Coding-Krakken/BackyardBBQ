import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Revalidate the menu page
    revalidatePath('/menu');
    revalidatePath('/'); // Also revalidate homepage which shows featured items
    
    return NextResponse.json({ 
      revalidated: true, 
      now: Date.now() 
    });
  } catch (err) {
    return NextResponse.json({ 
      revalidated: false, 
      message: 'Error revalidating' 
    }, { status: 500 });
  }
}

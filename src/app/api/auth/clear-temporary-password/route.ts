import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 clear-temporary-password endpoint called');

    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    console.log('📍 Authorization header present:', !!authHeader);

    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    // Initialize Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase credentials');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    console.log('📍 Initializing Supabase admin client...');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user session from the auth header
    const token = authHeader.substring(7);
    console.log('📍 Token length:', token.length);
    console.log('📍 Getting user from token...');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      console.error('❌ Failed to get user from token:', userError.message);
      console.error('Error code:', userError.code);
      return NextResponse.json({ error: `Unauthorized: ${userError.message}` }, { status: 401 });
    }

    if (!user) {
      console.error('❌ User not found in token');
      return NextResponse.json({ error: 'Unauthorized: No user in token' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.email);
    console.log('📍 Current user metadata:', user.user_metadata);

    // Clear the temporary password flag by updating user metadata
    console.log('📍 Updating user metadata to clear is_temporary_password flag...');
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          is_temporary_password: false,
        },
      }
    );

    if (updateError) {
      console.error('❌ Failed to clear temporary password flag:', updateError.message);
      return NextResponse.json(
        { error: `Failed to clear temporary password flag: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ User metadata updated:', (updateData as any)?.user?.user_metadata);
    console.log(`✅ Temporary password flag cleared for user: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Temporary password flag cleared',
      user_email: user.email,
    });
  } catch (error) {
    console.error('❌ Error in clear-temporary-password endpoint:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

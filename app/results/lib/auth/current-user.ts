import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

/*
 * Request-scoped authentication helper.
 *
 * React cache() only memoizes this during the current
 * server render. It does NOT create a persistent cache,
 * so cookies/auth information remains request-specific.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();

  if (!supabase) {
    return {
      supabase: null,
      userId: null,
      claims: null,
      profile: null,
    };
  }

  /*
   * getClaims() is preferred for server-side identity
   * verification because it can avoid an Auth-server
   * network request when the project uses asymmetric JWTs.
   */
  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return {
      supabase,
      userId: null,
      claims: null,
      profile: null,
    };
  }

  const claims = claimsData.claims;

  const userId =
    typeof claims.sub === 'string'
      ? claims.sub
      : null;

  if (!userId) {
    return {
      supabase,
      userId: null,
      claims,
      profile: null,
    };
  }

  /*
   * Keep authorization information in your own
   * profiles table rather than trusting arbitrary
   * client-side state.
   */
  const { data: profile } =
    await supabase
      .from('profiles')
      .select(
        'id,full_name,email,phone,role,is_active'
      )
      .eq('id', userId)
      .maybeSingle();

  return {
    supabase,
    userId,
    claims,
    profile,
  };
});

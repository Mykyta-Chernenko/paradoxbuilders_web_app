import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { corsHeaders } from '../_shared/cors.ts'
import { alertError } from '../_shared/utils.ts'

interface UnsubscribeRequest {
  user_id: string
  action?: 'check' | 'unsubscribe' | 'resubscribe'
}

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().slice(0, 8)
  const startTime = Date.now()

  console.log(`[${requestId}] Unsubscribe request received - Method: ${req.method}, URL: ${req.url}`)

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS preflight request - responding with OK`)
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[${requestId}] Initializing Supabase client`)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    if (req.method === 'POST') {
      const requestData: UnsubscribeRequest = await req.json()
      const { user_id, action = 'unsubscribe' } = requestData

      console.log(`[${requestId}] POST request - user_id: ${user_id}, action: ${action}`)

      if (!user_id || user_id === '[userId]') {
        console.log(`[${requestId}] Missing user_id in request - returning 400`)
        return new Response(
          JSON.stringify({ success: false, message: 'Missing user_id' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let decodedUserId = user_id
      try {
        decodedUserId = decodeURIComponent(user_id)
      } catch (_) {}
      let resolvedUserId = decodedUserId
      if (!uuidRegex.test(decodedUserId)) {
        try {
          resolvedUserId = atob(decodedUserId)
        } catch (e) {
          await alertError("unsubscribe-email", e, { context: "Invalid Base64 user_id", user_id, requestId })
          return new Response(
            JSON.stringify({ success: false, status: 'not_found' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
        if (!uuidRegex.test(resolvedUserId)) {
          await alertError("unsubscribe-email", new Error(`Decoded user_id is not a valid UUID: ${resolvedUserId}`), { context: "Invalid decoded user_id", user_id, resolvedUserId, requestId })
          return new Response(
            JSON.stringify({ success: false, status: 'not_found' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
      }

      if (action === 'check') {
        console.log(`[${requestId}] Checking subscription status for user: ${resolvedUserId}`)
        const { data, error } = await supabaseClient
          .from('user_technical_details')
          .select('email_opt_in')
          .eq('user_id', resolvedUserId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            console.log(`[${requestId}] User not found in user_technical_details: ${resolvedUserId}`)
            return new Response(
              JSON.stringify({ success: false, status: 'not_found' }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
          console.error(`[${requestId}] Database error checking subscription status:`, error)
          return new Response(
            JSON.stringify({ success: false, status: 'error' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        const status = data.email_opt_in ? 'subscribed' : 'unsubscribed'
        console.log(`[${requestId}] User ${resolvedUserId} subscription status: ${status} - Duration: ${Date.now() - startTime}ms`)
        return new Response(
          JSON.stringify({
            success: true,
            status
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (action === 'resubscribe') {
        console.log(`[${requestId}] Processing resubscribe for user: ${resolvedUserId}`)
        const { error } = await supabaseClient
          .from('user_technical_details')
          .update({ email_opt_in: true, updated_at: new Date().toISOString() })
          .eq('user_id', resolvedUserId)

        if (error) {
          console.error(`[${requestId}] Database error during resubscribe for user ${resolvedUserId}:`, error)
          return new Response(
            JSON.stringify({ success: false, message: 'Error processing resubscribe request' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        console.log(`[${requestId}] Successfully resubscribed user ${resolvedUserId} - Duration: ${Date.now() - startTime}ms`)

        return new Response(
          JSON.stringify({ success: true, message: 'Successfully resubscribed to email campaigns' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log(`[${requestId}] Processing unsubscribe for user: ${resolvedUserId}`)
      const { error } = await supabaseClient
        .from('user_technical_details')
        .update({ email_opt_in: false, updated_at: new Date().toISOString() })
        .eq('user_id', resolvedUserId)

      if (error) {
        console.error(`[${requestId}] Database error during unsubscribe for user ${resolvedUserId}:`, error)
        return new Response(
          JSON.stringify({ success: false, message: 'Error processing unsubscribe request' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log(`[${requestId}] Successfully unsubscribed user ${resolvedUserId} - Duration: ${Date.now() - startTime}ms`)

      return new Response(
        JSON.stringify({ success: true, message: 'Successfully unsubscribed from email campaigns' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[${requestId}] Method not allowed: ${req.method}`)
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error(`[${requestId}] Unsubscribe function error - Duration: ${Date.now() - startTime}ms:`, error)
    await alertError("unsubscribe-email", error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

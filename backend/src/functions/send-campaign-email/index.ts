import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { corsHeaders } from '../_shared/cors.ts'
import { alertError, notifyTelegram, escapeHtml } from '../_shared/utils.ts'
import { createCampaignEmailTemplate, createCampaignEmailText } from './email-template.ts'
import { getEmailTemplate } from './templates/index.ts'

interface CampaignRequest {
  test?: boolean
}

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().slice(0, 8)
  const startTime = Date.now()

  console.log(`[${requestId}] Campaign request received - Method: ${req.method}, URL: ${req.url}`)

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS preflight request - responding with OK`)
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[${requestId}] Initializing Supabase client`)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false
        }
      }
    )

    if (req.method === 'POST') {
      const requestData: CampaignRequest = await req.json()
      const testMode = requestData.test || false

      console.log(`[${requestId}] Processing campaign emails - testMode: ${testMode}`)

      const appUrl = Deno.env.get('APP_URL') || 'https://example.com'
      const totalLimit = testMode ? 2 : 100

      console.log(`[${requestId}] Configuration - appUrl: ${appUrl}, totalLimit: ${totalLimit}`)

      let totalSent = 0
      let totalErrors = 0

      console.log(`[${requestId}] Calling get_campaign_eligible_users RPC - limit: ${totalLimit}`)
      const rpcStartTime = Date.now()
      const { data: users, error } = await supabaseClient.rpc('get_campaign_eligible_users', {
        p_user_limit: totalLimit
      })
      console.log(`[${requestId}] RPC completed in ${Date.now() - rpcStartTime}ms`)

      if (error) {
        console.error(`[${requestId}] RPC error getting eligible users:`, error)
        await alertError("send-campaign-email", error, { context: "RPC get_campaign_eligible_users", requestId })
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error getting eligible users',
            emails_sent: 0,
            errors: 1,
            test_mode: testMode
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (!users || users.length === 0) {
        console.log(`[${requestId}] No eligible users found for campaign - duration: ${Date.now() - startTime}ms`)
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No eligible users found',
            emails_sent: 0,
            errors: 0,
            test_mode: testMode
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log(`[${requestId}] Found ${users.length} eligible users for campaign`)

      const processedUserIds = new Set<string>()
      const eligibleUsers = testMode
        ? users.slice(0, 2)
        : users

      console.log(`[${requestId}] Processing ${eligibleUsers.length} users (testMode filtered: ${testMode})`)

      for (let i = 0; i < eligibleUsers.length; i++) {
        const user = eligibleUsers[i]
        const userStartTime = Date.now()
        try {
          const userId = user.user_id
          const email = user.email
          const templateNumber = user.next_template_number
          const userName = (user.user_name || 'User').split(' ')[0]

          if (processedUserIds.has(userId)) {
            console.log(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Skipping already processed user ${userId}`)
            continue
          }

          console.log(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Processing user ${userId} (${email}) - template: ${templateNumber}`)

          const template = getEmailTemplate(templateNumber)
          if (!template) {
            console.error(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Template ${templateNumber} not found`)
            totalErrors++
            continue
          }

          const encodedUserId = btoa(userId)
          const unsubscribeUrl = `${appUrl}/unsubscribe/${encodedUserId}`
          const appFullUrl = `${appUrl}/app`

          const personalizedSubject = template.subject.replace(/\{\{name\}\}/g, userName)
          const personalizedHeadline = template.headline.replace(/\{\{name\}\}/g, userName)
          const personalizedBody = template.body.replace(/\{\{name\}\}/g, userName)
          const personalizedPreheader = template.preheader.replace(/\{\{name\}\}/g, userName)

          const htmlContent = createCampaignEmailTemplate({
            subject: personalizedSubject,
            preheader: personalizedPreheader,
            headline: personalizedHeadline,
            body: personalizedBody,
            ctaText: template.ctaText,
            ctaUrl: appFullUrl,
            unsubscribeUrl
          })

          const textContent = createCampaignEmailText({
            headline: personalizedHeadline,
            body: personalizedBody,
            ctaText: template.ctaText,
            ctaUrl: appFullUrl,
            unsubscribeUrl
          })

          console.log(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Sending email to ${email}`)
          const emailSent = await sendEmail(email, personalizedSubject, htmlContent, textContent, userId, unsubscribeUrl, requestId)
          if (emailSent) {
            console.log(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Email sent, recording in database`)
            const emailRecorded = await recordEmailSent(supabaseClient, userId, 'campaign', `template_${templateNumber}`, templateNumber, requestId)
            if (emailRecorded) {
              console.log(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Success - ${email} template #${templateNumber} - ${Date.now() - userStartTime}ms`)
              totalSent++
              processedUserIds.add(userId)
            } else {
              console.error(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Failed to record email for user ${userId}`)
              totalErrors++
            }
          } else {
            console.error(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Failed to send email to ${email}`)
            totalErrors++
          }

          await new Promise(resolve => setTimeout(resolve, 500))

        } catch (error) {
          console.error(`[${requestId}] [${i + 1}/${eligibleUsers.length}] Error processing user ${user.user_id}:`, error)
          totalErrors++
        }
      }

      const duration = Date.now() - startTime
      console.log(`[${requestId}] Campaign completed - totalSent: ${totalSent}, totalErrors: ${totalErrors}, duration: ${duration}ms`)

      if (totalErrors > 0) {
        await notifyTelegram(`⚠️ <b>send-campaign-email</b>\n\nCampaign completed with errors.\n<b>Sent:</b> ${totalSent}\n<b>Errors:</b> ${totalErrors}\n<b>Duration:</b> ${duration}ms\n<b>Request:</b> ${escapeHtml(requestId)}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Campaign completed',
          emails_sent: totalSent,
          errors: totalErrors,
          test_mode: testMode
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[${requestId}] Method not allowed: ${req.method}`)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Method not allowed'
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${requestId}] Campaign function error - duration: ${duration}ms:`, error)
    await alertError("send-campaign-email", error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function sendEmail(
  email: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  userId: string,
  unsubscribeUrl: string,
  requestId: string
): Promise<boolean> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''

    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not found in environment variables`)
      await notifyTelegram(`🚨 <b>send-campaign-email</b>\n\nRESEND_API_KEY not found.\n<b>Email:</b> ${escapeHtml(email)}\n<b>Request:</b> ${escapeHtml(requestId)}`)
      return false
    }

    console.log(`[${requestId}] Calling Resend API for ${email} - subject: "${subject}"`)

    const fromEmail = Deno.env.get('EMAIL_FROM') || 'App <noreply@example.com>'
    const retryDelays = [500, 1000]
    let lastResponse: Response | null = null

    for (let attempt = 0; attempt <= 2; attempt++) {
      const apiStartTime = Date.now()

      lastResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: subject,
          html: htmlContent,
          text: textContent,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          }
        })
      })

      const apiDuration = Date.now() - apiStartTime
      console.log(`[${requestId}] Resend API response - attempt: ${attempt + 1}, status: ${lastResponse.status}, duration: ${apiDuration}ms`)

      if (lastResponse.status === 429 && attempt < 2) {
        console.log(`[${requestId}] Rate limited (429), retrying in ${retryDelays[attempt]}ms`)
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]))
        continue
      }

      break
    }

    if (lastResponse!.ok) {
      const result = await lastResponse!.json()
      console.log(`[${requestId}] Email sent successfully to ${email} - id: ${result.id}`)
      return true
    } else {
      const errorText = await lastResponse!.text()
      console.error(`[${requestId}] Resend API error for ${email} - status: ${lastResponse!.status}, error: ${errorText}`)
      await notifyTelegram(`🚨 <b>send-campaign-email</b>\n\nResend API error.\n<b>Email:</b> ${escapeHtml(email)}\n<b>Status:</b> ${lastResponse!.status}\n<b>Error:</b> ${escapeHtml(errorText.substring(0, 200))}\n<b>Request:</b> ${escapeHtml(requestId)}`)
      return false
    }
  } catch (error) {
    console.error(`[${requestId}] Exception sending email to ${email}:`, error)
    await alertError("send-campaign-email", error, { context: "sendEmail", email, requestId })
    return false
  }
}

async function recordEmailSent(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  emailType: string,
  emailSubtype: string,
  templateNumber: number,
  requestId: string
): Promise<boolean> {
  try {
    console.log(`[${requestId}] Recording email in database - userId: ${userId}, type: ${emailType}, subtype: ${emailSubtype}, template: ${templateNumber}`)
    const dbStartTime = Date.now()

    const { error } = await supabaseClient
      .from('email_campaigns')
      .insert({
        user_id: userId,
        email_type: emailType,
        email_subtype: emailSubtype,
        template_number: templateNumber
      })

    const dbDuration = Date.now() - dbStartTime

    if (error) {
      console.error(`[${requestId}] Database error recording email for user ${userId} - duration: ${dbDuration}ms:`, error)
      return false
    }

    console.log(`[${requestId}] Email recorded successfully for user ${userId} - duration: ${dbDuration}ms`)
    return true
  } catch (error) {
    console.error(`[${requestId}] Exception recording email for user ${userId}:`, error)
    return false
  }
}

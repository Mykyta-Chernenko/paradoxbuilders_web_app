export function createCampaignEmailTemplate(params: {
  subject: string;
  preheader: string;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  unsubscribeUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${params.subject}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    a { text-decoration: none; }
  </style>
</head>
<body style="background-color: #f9fafb; margin: 0; padding: 0;">
  <span style="display: none; font-size: 1px; color: #f9fafb; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    ${params.preheader}
  </span>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb;">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center;">
              <!-- TODO: Replace with your app logo and name -->
              <span style="color: #111827; font-size: 20px; font-weight: 700;">Your App Name</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <h1 style="margin: 0 0 24px 0; color: #111827; font-size: 26px; font-weight: 700; text-align: center; line-height: 1.3;">
                ${params.headline}
              </h1>
              <div style="color: #4b5563; font-size: 16px; line-height: 1.7;">
                ${params.body}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 40px 40px; text-align: center;">
              <a href="${params.ctaUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                ${params.ctaText}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f3f4f6; border-radius: 0 0 16px 16px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5; text-align: center;">
                You're receiving this email because you signed up for our service.<br>
                <a href="${params.unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> from these emails.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function createCampaignEmailText(params: {
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  unsubscribeUrl: string;
}): string {
  const plainTextBody = params.body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<strong[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<em[^>]*>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return `${params.headline}

${plainTextBody}

${params.ctaText}: ${params.ctaUrl}

---

You're receiving this email because you signed up for our service.
Unsubscribe from these emails: ${params.unsubscribeUrl}`;
}

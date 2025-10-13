interface EmailOptions {
  to: string
  subject: string
  html: string
}

class EmailService {
  private transporter: any

  constructor() {
    // Initialize transporter lazily to avoid build-time issues
  }

  private async getTransporter() {
    if (!this.transporter) {
      const nodemailer = await import('nodemailer')
      this.transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    }
    return this.transporter
  }

  async sendEmail({ to, subject, html }: EmailOptions) {
    try {
      const transporter = await this.getTransporter()
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
      })
      
      console.log('Email sent:', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('Email sending failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  generateVerificationEmailHtml(name: string, verificationUrl: string) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8fafc;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              background: linear-gradient(135deg, #8b5cf6, #3b82f6);
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              display: inline-block;
              font-weight: bold;
              font-size: 18px;
            }
            .title {
              color: #1f2937;
              font-size: 24px;
              margin: 20px 0;
            }
            .content {
              color: #4b5563;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #8b5cf6, #3b82f6);
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              margin: 20px 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
            }
            .warning {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 6px;
              padding: 12px;
              margin: 20px 0;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Flow Schema Designer</div>
              <h1 class="title">Verify Your Email Address</h1>
            </div>
            
            <div class="content">
              <p>Hi ${name || 'there'},</p>
              
              <p>Thank you for signing up for Flow Schema Designer! To complete your registration and access all features, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <div class="warning">
                <strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification email.
              </div>
              
              <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #f3f4f6; padding: 8px; border-radius: 4px; font-family: monospace;">
                ${verificationUrl}
              </p>
              
              <p>If you didn't create an account with us, please ignore this email.</p>
            </div>
            
            <div class="footer">
              <p>This email was sent by Flow Schema Designer</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  generateResendVerificationEmailHtml(name: string, verificationUrl: string) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Resend Verification Email</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8fafc;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              background: linear-gradient(135deg, #8b5cf6, #3b82f6);
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              display: inline-block;
              font-weight: bold;
              font-size: 18px;
            }
            .title {
              color: #1f2937;
              font-size: 24px;
              margin: 20px 0;
            }
            .content {
              color: #4b5563;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #8b5cf6, #3b82f6);
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              margin: 20px 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Flow Schema Designer</div>
              <h1 class="title">New Verification Email</h1>
            </div>
            
            <div class="content">
              <p>Hi ${name || 'there'},</p>
              
              <p>You requested a new verification email. Here's your verification link:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #f3f4f6; padding: 8px; border-radius: 4px; font-family: monospace;">
                ${verificationUrl}
              </p>
              
              <p>This link will expire in 24 hours.</p>
            </div>
            
            <div class="footer">
              <p>This email was sent by Flow Schema Designer</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
}

export const emailService = new EmailService()

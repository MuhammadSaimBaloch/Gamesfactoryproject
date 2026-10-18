export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ENVIRONMENT: string;
  SITE_URL: string;
  DEMO_MODE?: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  LOCAL_ADMIN_EMAIL?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  DIGITAL_DELIVERY_KEY?: string;
}

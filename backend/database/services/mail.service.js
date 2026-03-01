import nodemailer from 'nodemailer';

// ─── In-memory OTP store (email → { otp, expiresAt }) ───
const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create reusable transporter from env vars
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generate an OTP, store it, and email it to the user.
 * Returns the OTP (useful for testing) or throws on failure.
 */
export async function sendOTP(email) {
  const otp = generateOTP();

  // Store with expiry and attempt counter
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });

  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'Sajha Karobar'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset OTP',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #166534; margin-bottom: 8px;">Password Reset</h2>
        <p style="color: #374151;">Your OTP code is:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f0fdf4; border-radius: 8px; color: #15803d; margin: 16px 0;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return otp;
}

/**
 * Verify an OTP for a given email.
 * Returns { valid: true } or { valid: false, code, message }.
 */
export function verifyOTP(email, otp) {
  const key = email.toLowerCase();
  const entry = otpStore.get(key);

  if (!entry) {
    return { valid: false, code: 'INVALID_OTP', message: 'Invalid OTP code. Please request a new one.' };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return { valid: false, code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' };
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { valid: false, code: 'TOO_MANY_ATTEMPTS', message: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (entry.otp !== otp) {
    return { valid: false, code: 'INVALID_OTP', message: 'Invalid OTP code. Please check and try again.' };
  }

  // OTP is valid — consume it so it can't be reused
  otpStore.delete(key);
  return { valid: true };
}
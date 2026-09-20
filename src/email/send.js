import nodemailer from 'nodemailer';

export async function sendEmail({ subject, html }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.EMAIL_TO;

  if (!user || !pass || !to) {
    throw new Error(
      'Missing email config: GMAIL_USER, GMAIL_APP_PASSWORD, and EMAIL_TO must all be set.'
    );
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transport.sendMail({ from: user, to, subject, html });
}

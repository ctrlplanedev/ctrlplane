import nodemailer from "nodemailer";
import { env } from "./env";
export const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});
export const sendEmail = (payload) => {
    return transporter.sendMail({ from: env.SMTP_FROM, ...payload });
};

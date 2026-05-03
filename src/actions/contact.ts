"use server";

import db from "@/lib/db";
import { Resend } from "resend";
import { getOwnerEmail, shouldSendOwnerCopy } from "@/lib/emails/owner-inbox";
import { buildContactConfirmationEmailHtml } from "@/lib/emails/templates";

type ContactFormData = {
  firstName: string;
  lastName: string;
  email: string;
  vnnumber: string;
  message: string;
};

const resend = new Resend(process.env.RESEND_API_KEY);

export async function handleContactForm(data: ContactFormData) {
  try {
    const { firstName, lastName, email, vnnumber, message } = data;

    const contact = await db.contact.create({
      data: { firstName, lastName, email, vnnumber, message },
    });

    const from =
      process.env.RESEND_EMAIL ||
      "Car Inspection <noreply@truekinspection.com>";

    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: "We've received your message - TrueK",
          html: buildContactConfirmationEmailHtml({
            firstName,
            lastName,
            email,
            vnnumber,
            message,
          }),
        });
      } catch (emailErr) {
        console.error("[handleContactForm] user confirmation email failed", emailErr);
      }

      const owner = getOwnerEmail();
      if (owner && shouldSendOwnerCopy(email)) {
        try {
          await resend.emails.send({
            from,
            to: owner,
            subject: `[TrueK] New contact — ${email}`,
            html: buildContactConfirmationEmailHtml({
              firstName,
              lastName,
              email,
              vnnumber,
              message,
              forOwner: true,
            }),
          });
        } catch (adminErr) {
          console.error(
            "[handleContactForm] owner notification email failed",
            adminErr,
          );
        }
      }
    }

    return { success: true, data: contact };
  } catch (error) {
    console.error("[handleContactForm]", error);
    return { success: false, error: "Internal Server Error" };
  }
}

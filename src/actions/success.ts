"use server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPaymentSuccessEmails(data: { 
  email: string, 
  name: string, 
  vin: string, 
  orderId: string,
  amount: string 
}) {
  try {
    const displayName = data.name && data.name !== "Customer" ? data.name : "Valued Customer";

    // 📧 EMAIL 3: To Admin
    await resend.emails.send({
      from: process.env.RESEND_EMAIL || "TrueK System <noreply@truekinspection.com>",
      to: process.env.OWNER_EMAIL || "Truekinspection@gmail.com",
      subject: `💰 New Order: ${data.vin}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="background-color: #d32f2f; color: #fff; padding: 15px; text-align: center; margin: 0;">✔️ Payment Successful - TrueK</h2>
          <div style="padding: 20px; background-color: #ffffff;">
            <p>Hello TrueK Owner, a new payment has been received:</p>
            <table style="width: 100%; border-collapse: collapse; background-color: #f8f9fa;">
              <tr><td style="padding: 10px; background-color: #d32f2f; color: #fff; font-weight: bold; width: 30%;">Name:</td><td style="padding: 10px;">${displayName}</td></tr>
              <tr><td style="padding: 10px; background-color: #d32f2f; color: #fff; font-weight: bold;">Email:</td><td style="padding: 10px;">${data.email}</td></tr>
              <tr><td style="padding: 10px; background-color: #d32f2f; color: #fff; font-weight: bold;">VIN:</td><td style="padding: 10px;">${data.vin}</td></tr>
              <tr><td style="padding: 10px; background-color: #d32f2f; color: #fff; font-weight: bold;">Order ID:</td><td style="padding: 10px;">${data.orderId}</td></tr>
              <tr><td style="padding: 10px; background-color: #d32f2f; color: #fff; font-weight: bold;">Amount:</td><td style="padding: 10px;">$${data.amount}</td></tr>
            </table>
          </div>
        </div>`,
    });

    // 📧 EMAIL 4: To User
   await resend.emails.send({
  from: process.env.RESEND_EMAIL || "Truek Inspection <noreply@Truekinspection.com>",
  to: data.email,
  subject: "Payment Successful - Truek",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #00a8e8; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
      <h2 style="background-color: #00a8e8; color: #ffffff; padding: 20px; text-align: center; margin: 0; border-top-left-radius: 8px; border-top-right-radius: 8px;">
        Payment Successful - Truek
      </h2>
      <div style="padding: 20px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #555;">
          Hello ${displayName},<br><br>
          We have received your request to retrieve your TruekInspection Report. Below are your request details:
        </p>
        <table style="width: 100%; border-collapse: collapse; background-color: #f0faff; color: #333; border-radius: 5px; overflow: hidden;">
          <tr>
            <td style="padding: 12px; background-color: #00a8e8; font-weight: bold; color: #ffffff; width: 30%;">Name:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e1f5fe;">${displayName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background-color: #00a8e8; font-weight: bold; color: #ffffff;">Email:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e1f5fe;">${data.email}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background-color: #00a8e8; font-weight: bold; color: #ffffff;">VIN Number:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e1f5fe;">${data.vin || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background-color: #00a8e8; font-weight: bold; color: #ffffff;">Order ID:</td>
            <td style="padding: 12px;">${data.orderId}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 16px; color: #555;">
          Our team will process your request and email you the <strong>inspection report</strong> within just 6 working hours. If you need any further assistance, feel free to reach out.
        </p>
        <p style="font-size: 16px; color: #555;">
          For urgent inquiries, contact us at <a href="mailto:truekinspection.com" style="color: #00a8e8; text-decoration: none; font-weight: bold;">truekinspection.com</a>.
        </p>
      </div>
      <footer style="background-color: #00a8e8; padding: 15px; text-align: center; font-size: 12px; color: #ffffff; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
        <strong>Truek Car Inspection</strong> | Ensuring Quality, One Car at a Time
      </footer>
    </div>`,
});

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
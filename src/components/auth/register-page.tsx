import { AuthEditorial } from "./auth-editorial";
import { RegisterExperience } from "./register-experience";
import { createResendDelivery } from "@/features/auth/resend";

export function RegisterPage() {
  const deliveryAvailable = Boolean(createResendDelivery({ RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM }));
  return <RegisterExperience deliveryAvailable={deliveryAvailable} editorial={<AuthEditorial/>}/>;
}


import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";
import { LoginForm } from "@/src/components/auth/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <LoginForm />;
}

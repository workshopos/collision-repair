import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";
import { SignupForm } from "@/src/components/auth/signup-form";

export default async function SignupPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <SignupForm />;
}

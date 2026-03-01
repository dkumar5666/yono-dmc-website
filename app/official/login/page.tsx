import { redirect } from "next/navigation";

export const metadata = {
  title: "Official Login",
};

export default function LegacyOfficialLoginRedirect() {
  redirect("/official-login");
}

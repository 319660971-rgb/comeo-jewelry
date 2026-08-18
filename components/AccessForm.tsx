"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

export function AccessForm({ destination }: { destination: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), company: form.get("company"), country: form.get("country"), whatsapp: form.get("whatsapp"), email: form.get("email"), consent: form.get("consent") === "on", sourcePath: destination };
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Unable to unlock the catalog."); setLoading(false); return; }
    window.localStorage.setItem("hello-jewelry-contact", JSON.stringify(payload));
    router.push(destination.startsWith("/") ? destination : "/catalog"); router.refresh();
  }
  return <form onSubmit={submit} className="access-form">
    <div className="form-grid"><label><span>Your name</span><input name="name" required autoComplete="name" /></label><label><span>Company / store</span><input name="company" required autoComplete="organization" /></label><label><span>Country / region</span><input name="country" required autoComplete="country-name" /></label><label><span>WhatsApp number</span><input name="whatsapp" required inputMode="tel" placeholder="+1 555 000 0000" autoComplete="tel" /></label><label className="full"><span>Email <small>Optional</small></span><input name="email" type="email" autoComplete="email" /></label></div>
    <label className="consent"><input name="consent" type="checkbox" required /><span><Check size={14} />I agree that Hello Jewelry may contact me about wholesale products and quotes.</span></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button button-accent form-submit" disabled={loading}>{loading ? "Unlocking…" : "Enter wholesale catalog"}<ArrowRight /></button>
    <p className="form-footnote">No password or account is required. Access stays unlocked on this device for 30 days.</p>
  </form>;
}

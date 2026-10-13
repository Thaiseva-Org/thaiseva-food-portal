import { Link } from "react-router";

export default function PartnerPrivacyNotice() {
  return <aside className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700" aria-label="Partner privacy notice">
    ThaiSeva uses your contact, business, identity and payment details to review your application, manage the partnership and arrange settlements. Public listing details are published; verification documents are restricted to authorized reviewers. Provide only the requested information and redact unrelated details from documents. <Link className="font-semibold underline" to="/privacy" target="_blank" rel="noopener noreferrer">Read the Food and Partner Privacy Notice</Link> or contact <a className="underline" href="mailto:support@thaiseva.com">support@thaiseva.com</a>.
  </aside>;
}

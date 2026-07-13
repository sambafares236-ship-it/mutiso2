import { useNavigate } from 'react-router-dom';
import { HardHat, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="caution-stripe w-full fixed top-0 left-0" />
      <div className="w-full max-w-2xl mx-auto space-y-6 mt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl text-primary">MUTISO.AI — Privacy Policy</h1>
        </div>

        <p className="text-xs text-muted-foreground">
          Draft — last updated 2026-07-13. This is a plain-language draft, not a substitute for legal review. It has
          not been reviewed by a lawyer, and [COMPANY NAME]'s registration with Kenya's Office of the Data Protection
          Commissioner (ODPC) is [ODPC REGISTRATION — PENDING].
        </p>

        <div className="card-industrial p-5 space-y-5 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-lg text-foreground mb-1">1. Data controller</h2>
            <p>
              [COMPANY NAME], registered at [REGISTERED ADDRESS], is the data controller for personal data processed
              through Mutiso.AI. Contact for data protection queries: [CONTACT EMAIL].
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">2. What we collect</h2>
            <p>
              Account details (name, email, phone number, role); site data you or your team submit (worker
              attendance, materials, safety/incident records, financial and scheduling data, photos); and technical
              data needed to operate the Service (login timestamps, device/browser information).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">3. Why we process it</h2>
            <p>
              To provide the Service you've signed up for (lawful basis: performance of a contract), to send
              safety-related alerts and subscription notices (legitimate interest / contractual necessity), and to
              process M-Pesa payments (contractual necessity). We do not sell personal data.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">4. Who we share it with</h2>
            <p>
              Sub-processors that help us run the Service: Supabase (database, authentication, file storage —
              hosted in the EU), Safaricom M-Pesa (payment processing), Twilio and Resend (WhatsApp/email delivery),
              and our workflow-automation provider for alerts and the WhatsApp assistant. We do not share your data
              with third parties for their own marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">5. International transfer</h2>
            <p>
              Our database infrastructure is hosted in the EU (Ireland). Where personal data of Kenyan data subjects
              is transferred outside Kenya, we rely on contractual safeguards with our infrastructure providers
              consistent with the Data Protection Act, 2019.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">6. Retention</h2>
            <p>
              We retain site operational data for as long as the site's account is active, plus a reasonable period
              afterward for legal, safety-record, and dispute-resolution purposes. You can request deletion of your
              account data subject to any records we're legally required to retain (e.g. incident/safety logs).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">7. Your rights</h2>
            <p>
              Under Kenya's Data Protection Act, 2019, you have the right to access, correct, delete, or object to
              processing of your personal data, and to lodge a complaint with the ODPC. Contact [CONTACT EMAIL] to
              exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">8. Security</h2>
            <p>
              Access to site data is restricted by role (Super Admin / Contractor / Admin / Foreman) and enforced at
              the database level via row-level security, so a user can only see data for sites they own or are
              assigned to.
            </p>
          </section>
        </div>

        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    </div>
  );
}

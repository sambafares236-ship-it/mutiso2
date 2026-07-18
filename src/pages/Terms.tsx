import { useNavigate } from 'react-router-dom';
import { HardHat, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="caution-stripe w-full fixed top-0 left-0" />
      <div className="w-full max-w-2xl mx-auto space-y-6 mt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl text-primary">MUTISO.AI — Terms of Service</h1>
        </div>

        <div className="card-industrial p-5 space-y-5 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-lg text-foreground mb-1">1. Who this agreement is between</h2>
            <p>
              These Terms govern use of the Mutiso.AI construction-site management application ("the Service"),
              provided by Jenga Technologies, a company registered in Kenya at Nairobi ("we", "us"). By
              creating an account you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">2. What the Service does</h2>
            <p>
              Mutiso.AI helps contractors and their teams manage construction sites: attendance, materials, safety
              and compliance records, quality/progress tracking, financial administration, asset tracking, and
              related reporting, including automated WhatsApp/email alerts and a conversational site-status bot.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">3. Accounts and roles</h2>
            <p>
              You are responsible for the accuracy of information you submit and for keeping your login credentials
              confidential. Contractor/Admin accounts are responsible for the foremen they invite to their sites and
              for approving those foremen's access.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">4. Subscriptions and payment</h2>
            <p>
              Site subscriptions are billed monthly via M-Pesa. A subscription grants access to a single site for
              the paid period; access may be suspended if a subscription lapses. Fees are not refundable except
              where required by Kenyan law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">5. Data you submit</h2>
            <p>
              You retain ownership of the site, worker, financial, and operational data you submit. You grant us a
              licence to process it solely to provide the Service, as described in our{' '}
              <a href="/privacy" className="text-primary underline">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">6. Acceptable use</h2>
            <p>
              You agree not to use the Service to store or transmit unlawful content, to misrepresent safety or
              compliance records, or to attempt to circumvent access controls between sites or roles.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">7. Availability and liability</h2>
            <p>
              The Service is provided "as is." While we take reasonable steps to keep it available and your data
              safe, we do not guarantee uninterrupted availability and are not liable for indirect or consequential
              losses arising from use of the Service, to the extent permitted by Kenyan law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">8. Governing law</h2>
            <p>These Terms are governed by the laws of Kenya. Disputes are subject to the jurisdiction of Kenyan courts.</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-foreground mb-1">9. Contact</h2>
            <p>Questions about these Terms: mutisoconstruction@gmail.com.</p>
          </section>
        </div>

        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    </div>
  );
}

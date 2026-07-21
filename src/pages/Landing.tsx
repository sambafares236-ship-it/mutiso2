import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HardHat,
  ShieldCheck,
  ClipboardList,
  Wallet,
  Wrench,
  Leaf,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { TIER_PRICING } from '@/lib/pricing';

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Daily Field Operations',
    description: 'Attendance, material deliveries and usage, site diary, and photos — offline-first for spotty site connectivity.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety & Compliance',
    description: 'Incident register, toolbox talks, inspection checklists, and permit-to-work — built around OSHA 2007, WIBA 2007, and DOSHS.',
  },
  {
    icon: CheckCircle2,
    title: 'Quality & Progress',
    description: 'Defect tracking, sequence-gated milestone sign-off, and a full site history feed for every site.',
  },
  {
    icon: Wallet,
    title: 'Financial Administration',
    description: 'Payroll from attendance, budgets, payment certificates, variation orders, and subcontractor work orders.',
  },
  {
    icon: Wrench,
    title: 'Assets & Access',
    description: 'Tool and plant checkout history, visitor sign-in/out, and expiring-soon certification tracking.',
  },
  {
    icon: Leaf,
    title: 'Environmental Logging',
    description: 'NEMA-oriented waste disposal tracking plus dust, noise, and spill incident reporting.',
  },
];

const FAQS = [
  {
    q: 'Is Mutiso.AI built for the Kenyan construction market specifically?',
    a: 'Yes — pricing is in KES, and the safety/compliance workflows are built around OSHA 2007, WIBA 2007, DOSHS, NCA, and Energy Act 2019 references.',
  },
  {
    q: 'Is there a free trial?',
    a: "No — billing starts as soon as your site is approved. There's no free trial period.",
  },
  {
    q: 'Do I need a smartphone app or special hardware?',
    a: 'No — Mutiso.AI runs in your mobile browser and can be installed to your home screen like an app. Foremen can keep logging attendance and materials even with no signal; it syncs once back online.',
  },
  {
    q: 'How does the WhatsApp bot work?',
    a: "Once enabled, a contractor can message the bot directly on WhatsApp and ask things like \"how's Site A doing\" to get a real answer pulled from live attendance, materials, incident, and budget data — no need to open the app.",
  },
  {
    q: 'How do I pay?',
    a: 'Subscriptions are billed monthly via M-Pesa. Once your site is approved, you can pay from inside the app and your subscription is activated after confirmation.',
  },
];

function currentOrigin() {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://mutisoai.vercel.app';
}

export default function Landing() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/app', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Mutiso.AI',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'Construction site management software for Kenyan contractors — attendance, safety compliance, materials, payroll, and a WhatsApp site-status assistant.',
        url: currentOrigin(),
        offers: [
          {
            '@type': 'Offer',
            name: 'Field Ops & Safety',
            price: String(TIER_PRICING.field_ops.base),
            priceCurrency: 'KES',
            priceValidUntil: '2027-12-31',
          },
          {
            '@type': 'Offer',
            name: 'Pro',
            price: String(TIER_PRICING.pro.base),
            priceCurrency: 'KES',
            priceValidUntil: '2027-12-31',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <div className="caution-stripe w-full" />

      {/* Nav */}
      <header className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <HardHat className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg text-primary">MUTISO.AI</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
          Sign In
        </Button>
      </header>

      {/* Hero */}
      <section className="container px-4 pt-10 pb-16 text-center max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display text-4xl sm:text-5xl text-foreground leading-tight">
            Construction Site Management Software, <span className="text-primary">Built for Kenya</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Attendance, safety compliance, materials, payroll, and progress tracking for your construction sites —
            plus a WhatsApp assistant that answers "how's my site doing" in real time.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="construction" size="xl" onClick={() => navigate('/auth')}>
              Get Started <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button variant="outline" size="xl" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              See Pricing
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Billed monthly via M-Pesa once your site is approved.</p>
        </motion.div>
      </section>

      {/* Pain points */}
      <section className="bg-secondary/30 py-14">
        <div className="container px-4 max-w-4xl mx-auto text-center">
          <h2 className="font-display text-2xl text-foreground">Still running your site on paper and WhatsApp groups?</h2>
          <div className="mt-8 grid sm:grid-cols-3 gap-6 text-left">
            <div className="card-industrial p-4">
              <p className="font-medium text-foreground">No compliance paper trail</p>
              <p className="text-sm text-muted-foreground mt-1">
                Incidents, toolbox talks, and permits scattered across notebooks — a real risk under WIBA and OSHA.
              </p>
            </div>
            <div className="card-industrial p-4">
              <p className="font-medium text-foreground">No financial visibility</p>
              <p className="text-sm text-muted-foreground mt-1">
                Payroll, budgets, and variation orders tracked in disconnected spreadsheets, if at all.
              </p>
            </div>
            <div className="card-industrial p-4">
              <p className="font-medium text-foreground">Messages get lost</p>
              <p className="text-sm text-muted-foreground mt-1">
                A serious incident buried in a WhatsApp group chat instead of reaching you the moment it happens.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature overview */}
      <section className="py-14">
        <div className="container px-4 max-w-5xl mx-auto">
          <h2 className="font-display text-2xl text-foreground text-center">Everything a site needs, in one place</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-industrial p-4">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-medium text-foreground">{f.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp bot spotlight */}
      <section className="bg-secondary/30 py-14">
        <div className="container px-4 max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="font-display text-2xl text-foreground">Ask your site status, right from WhatsApp</h2>
          <p className="mt-3 text-muted-foreground">
            No app to open, no dashboard to check. Message the Mutiso.AI bot and ask "how's Westlands Tower A doing
            this week?" — get a real answer pulled from live attendance, deliveries, incidents, and budget data.
            Serious incidents also push straight to your phone the moment they're logged, on every plan.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-14">
        <div className="container px-4 max-w-4xl mx-auto">
          <h2 className="font-display text-2xl text-foreground text-center">Simple, per-site pricing</h2>
          <p className="text-center text-muted-foreground mt-2">Billed monthly via M-Pesa, per site, once your site is approved.</p>

          <div className="mt-8 grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="card-industrial p-6">
              <p className="font-display text-xl text-foreground">Field Ops & Safety</p>
              <p className="mt-2">
                <span className="font-display text-3xl text-primary">KES {TIER_PRICING.field_ops.base.toLocaleString('en-KE')}</span>
                <span className="text-muted-foreground">/site/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Attendance, materials, diary, photos</li>
                <li>Incidents, toolbox talks, inspections, permits</li>
                <li>Tool checkout &amp; return log</li>
                <li>Real-time severe-incident WhatsApp/email alerts</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                + WhatsApp Bot add-on: KES {TIER_PRICING.field_ops.withBot - TIER_PRICING.field_ops.base}/mo
              </p>
            </div>
            <div className="card-industrial p-6 border-2 border-primary">
              <p className="font-display text-xl text-foreground">Pro</p>
              <p className="mt-2">
                <span className="font-display text-3xl text-primary">KES {TIER_PRICING.pro.base.toLocaleString('en-KE')}</span>
                <span className="text-muted-foreground">/site/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Everything in Field Ops & Safety</li>
                <li>Defects, milestones, schedule/Gantt, budget, payroll</li>
                <li>Variation orders, subcontractors, heavy plant</li>
                <li>Weekly and monthly WhatsApp/email digests</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                + WhatsApp Bot add-on: KES {TIER_PRICING.pro.withBot - TIER_PRICING.pro.base}/mo
              </p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Button variant="construction" size="xl" onClick={() => navigate('/auth')}>
              Get Started <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* Trust / compliance */}
      <section className="bg-secondary/30 py-14">
        <div className="container px-4 max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl text-foreground">Built around Kenyan construction compliance</h2>
          <p className="mt-3 text-muted-foreground">
            Safety and compliance workflows reference OSHA 2007, WIBA 2007, DOSHS, NCA, and Energy Act 2019 —
            because a construction management tool for this market should speak the language of the regulations it's
            meant to help you meet.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14">
        <div className="container px-4 max-w-2xl mx-auto">
          <h2 className="font-display text-2xl text-foreground text-center">Frequently asked questions</h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((f) => (
              <div key={f.q} className="card-industrial p-4">
                <p className="font-medium text-foreground">{f.q}</p>
                <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Mutiso.AI</span>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-foreground">Terms</a>
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/auth" className="hover:text-foreground">Sign In</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

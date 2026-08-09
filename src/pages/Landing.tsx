import { useEffect, useState } from 'react';
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
  Menu,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { TIER_PRICING } from '@/lib/pricing';

const WHATSAPP_NUMBER = '254700920985'; // 0700920985 in international format, no leading 0/+
const CONTACT_EMAIL = 'mutisoconstruction@gmail.com';

const NAV_LINKS = [
  { label: 'Home', id: 'home' },
  { label: 'About', id: 'about' },
  { label: 'Pricing', id: 'pricing' },
  { label: 'Contact', id: 'contact' },
];

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/app', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const scrollToId = (id: string) => {
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Mutiso.AI',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'Construction site management software for Kenyan contractors — attendance, safety compliance, materials, and payroll.',
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
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between h-16 px-4">
          <button
            onClick={() => scrollToId('home')}
            className="flex items-center gap-2"
            aria-label="Mutiso.AI home"
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <HardHat className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg text-primary">MUTISO.AI</span>
          </button>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToId(link.id)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="hidden sm:block">
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>

          {/* Mobile menu trigger */}
          <div className="sm:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <nav className="mt-10 flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => scrollToId(link.id)}
                      className="text-left px-2 py-3 text-base font-medium text-foreground hover:text-primary transition-colors border-b border-border"
                    >
                      {link.label}
                    </button>
                  ))}
                  <SheetClose asChild>
                    <Button variant="construction" className="mt-6" onClick={() => navigate('/auth')}>
                      Sign In
                    </Button>
                  </SheetClose>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="container px-4 pt-10 pb-16 text-center max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display text-4xl sm:text-5xl text-foreground leading-tight">
            Construction Site Management Software, <span className="text-primary">Built for Kenya</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Attendance, safety compliance, materials, payroll, and progress tracking for your construction sites.
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

      {/* About */}
      <section id="about" className="py-14">
        <div className="container px-4 max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl text-foreground">About Mutiso.AI</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Mutiso.AI is built by Jenga Technologies for contractors and foremen running real construction sites
            across Kenya — not a generic global tool retrofitted for the local market. We built it because too many
            sites are still run on paper notebooks and scattered WhatsApp groups, where a missed message can mean a
            missed safety incident, a payroll dispute, or a material shortage nobody saw coming.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Every workflow in Mutiso.AI — from attendance to incident reporting to payroll — is designed around how
            Kenyan sites actually operate: KES pricing, M-Pesa billing, and safety processes built around OSHA 2007,
            WIBA 2007, DOSHS, NCA, and Energy Act 2019. Our goal is simple: give contractors real visibility into
            every site they run, and give foremen a tool that works even when the signal doesn't.
          </p>
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
                <li>Weekly and monthly email digests</li>
              </ul>
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

      {/* Contact */}
      <section id="contact" className="bg-secondary/30 py-14">
        <div className="container px-4 max-w-2xl mx-auto text-center">
          <h2 className="font-display text-2xl text-foreground">How to reach us</h2>
          <p className="mt-3 text-muted-foreground">
            Questions before you sign up, or need help with your site? Reach us directly.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card-industrial p-5 flex flex-col items-center gap-2 hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">WhatsApp</p>
              <p className="text-sm text-muted-foreground">0700 920 985</p>
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`}
              className="card-industrial p-5 flex flex-col items-center gap-2 hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">Email</p>
              <p className="text-sm text-muted-foreground break-all">{CONTACT_EMAIL}</p>
            </a>
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
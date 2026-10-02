import type { ReactNode } from 'react';
import { ExternalLink, Globe, Mail, Phone } from 'lucide-react';
import { BRAND } from '../brand';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M6.9 8.6H3.8V20h3.1V8.6ZM5.3 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM20.2 13.4c0-3-1.6-4.9-4.2-4.9-1.4 0-2.4.8-2.8 1.5V8.6h-3V20h3.1v-5.9c0-1.6.8-2.6 2.1-2.6 1.2 0 1.8.9 1.8 2.6V20h3.1v-6.6Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ContactLink({ href, icon, children, tone, external }: { href: string; icon: ReactNode; children: ReactNode; tone: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-indigo-50 transition-colors hover:bg-white/10"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white ${tone}`}>{icon}</span>
      <span className="truncate group-hover:text-white">{children}</span>
    </a>
  );
}

const SOCIALS = [
  { label: 'Facebook', href: BRAND.social.facebook, icon: <FacebookIcon />, tone: 'bg-[#1877F2]' },
  { label: 'LinkedIn', href: BRAND.social.linkedin, icon: <LinkedInIcon />, tone: 'bg-[#0A66C2]' },
  { label: 'Instagram', href: BRAND.social.instagram, icon: <InstagramIcon />, tone: 'bg-linear-to-br from-amber-400 via-pink-500 to-purple-600' },
];

export function Footer() {
  return (
    <footer className="mt-4 bg-linear-to-r from-indigo-950 via-violet-950 to-fuchsia-950 text-indigo-100">
      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-8 sm:px-6 md:grid-cols-3">
        <div className="space-y-2">
          <p className="bg-linear-to-r from-sky-300 via-fuchsia-300 to-amber-200 bg-clip-text text-lg font-bold text-transparent">{BRAND.name}</p>
          <p className="text-sm text-indigo-200">
            Text Diff &amp; Patch Checker is a free, privacy-first developer tool by {BRAND.name}. Everything runs in your browser.
          </p>
          <a
            href={BRAND.demo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-indigo-500 to-fuchsia-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-fuchsia-900 hover:brightness-110"
          >
            Try the live demo
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        <nav aria-label="Contact HiMat Technology" className="space-y-1">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-fuchsia-200 uppercase">Contact</p>
          <ContactLink href={BRAND.website} icon={<Globe className="h-4 w-4" />} tone="bg-sky-500" external>
            {BRAND.websiteLabel}
          </ContactLink>
          <ContactLink href={`mailto:${BRAND.email}`} icon={<Mail className="h-4 w-4" />} tone="bg-rose-500">
            {BRAND.email}
          </ContactLink>
          <ContactLink href={BRAND.phoneHref} icon={<Phone className="h-4 w-4" />} tone="bg-emerald-500">
            {BRAND.phoneDisplay}
          </ContactLink>
        </nav>

        <nav aria-label="HiMat Technology on social media" className="space-y-1">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-fuchsia-200 uppercase">Follow us</p>
          {SOCIALS.map((s) => (
            <ContactLink key={s.label} href={s.href} icon={s.icon} tone={s.tone} external>
              {s.label}
            </ContactLink>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-center text-[11px] text-indigo-300">
        © {new Date().getFullYear()} {BRAND.name} · Runs entirely in your browser · Myers O(ND) diff engine
      </div>
    </footer>
  );
}

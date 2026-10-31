import { getAllBlogs } from '@/lib/blogs';
import SiteHeader from '@/components/SiteHeader';
import HeroSection from '@/components/HeroSection';
import HowMelleaSection from '@/components/HowMelleaSection';
import FutureSoftwareSection from '@/components/FutureSoftwareSection';
import GraniteSection from '@/components/GraniteSection';
import BlogSection from '@/components/BlogSection';
import SiteFooter from '@/components/SiteFooter';
import CursorToggle from '@/components/CursorToggle';
import LandingScripts from '@/components/LandingScripts';

export default function HomePage() {
  const recent = getAllBlogs().slice(0, 3);

  return (
    <>
      <div id="cursor-sprite" className="cursor-sprite" aria-hidden="true" />
      <SiteHeader />
      <HeroSection />
      <HowMelleaSection />
      <FutureSoftwareSection />
      <GraniteSection />
      <BlogSection blogs={recent} />
      <SiteFooter showCta />
      <CursorToggle />
      <LandingScripts />
    </>
  );
}

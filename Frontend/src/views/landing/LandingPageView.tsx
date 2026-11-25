import React, { useState } from 'react';
import { LandingNavbar } from './components/LandingNavbar';
import { HeroSection } from './components/HeroSection';
import { ComparisonSection } from './components/ComparisonSection';
import { TcoCalculatorSection } from './components/TcoCalculatorSection';
import { FeaturesShowcaseSection } from './components/FeaturesShowcaseSection';
import { AgtComplianceSection } from './components/AgtComplianceSection';
import { PricingSection } from './components/PricingSection';
import { AccountantsPartnerSection } from './components/AccountantsPartnerSection';
import { FaqSection } from './components/FaqSection';
import { LeadCaptureModal } from './components/LeadCaptureModal';
import { LandingFooter } from './components/LandingFooter';

interface LandingPageViewProps {
  onOpenLogin: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onOpenLogin }) => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<string>('');

  const handleOpenDemoWithPlan = (plan: string) => {
    setSelectedPlanDetails(plan);
    setIsDemoModalOpen(true);
  };

  const handleOpenGeneralDemo = () => {
    setSelectedPlanDetails('Demonstração Geral do Kudiba ERP');
    setIsDemoModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Top Navbar */}
      <LandingNavbar
        onOpenLogin={onOpenLogin}
        onOpenDemo={handleOpenGeneralDemo}
      />

      <main>
        {/* 1. Hero Section */}
        <HeroSection
          onOpenDemo={handleOpenGeneralDemo}
          onOpenLogin={onOpenLogin}
        />

        {/* 2. Interactive TCO Calculator (Live Savings in Kwanzas) */}
        <TcoCalculatorSection
          onOpenDemoWithPlan={handleOpenDemoWithPlan}
        />

        {/* 3. Kudiba vs Legacy Systems Comparison */}
        <ComparisonSection />

        {/* 4. Complete Features & Modules Deep Dive */}
        <FeaturesShowcaseSection />

        {/* 5. AGT Compliance, Decree 71/25 & Security */}
        <AgtComplianceSection />

        {/* 6. Transparent Pricing Plans in Kwanzas */}
        <PricingSection
          onSelectPlan={handleOpenDemoWithPlan}
        />

        {/* 7. Special Section for Accountants & Tax Consultants */}
        <AccountantsPartnerSection
          onJoinProgram={() => handleOpenDemoWithPlan('Programa de Parceria para Contabilistas (OPCA)')}
        />

        {/* 8. Frequently Asked Questions (FAQ) */}
        <FaqSection />
      </main>

      {/* Footer */}
      <LandingFooter
        onOpenLogin={onOpenLogin}
        onOpenDemo={handleOpenGeneralDemo}
      />

      {/* Lead Capture & WhatsApp Demo Modal */}
      <LeadCaptureModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        initialPlan={selectedPlanDetails}
      />
    </div>
  );
};

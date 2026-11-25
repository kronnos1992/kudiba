import React, { useState } from 'react';
import { LandingNavbar } from './components/LandingNavbar';
import { HeroSection } from './components/HeroSection';
import { QuickActionRail } from './components/QuickActionRail';
import { SolutionsByAudienceSection } from './components/SolutionsByAudienceSection';
import { ComparisonSection } from './components/ComparisonSection';
import { TcoCalculatorSection } from './components/TcoCalculatorSection';
import { FeaturesShowcaseSection, type LandingModuleId } from './components/FeaturesShowcaseSection';
import { AgtComplianceSection } from './components/AgtComplianceSection';
import { PricingSection } from './components/PricingSection';
import { AccountantsPartnerSection } from './components/AccountantsPartnerSection';
import { NewsSection } from './components/NewsSection';
import { NewsletterSection } from './components/NewsletterSection';
import { FaqSection } from './components/FaqSection';
import { LeadCaptureModal } from './components/LeadCaptureModal';
import { LandingFooter } from './components/LandingFooter';

interface LandingPageViewProps {
  onOpenLogin: () => void;
}

const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onOpenLogin }) => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState('');
  const [activeModule, setActiveModule] = useState<LandingModuleId>('invoicing');

  const handleOpenDemoWithPlan = (plan: string) => {
    setSelectedPlanDetails(plan);
    setIsDemoModalOpen(true);
  };

  const handleOpenGeneralDemo = () => {
    setSelectedPlanDetails('Demonstração Geral do Kudiba ERP');
    setIsDemoModalOpen(true);
  };

  const handleSelectModule = (id: LandingModuleId) => {
    setActiveModule(id);
    window.setTimeout(() => scrollToSection('solucoes'), 0);
  };

  return (
    <div id="topo" className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans selection:bg-emerald-700 selection:text-white transition-colors duration-200">
      <LandingNavbar
        onOpenLogin={onOpenLogin}
        onOpenDemo={handleOpenGeneralDemo}
        onSelectModule={handleSelectModule}
      />

      <QuickActionRail
        onOpenDemo={handleOpenGeneralDemo}
        onRequestCallback={handleOpenDemoWithPlan}
      />

      <main>
        <HeroSection onOpenDemo={handleOpenGeneralDemo} onOpenLogin={onOpenLogin} />

        <SolutionsByAudienceSection
          onSelectModule={handleSelectModule}
          onOpenDemo={handleOpenGeneralDemo}
        />

        <TcoCalculatorSection onOpenDemoWithPlan={handleOpenDemoWithPlan} />

        <ComparisonSection />

        <FeaturesShowcaseSection activeTab={activeModule} onSelectTab={setActiveModule} />

        <AgtComplianceSection />

        <PricingSection onSelectPlan={handleOpenDemoWithPlan} />

        <AccountantsPartnerSection
          onJoinProgram={() => handleOpenDemoWithPlan('Programa de Parceria para Contabilistas (OPCA)')}
        />

        <NewsSection onNavigate={scrollToSection} />

        <NewsletterSection />

        <FaqSection />
      </main>

      <LandingFooter onOpenLogin={onOpenLogin} onOpenDemo={handleOpenGeneralDemo} />

      <LeadCaptureModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        initialPlan={selectedPlanDetails}
      />
    </div>
  );
};

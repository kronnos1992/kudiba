import { createGlobalStyle } from 'styled-components';
import { tokens } from './designTokens';

export const GlobalStyles = createGlobalStyle`
  :root {
    --font-primary: ${tokens.fonts.primary};
    --font-mono: ${tokens.fonts.mono};
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: var(--font-primary);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .font-mono {
    font-family: var(--font-mono) !important;
    font-variant-numeric: tabular-nums;
  }

  /* Impressão Fiscal: Térmica 80mm/58mm e A4 AGT */
  @media print {
    body {
      background: #FFFFFF !important;
      color: #000000 !important;
    }

    .no-print {
      display: none !important;
    }

    .print-only {
      display: block !important;
    }

    /* Layout Térmico 80mm */
    @page thermal-80mm {
      size: 80mm auto;
      margin: 2mm;
    }

    .thermal-receipt {
      page: thermal-80mm;
      width: 76mm;
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }

    /* Layout Oficial A4 */
    @page invoice-a4 {
      size: A4 portrait;
      margin: 15mm;
    }

    .invoice-a4-page {
      page: invoice-a4;
      width: 100%;
      color: #000000;
    }
  }
`;

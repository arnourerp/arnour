/* ============================================================================
   ARNOUR — SAP CATALOG (official solution hierarchy)
   ----------------------------------------------------------------------------
   THIS IS THE SINGLE SOURCE OF TRUTH for every SAP Product and Module in the
   app (skill tagging, job requirements, talent search, matching).

   v15: replaced with the client's product & module taxonomy
   (11 products / 98 modules). Names are exactly as supplied.
   `short` is the compact product label used inside chips; `name` is the full
   label shown in dropdowns. Module ids are stable; saved data from the previous
   hierarchy is mapped across by APP.migrateCatalog() in core.js.
   If the hierarchy changes, replace ONLY this file (and add any id changes to
   the migration table).
   The shape must stay:
     { products: [ { id, name, short, modules: [ { id, name } ] } ] }
   ============================================================================ */

window.CATALOG = {
  products: [
    {
      id: 's4onprem', name: 'S/4HANA Private Cloud / On-Premise (Core Enterprise)', short: 'S/4HANA Private Cloud / On-Prem',
      modules: [
        { id: 'fi', name: 'FI (Financial Accounting)' },
        { id: 'co', name: 'CO (Controlling)' },
        { id: 'cfin', name: 'Central Finance (cFin)' },
        { id: 'groupreporting', name: 'Group Reporting (Consolidation)' },
        { id: 'sd', name: 'SD (Sales & Distribution)' },
        { id: 'cs', name: 'S/4HANA Service (formerly CS)' },
        { id: 'mm', name: 'MM (Sourcing & Procurement / Materials Management)' },
        { id: 'pp', name: 'PP (Production Planning)' },
        { id: 'qm', name: 'QM (Quality Management)' },
        { id: 'pm', name: 'PM / EAM (Plant Maintenance / Asset Management)' },
        { id: 'ps', name: 'PS (Project System)' },
        { id: 'ewm', name: 'EWM (Extended Warehouse Management)' },
        { id: 'tm', name: 'TM (Transportation Management)' },
        { id: 'trm', name: 'TRM (Treasury & Risk Management)' },
        { id: 'abap', name: 'ABAP / ABAP Cloud' },
        { id: 'fiorui5', name: 'Fiori / UI5 Development' },
        { id: 'basis', name: 'BASIS & System Administration' },
        { id: 'hanadba', name: 'HANA Database Administration' },
        { id: 'securitygrc', name: 'Security & GRC' },
        { id: 'solman', name: 'Solution Manager / Cloud ALM' }
      ]
    },
    {
      id: 'ecc', name: 'ECC 6.0 (Legacy Core)', short: 'ECC 6.0',
      modules: [
        { id: 'fi', name: 'FI (Financial Accounting)' },
        { id: 'co', name: 'CO (Controlling)' },
        { id: 'sd', name: 'SD (Sales & Distribution)' },
        { id: 'cs', name: 'CS (Customer Service)' },
        { id: 'mm', name: 'MM (Materials Management)' },
        { id: 'pp', name: 'PP (Production Planning)' },
        { id: 'qm', name: 'QM (Quality Management)' },
        { id: 'pm', name: 'PM (Plant Maintenance)' },
        { id: 'ps', name: 'PS (Project System)' },
        { id: 'hcm', name: 'HCM (Human Resources)' },
        { id: 'hcmpay', name: 'HCM Payroll' },
        { id: 'ewm', name: 'EWM (Extended Warehouse Management)' },
        { id: 'tm', name: 'TM (Transportation Management)' },
        { id: 'trm', name: 'TRM (Treasury & Risk Management)' },
        { id: 'abap', name: 'ABAP' },
        { id: 'basis', name: 'BASIS' },
        { id: 'securitygrc', name: 'Security & GRC' },
        { id: 'solman', name: 'Solution Manager' },
        { id: 'po', name: 'PO / PI (Process Orchestration / Integration)' },
        { id: 'bobods', name: 'BO / BODS Administration' }
      ]
    },
    {
      id: 's4public', name: 'S/4HANA Public Cloud', short: 'S/4HANA Public Cloud',
      modules: [
        { id: 'fico', name: 'Finance (FI/CO)' },
        { id: 'mm', name: 'Sourcing & Procurement (MM)' },
        { id: 'sd', name: 'Sales (SD)' },
        { id: 'scm', name: 'Supply Chain (SCM)' },
        { id: 'pp', name: 'Manufacturing (PP)' },
        { id: 'pm', name: 'Asset Management (PM)' },
        { id: 'cs', name: 'Service' },
        { id: 'ps', name: 'EPPM / Project Systems (PS)' },
        { id: 'cbc', name: 'CBC (Central Business Configuration)' },
        { id: 'trm', name: 'Treasury (TRM)' }
      ]
    },
    {
      id: 'successfactors', name: 'SuccessFactors (HXM)', short: 'SuccessFactors',
      modules: [
        { id: 'ec', name: 'Employee Central (EC)' },
        { id: 'ecp', name: 'Employee Central Payroll (ECP)' },
        { id: 'recruiting', name: 'Recruiting (RCM/RMK)' },
        { id: 'onboarding', name: 'Onboarding (ONB)' },
        { id: 'perfgoals', name: 'Performance & Goals (PMGM)' },
        { id: 'learning', name: 'Learning (LMS)' },
        { id: 'compensation', name: 'Compensation (COMP)' },
        { id: 'succession', name: 'Succession & Development (CDP)' }
      ]
    },
    {
      id: 'ariba', name: 'Ariba (Procurement)', short: 'Ariba',
      modules: [
        { id: 'sourcing', name: 'Ariba Sourcing' },
        { id: 'contracts', name: 'Ariba Contracts' },
        { id: 'slp', name: 'Ariba SLP (Supplier Lifecycle & Performance)' },
        { id: 'buying', name: 'Ariba Buying & Invoicing' },
        { id: 'commerceautomation', name: 'Commerce Automation / Ariba Network' },
        { id: 'cig', name: 'Ariba CIG / Integration Suite' }
      ]
    },
    {
      id: 'btp', name: 'BTP (Business Technology Platform)', short: 'BTP',
      modules: [
        { id: 'integration', name: 'Integration Suite (CPI / API Management)' },
        { id: 'buildapps', name: 'SAP Build Apps (Low-Code / No-Code)' },
        { id: 'buildpa', name: 'SAP Build Process Automation (Workflow & RPA)' },
        { id: 'basfiori', name: 'SAP BAS / Fiori Development' },
        { id: 'cap', name: 'CAP (Cloud Application Programming Model)' },
        { id: 'abapcloud', name: 'ABAP Cloud' },
        { id: 'btpadmin', name: 'BTP Administration (Subaccounts, Connectivity, Cloud Connector)' },
        { id: 'identity', name: 'Cloud Identity Services (IAS / IPS)' }
      ]
    },
    {
      id: 'data', name: 'Data, Analytics & Insights', short: 'Data & Analytics',
      modules: [
        { id: 'bistories', name: 'SAP Analytics Cloud (SAC) - BI & Stories' },
        { id: 'planning', name: 'SAP Analytics Cloud (SAC) - Planning (FP&A)' },
        { id: 'datasphere', name: 'SAP Datasphere' },
        { id: 'bw', name: 'SAP BW / BW/4HANA' },
        { id: 'bods', name: 'SAP BODS (Data Services / ETL)' }
      ]
    },
    {
      id: 'cx', name: 'CX (Customer Experience / CRM)', short: 'CX',
      modules: [
        { id: 'commercecloud', name: 'Commerce Cloud (Hybris)' },
        { id: 'salescloud', name: 'Sales Cloud (C4C)' },
        { id: 'servicecloud', name: 'Service Cloud (C4C / FSM)' },
        { id: 'marketingcloud', name: 'Customer Data Platform (CDP) / Marketing Cloud' },
        { id: 'crmsales', name: 'CRM Sales (Classic & S/4HANA)' },
        { id: 'crmservice', name: 'CRM Service (Classic & S/4HANA)' },
        { id: 'crmmarketing', name: 'CRM Marketing (Classic & S/4HANA)' }
      ]
    },
    {
      id: 'businessone', name: 'Business One (SME ERP)', short: 'Business One',
      modules: [
        { id: 'financebanking', name: 'Finance & Banking' },
        { id: 'salespurchasing', name: 'Sales & Purchasing' },
        { id: 'inventoryproduction', name: 'Inventory & Production' },
        { id: 'sdkaddon', name: 'SDK / Add-on Development' }
      ]
    },
    {
      id: 'industry', name: 'SAP Industry Solutions (IS)', short: 'Industry Solutions',
      modules: [
        { id: 'isutilities', name: 'IS-Utilities (IS-U / Energy & Water)' },
        { id: 'isretail', name: 'IS-Retail & Fashion (FMS)' },
        { id: 'isoilgas', name: 'IS-Oil & Gas' },
        { id: 'isrealestate', name: 'IS-Real Estate (RE-FX)' },
        { id: 'publicsector', name: 'Public Sector (PSM / Funds Management)' },
        { id: 'isautomotive', name: 'IS-Automotive (DBM / VMS / Proaxia)' },
        { id: 'isbanking', name: 'IS-Banking & Financial Services (FS-CD / Loans)' },
        { id: 'ishealthcare', name: 'IS-Healthcare (IS-H)' },
        { id: 'ismills', name: 'IS-Mill Products & Mining' }
      ]
    },
    {
      id: 'specialized', name: 'Specialized Cloud & SaaS Solutions', short: 'Specialized Cloud & SaaS',
      modules: [
        { id: 'ibp', name: 'SAP IBP (Integrated Business Planning - Demand, S&OP, Inventory)' },
        { id: 'concur', name: 'SAP Concur (Travel, Expense & Invoice)' },
        { id: 'fieldglass', name: 'SAP Fieldglass (Vendor Management / External Workforce)' },
        { id: 'signavio', name: 'SAP Signavio (Process Insights, Modeling & Mining)' }
      ]
    }
  ]
};

/* Convenience indexes (built from CATALOG) */
window.CAT_INDEX = (() => {
  const byId = {};
  const mods = {};
  let totalModules = 0;
  for (const p of CATALOG.products) {
    byId[p.id] = p;
    totalModules += p.modules.length;
    for (const m of p.modules) {
      mods[p.id + ':' + m.id] = { id: m.id, name: m.name, productId: p.id, productName: p.name };
    }
  }
  return { byId, mods, totalModules };
})();

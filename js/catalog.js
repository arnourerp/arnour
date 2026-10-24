/* ============================================================================
   ARNOUR — SAP CATALOG (official solution hierarchy)
   ----------------------------------------------------------------------------
   THIS IS THE SINGLE SOURCE OF TRUTH for every SAP Product and Module in the
   app (skill tagging, job requirements, talent search, matching).

   v15: replaced with the client's product & module taxonomy
   (11 products / 98 modules). Names are exactly as supplied.
   v21: 15 products / 147 modules (+AI, Qualtrics, Supply Chain Cloud, Business Network;
   Fiori id fiorui5 -> fioriui5; IBP moved to scmcloud). Old ids are mapped by APP.catalogMigrate.
   v20: +EHS, FSCM, GTS, Grants, PI/PO on S/4 Private, Event Mesh, MDG,
   Data Migration, Archiving & ILM; Treasury renamed (id kept) - 116 modules.
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
        { id: 'ps', name: 'EPPM / PS (Project System)' },
        { id: 'ewm', name: 'EWM (Extended Warehouse Management)' },
        { id: 'tm', name: 'TM (Transportation Management)' },
        { id: 'trm', name: 'Treasury & Bank Communication (TRM / BCM / Cash)' },
        { id: 'fscm', name: 'FSCM (Credit, Collections & Dispute Management)' },
        { id: 'ehs', name: 'EHS (Environment, Health & Safety)' },
        { id: 'gts', name: 'GTS (Global Trade Services)' },
        { id: 'grants', name: 'Grants Management' },
        { id: 'abap', name: 'ABAP / ABAP Cloud' },
        { id: 'fioriui5', name: 'Fiori / UI5 Development' },
        { id: 'basis', name: 'BASIS & System Administration' },
        { id: 'hanadba', name: 'HANA Database Administration' },
        { id: 'securitygrc', name: 'Security & GRC' },
        { id: 'solman', name: 'Solution Manager / Cloud ALM' },
        { id: 'po', name: 'PO / PI (Process Orchestration / Integration)' },
        { id: 'hcm', name: 'HCM on S/4HANA (Human Resources – private cloud)' }
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
        { id: 'trm', name: 'Treasury & Bank Communication (TRM / BCM / Cash)' },
        { id: 'fscm', name: 'FSCM (Credit, Collections & Dispute Management)' },
        { id: 'ehs', name: 'EHS (Environment, Health & Safety)' },
        { id: 'gts', name: 'GTS (Global Trade Services)' },
        { id: 'grants', name: 'Grants Management' },
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
        { id: 'trm', name: 'Treasury & Bank Communication (TRM / BCM / Cash)' },
        { id: 'fscm', name: 'FSCM (Credit, Collections & Dispute Management)' },
        { id: 'ehs', name: 'EHS (Environment, Health & Safety)' },
        { id: 'cfin', name: 'Central Finance (cFin)' },
        { id: 'groupreporting', name: 'Group Reporting (Consolidation)' }
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
        { id: 'succession', name: 'Succession & Development (CDP)' },
        { id: 'wfm', name: 'Workforce Management – Time, Attendance & Scheduling (WFM)' },
        { id: 'wfa', name: 'Workforce Analytics & Planning (WFA)' }
      ]
    },
    {
      id: 'ariba', name: 'Ariba (Procurement)', short: 'Ariba',
      modules: [
        { id: 'sourcing', name: 'Ariba Sourcing' },
        { id: 'contracts', name: 'Ariba Contracts' },
        { id: 'slp', name: 'Ariba SLP (Supplier Lifecycle & Performance)' },
        { id: 'buying', name: 'Ariba Buying & Invoicing' },
        { id: 'commerceautomation', name: 'Commerce Automation' },
        { id: 'cig', name: 'Ariba CIG / Integration Suite' },
        { id: 'taulia', name: 'SAP Taulia (Supply Chain Finance / Dynamic Discounting)' }
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
        { id: 'identity', name: 'Cloud Identity Services (IAS / IPS)' },
        { id: 'eventmesh', name: 'Event Mesh (Advanced Event Mesh)' },
        { id: 'hanacloud', name: 'SAP HANA Cloud (Managed Cloud Database)' },
        { id: 'workzone', name: 'SAP Work Zone (Digital Workplace / Employee Portal)' },
        { id: 'drc', name: 'SAP Document & Reporting Compliance – Cloud (DRC / e-Invoicing)' }
      ]
    },
    {
      id: 'data', name: 'Data, Analytics & Insights', short: 'Data & Analytics',
      modules: [
        { id: 'bistories', name: 'SAP Analytics Cloud (SAC) - BI & Stories' },
        { id: 'planning', name: 'SAP Analytics Cloud (SAC) - Planning (FP&A)' },
        { id: 'datasphere', name: 'SAP Datasphere' },
        { id: 'bw', name: 'SAP BW / BW/4HANA' },
        { id: 'bods', name: 'SAP BODS (Data Services / ETL)' },
        { id: 'mdg', name: 'MDG (Master Data Governance)' },
        { id: 'datamigration', name: 'Data Migration & Transformation (Migration Cockpit, SLT, TDMS, LSMW)' },
        { id: 'archiving', name: 'Data Archiving & ILM' }
      ]
    },
    {
      id: 'cx', name: 'CX (Customer Experience / CRM)', short: 'CX',
      modules: [
        { id: 'commercecloud', name: 'Commerce Cloud (Hybris)' },
        { id: 'salescloud', name: 'Sales Cloud (C4C)' },
        { id: 'servicecloud', name: 'Service Cloud (C4C)' },
        { id: 'marketingcloud', name: 'Customer Data Platform (CDP) / Marketing Cloud' },
        { id: 'crmsales', name: 'CRM Sales (Classic & S/4HANA)' },
        { id: 'crmservice', name: 'CRM Service (Classic & S/4HANA)' },
        { id: 'crmmarketing', name: 'CRM Marketing (Classic & S/4HANA)' },
        { id: 'emarsys', name: 'SAP Emarsys / Engagement Cloud (Marketing Automation & Omnichannel)' },
        { id: 'cpq', name: 'SAP CPQ (Configure, Price, Quote)' },
        { id: 'fsm', name: 'SAP Field Service & Asset Management (FSM – standalone)' }
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
        { id: 'ismills', name: 'IS-Mill Products & Mining' },
        { id: 'iseco', name: 'IS-Engineering, Construction & Operations (EC&O)' },
        { id: 'islifesciences', name: 'IS-Life Sciences & Pharmaceuticals (GxP / Serialization)' }
      ]
    },
    {
      id: 'specialized', name: 'Specialized Cloud & SaaS Solutions', short: 'Specialized Cloud & SaaS',
      modules: [
        { id: 'concur', name: 'SAP Concur (Travel, Expense & Invoice)' },
        { id: 'fieldglass', name: 'SAP Fieldglass (Vendor Management / External Workforce)' },
        { id: 'signavio', name: 'SAP Signavio (Process Insights, Modeling & Mining)' },
        { id: 'leanix', name: 'SAP LeanIX (Enterprise Architecture Management)' }
      ]
    },
    {
      id: 'ai', name: 'AI & Intelligent Technologies', short: 'AI & Intelligent Tech',
      modules: [
        { id: 'aicore', name: 'SAP AI Core (ML Lifecycle Management & Model Deployment)' },
        { id: 'ailaunchpad', name: 'SAP AI Launchpad / Generative AI Hub (Prompt Engineering & LLM Orchestration)' },
        { id: 'joule', name: 'SAP Joule (AI Copilot – Configuration, Activation & Skills)' },
        { id: 'bdc', name: 'SAP Business Data Cloud (BDC – Unified Data + AI Platform)' },
        { id: 'dox', name: 'SAP Document Information Extraction (DOX – AI Document Processing)' }
      ]
    },
    {
      id: 'qualtrics', name: 'SAP Qualtrics (Experience Management)', short: 'Qualtrics',
      modules: [
        { id: 'qualtrics-cx', name: 'Customer Experience Management (XM – CX / NPS / CES)' },
        { id: 'qualtrics-ex', name: 'Employee Experience Management (XM – EX / Engagement)' },
        { id: 'qualtrics-bx', name: 'Brand & Market Research (XM – BX / Research)' },
        { id: 'qualtrics-admin', name: 'Qualtrics Platform Administration & CoreXM' }
      ]
    },
    {
      id: 'scmcloud', name: 'SAP Supply Chain Cloud (Standalone)', short: 'Supply Chain Cloud',
      modules: [
        { id: 'ibp', name: 'SAP IBP (Integrated Business Planning - Demand, S&OP, Inventory)' },
        { id: 'dmc', name: 'SAP Digital Manufacturing (DMC – Manufacturing Execution)' },
        { id: 'apm', name: 'SAP Asset Performance Management (APM / Intelligent Asset Management)' },
        { id: 'oms', name: 'SAP Order Management Services (OMS – Order Orchestration)' },
        { id: 'sustainability', name: 'SAP Sustainability Cloud (Green Ledger, Sustainability Control Tower)' }
      ]
    },
    {
      id: 'biznetwork', name: 'SAP Business Network', short: 'Business Network',
      modules: [
        { id: 'bn-procurement', name: 'SAP Business Network for Procurement (Supplier / Buyer Collaboration)' },
        { id: 'bn-supplychain', name: 'SAP Business Network for Supply Chain (Trading Partner Collaboration)' },
        { id: 'bn-assets', name: 'SAP Business Network for Asset Management' }
      ]
    }
  ]
};

/* Convenience indexes (built from the product list).
   CATALOG.products   = what the pickers offer: visible products with their visible modules.
   CAT_INDEX.byId/mods = everything, hidden items included, so a skill someone already has keeps its name.
   CAT_SET() is called once with the built-in list, and again with the database copy (APP.applyCatalog). */
window.CAT_SET = function (all) {
  const vis = [], byId = {}, mods = {};
  let totalModules = 0;
  for (const p of all) {
    const full = { id: p.id, name: p.name, short: p.short || p.name, hidden: !!p.hidden,
      modules: (p.modules || []).map(m => ({ id: m.id, name: m.name, hidden: !!m.hidden, family: m.family || '' })) };
    byId[p.id] = full;
    for (const m of full.modules) mods[p.id + ':' + m.id] = { id: m.id, name: m.name, hidden: m.hidden, productId: p.id, productName: p.name };
    if (!p.hidden) {
      const vm = full.modules.filter(m => !m.hidden);
      vis.push({ id: full.id, name: full.name, short: full.short, modules: vm });
      totalModules += vm.length;
    }
  }
  window.CATALOG = { products: vis };
  window.CAT_INDEX = { byId, mods, totalModules };
};
window.CAT_SET(window.CATALOG.products);

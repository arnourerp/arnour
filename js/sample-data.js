/* ============================================================================
   ARNOUR — SAMPLE MARKETPLACE DATA (prototype seed)
   ----------------------------------------------------------------------------
   Realistic demo content so the prototype feels alive on first open.
   Everything here is cloned into browser storage when the app first starts.
   ============================================================================ */

(function () {
  const D = 864e5; // one day in ms
  const H = 36e5;  // one hour in ms
  const now = Date.now();

  const consultants = [
    {
      id: 'c-ahmed', firstName: 'Ahmed', lastName: 'Said',
      headline: 'Senior SAP S/4HANA FICO Consultant',
      linkedin: 'https://www.linkedin.com/in/ahmed-said-sap-fico',
      roleType: 'functional',
      nationality: 'United Arab Emirates', country: 'ae', city: 'Dubai',
      level: 'Senior', yearsExp: 9, availability: 'Immediate',
      languages: ['English', 'Arabic'], currency: 'USD', dailyRate: 750,
      summary: 'Led financials on a full S/4HANA Greenfield rollout for a regional bank, including cutover and parallel accounting. Comfortable owning FI/CO end to end.',
      cv: { name: 'AhmedSaid_S4FICO_CV.pdf', size: '1.2 MB' },
      workPrefs: ['Remote','Hybrid'], specialties: ['clean-core','cutover'], otherSkills: [],
      industries: ['Banking & Financial Services', 'Retail & Consumer Goods (FMCG)'],
      skills: [
        { productId: 's4onprem', moduleId: 'fi', projects: 12, certified: true },
        { productId: 's4onprem', moduleId: 'co', projects: 6 },
        { productId: 's4onprem', moduleId: 'mm', projects: 3 },
        { productId: 'ariba', moduleId: 'buying', projects: 2 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-vikram', firstName: 'Vikram', lastName: 'Singh',
      headline: 'SAP Financials Programme Lead — S/4HANA Conversions',
      linkedin: 'https://www.linkedin.com/in/vikram-singh-sap-financials',
      roleType: 'delivery',
      nationality: 'India', country: 'in', city: 'Mumbai',
      level: 'Senior', yearsExp: 12, availability: 'Immediate',
      languages: ['English'], currency: 'USD', dailyRate: 1100,
      summary: 'Financials lead across 8 SAP implementations. Specialty: conversion programs, parallel accounting and audit readiness.',
      cv: { name: 'VikramSingh_CV.pdf', size: '0.9 MB' },
      workPrefs: ['Remote','Hybrid'], specialties: ['brownfield','pmo'], otherSkills: ['Parallel accounting','Audit readiness'],
      industries: ['Banking & Financial Services', 'Manufacturing & Industrial'],
      skills: [
        { productId: 's4onprem', moduleId: 'fi', projects: 18, certified: true },
        { productId: 's4onprem', moduleId: 'co', projects: 11, certified: true },
        { productId: 'ecc', moduleId: 'fi', projects: 8 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-priya', firstName: 'Priya', lastName: 'Nair',
      headline: 'SAP S/4HANA MM & EWM Consultant',
      linkedin: 'https://www.linkedin.com/in/priya-nair-sap-supply-chain',
      roleType: 'functional',
      nationality: 'India', country: 'in', city: 'Bangalore',
      level: 'Senior', yearsExp: 8, availability: 'Within 30 days',
      languages: ['English'], currency: 'USD', dailyRate: 900,
      summary: 'Materials, warehousing and logistics automation. Delivered S/4HANA supply chain suites for manufacturing and retail clients.',
      cv: { name: 'PriyaNair_MM_CV.pdf', size: '1.1 MB' },
      workPrefs: ['Hybrid'], specialties: ['fit-standard'], otherSkills: [],
      industries: ['Manufacturing & Industrial', 'Retail & Consumer Goods (FMCG)'],
      skills: [
        { productId: 's4onprem', moduleId: 'mm', projects: 14, certified: true },
        { productId: 's4onprem', moduleId: 'ewm', projects: 4 },
        { productId: 's4public', moduleId: 'scm', projects: 2 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-raja', anon: true, firstName: 'Raja', lastName: 'Shankar',
      headline: 'SAP SuccessFactors Employee Central Expert',
      linkedin: 'https://www.linkedin.com/in/raja-shankar-successfactors',
      roleType: 'functional',
      nationality: 'India', country: 'in', city: 'Chennai',
      level: 'Mid', yearsExp: 5, availability: 'Immediate',
      languages: ['English'], currency: 'USD', dailyRate: 650,
      summary: 'HR cloud practitioner — EC implementation, C&E configuration and managed service support for multi-country rollouts.',
      cv: { name: 'RajaShankar_SF_CV.pdf', size: '0.8 MB' },
      workPrefs: ['Remote'], specialties: ['training'], otherSkills: [],
      industries: ['Telecommunications', 'Retail & Consumer Goods (FMCG)'],
      skills: [
        { productId: 'successfactors', moduleId: 'ec', projects: 6, certified: true },
        { productId: 'successfactors', moduleId: 'recruiting', projects: 3 },
        { productId: 'successfactors', moduleId: 'ecp', projects: 2 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-layla', firstName: 'Layla', lastName: 'Haddad',
      headline: 'SAP S/4HANA SD Consultant',
      linkedin: 'https://www.linkedin.com/in/layla-haddad-sap-sd',
      roleType: 'functional',
      nationality: 'Lebanon', country: 'ae', city: 'Dubai',
      level: 'Mid', yearsExp: 6, availability: 'Within 60 days',
      languages: ['English', 'Arabic'], currency: 'USD', dailyRate: 500,
      summary: 'Order-to-cash across retail and distribution. Strong on pricing, output management and S/4HANA migration of sales data.',
      cv: { name: 'LaylaHaddad_SD_CV.pdf', size: '1.0 MB' },
      workPrefs: ['Hybrid'], specialties: ['greenfield'], otherSkills: [],
      industries: ['Retail & Consumer Goods (FMCG)', 'Logistics & Supply Chain'],
      skills: [
        { productId: 's4onprem', moduleId: 'sd', projects: 9, certified: true }
      ],
      savedJobIds: []
    },
    {
      id: 'c-sara', firstName: 'Sara', lastName: 'Al-Farsi',
      headline: 'SAP S/4HANA PP & QM Consultant',
      linkedin: 'https://www.linkedin.com/in/sara-alfarsi-sap-manufacturing',
      roleType: 'functional',
      nationality: 'Oman', country: 'om', city: 'Muscat',
      level: 'Senior', yearsExp: 10, availability: 'Within 30 days',
      languages: ['English', 'Arabic'], currency: 'USD', dailyRate: 650,
      summary: 'Discrete and process manufacturing for energy & metals. Lean + SAP integration, production quality and shop-floor execution.',
      cv: { name: 'SaraAlFarsi_PP_CV.pdf', size: '1.4 MB' },
      workPrefs: ['Hybrid'], specialties: ['ocm'], otherSkills: [],
      industries: ['Oil, Gas & Energy', 'Manufacturing & Industrial'],
      skills: [
        { productId: 's4onprem', moduleId: 'pp', projects: 13, certified: true },
        { productId: 's4onprem', moduleId: 'qm', projects: 4 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-diego', firstName: 'Diego', lastName: 'Fernandes',
      headline: 'SAP Ariba P2P & Sourcing Consultant',
      linkedin: 'https://www.linkedin.com/in/diego-fernandes-sap-ariba',
      roleType: 'functional',
      nationality: 'India', country: 'ae', city: 'Dubai',
      level: 'Mid', yearsExp: 6, availability: 'Immediate',
      languages: ['English', 'French'], currency: 'USD', dailyRate: 450,
      summary: 'Procurement digital transformation: Ariba P2P, source-to-contract and supplier onboarding for large enterprises.',
      cv: { name: 'DiegoFernandes_Ariba_CV.pdf', size: '0.9 MB' },
      workPrefs: ['Remote','Part-time'], specialties: ['value-discovery'], otherSkills: [],
      industries: ['Information Technology (IT)', 'Logistics & Supply Chain'],
      skills: [
        { productId: 'ariba', moduleId: 'buying', projects: 5, certified: true },
        { productId: 'ariba', moduleId: 'sourcing', projects: 3 },
        { productId: 's4onprem', moduleId: 'mm', projects: 2 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-meera', firstName: 'Meera', lastName: 'Iyer',
      headline: 'SAP SuccessFactors Recruiting & Onboarding Consultant',
      linkedin: 'https://www.linkedin.com/in/meera-iyer-sf-recruiting',
      roleType: 'functional',
      nationality: 'India', country: 'in', city: 'Hyderabad',
      level: 'Mid', yearsExp: 4, availability: 'Within 15 days',
      languages: ['English', 'Hindi'], currency: 'USD', dailyRate: 550,
      summary: 'Talent acquisition cloud — RCM builds, offer flows and onboarding bots. Also delivered an LMS migration.',
      cv: { name: 'MeeraIyer_SF_CV.pdf', size: '0.7 MB' },
      workPrefs: ['Remote'], specialties: [], otherSkills: [],
      industries: ['Healthcare & Pharma', 'Information Technology (IT)'],
      skills: [
        { productId: 'successfactors', moduleId: 'recruiting', projects: 5, certified: true },
        { productId: 'successfactors', moduleId: 'onboarding', projects: 4 },
        { productId: 'successfactors', moduleId: 'learning', projects: 2 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-omar', firstName: 'Omar', lastName: 'Farouk',
      headline: 'SAP GRC Access Control Consultant',
      linkedin: 'https://www.linkedin.com/in/omar-farouk-sap-grc',
      roleType: 'functional',
      nationality: 'Egypt', country: 'eg', city: 'Cairo',
      level: 'Senior', yearsExp: 11, availability: 'Within 60 days',
      languages: ['English', 'Arabic'], currency: 'USD', dailyRate: 1000,
      summary: 'Access governance, SoC controls and audit support for banks and regulators. PAM integrations and quarterly reviews.',
      cv: { name: 'OmarFarouk_GRC_CV.pdf', size: '1.3 MB' },
      workPrefs: ['Hybrid'], specialties: [], otherSkills: [],
      industries: ['Banking & Financial Services', 'Public Sector / Government'],
      skills: [
        { productId: 's4onprem', moduleId: 'securitygrc', projects: 9, certified: true }
      ],
      savedJobIds: []
    },
    {
      id: 'c-fatima', firstName: 'Fatima', lastName: 'Al-Qahtani',
      headline: 'SAP S/4HANA FI & CO Consultant',
      linkedin: 'https://www.linkedin.com/in/fatima-alqahtani-sap-fico',
      roleType: 'functional',
      nationality: 'Saudi Arabia', country: 'sa', city: 'Riyadh',
      level: 'Mid', yearsExp: 5, availability: 'Immediate',
      languages: ['Arabic', 'English'], currency: 'USD', dailyRate: 450,
      summary: 'Financials for the Saudi market — VAT, IFRS 16 and S/4HANA activation for a national retailer.',
      cv: { name: 'FatimaAlQahtani_CV.pdf', size: '0.8 MB' },
      workPrefs: ['Remote'], specialties: ['activate'], otherSkills: [],
      industries: ['Retail & Consumer Goods (FMCG)', 'Banking & Financial Services'],
      skills: [
        { productId: 's4onprem', moduleId: 'fi', projects: 4 },
        { productId: 's4onprem', moduleId: 'co', projects: 3 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-rahul', firstName: 'Rahul', lastName: 'Verma',
      headline: 'SAP Data & Analytics Architect — Datasphere, SAC & BTP',
      linkedin: 'https://www.linkedin.com/in/rahul-verma-sap-data',
      roleType: 'architect',
      nationality: 'India', country: 'in', city: 'Pune',
      level: 'Senior', yearsExp: 9, availability: 'Within 90 days',
      languages: ['English'], currency: 'USD', dailyRate: 850,
      summary: 'Data & analytics delivery: Datasphere landscapes, SAC stories and planning for clients retiring legacy BW. CDS and SAPUI5 front-ends.',
      cv: { name: 'RahulVerma_Datasphere_CV.pdf', size: '1.0 MB' },
      workPrefs: ['Remote'], specialties: ['btp','grow'], otherSkills: [],
      industries: ['Information Technology (IT)', 'Utilities (Power & Water)'],
      skills: [
        { productId: 'data', moduleId: 'datasphere', projects: 5 },
        { productId: 'data', moduleId: 'bistories', projects: 6, certified: true }
      ],
      savedJobIds: []
    },
    {
      id: 'c-nour', firstName: 'Nour', lastName: 'El-Din',
      headline: 'SAP TM & EWM Application Support Lead',
      linkedin: 'https://www.linkedin.com/in/nour-eldeen-sap-logistics',
      roleType: 'support',
      nationality: 'Egypt', country: 'qa', city: 'Doha',
      level: 'Mid', yearsExp: 6, availability: 'Within 30 days',
      languages: ['Arabic', 'English', 'French'], currency: 'USD', dailyRate: 400,
      summary: 'Transport management and warehouse execution for fuel distribution networks across the Gulf.',
      cv: { name: 'NourElDin_TM_CV.pdf', size: '0.9 MB' },
      workPrefs: ['Hybrid'], specialties: ['ams'], otherSkills: [],
      industries: ['Oil, Gas & Energy', 'Logistics & Supply Chain'],
      skills: [
        { productId: 's4onprem', moduleId: 'tm', projects: 6, certified: true },
        { productId: 's4onprem', moduleId: 'ewm', projects: 3 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-anita', firstName: 'Anita', lastName: 'Desai',
      headline: 'SAP CX Sales Consultant',
      linkedin: 'https://www.linkedin.com/in/anita-desai-sap-cx',
      roleType: 'junior',
      nationality: 'India', country: 'in', city: 'Gurgaon',
      level: 'Junior', yearsExp: 3, availability: 'Immediate',
      languages: ['English'], currency: 'USD', dailyRate: 400,
      summary: 'Sales Cloud (C4C) configuration, lead-to-cash flows and service workflows. Eager to grow across CX.',
      cv: { name: 'AnitaDesai_CX_CV.pdf', size: '0.6 MB' },
      workPrefs: ['Part-time'], specialties: [], otherSkills: [],
      industries: ['Retail & Consumer Goods (FMCG)'],
      skills: [
        { productId: 'cx', moduleId: 'salescloud', projects: 3 },
        { productId: 'cx', moduleId: 'servicecloud', projects: 2 }
      ],
      savedJobIds: []
    },
    {
      id: 'c-karim', firstName: 'Karim', lastName: 'Ibrahim',
      headline: 'SAP S/4HANA Public Cloud FICO Consultant',
      linkedin: 'https://www.linkedin.com/in/karim-ibrahim-sap-cloud',
      roleType: 'functional',
      nationality: 'Kuwait', country: 'kw', city: 'Kuwait City',
      level: 'Mid', yearsExp: 5, availability: 'Immediate',
      languages: ['Arabic', 'English'], currency: 'USD', dailyRate: 500,
      summary: 'Public cloud financials for manufacturing — activation, custom extensions and quarterly release upgrades.',
      cv: { name: 'KarimIbrahim_CloudFICO_CV.pdf', size: '0.9 MB' },
      workPrefs: ['Remote'], specialties: ['grow'], otherSkills: [],
      industries: ['Manufacturing & Industrial', 'Utilities (Power & Water)'],
      skills: [
        { productId: 's4public', moduleId: 'fico', projects: 3 },
        { productId: 's4onprem', moduleId: 'fi', projects: 9, certified: true }
      ],
      savedJobIds: []
    },
    {
      id: 'c-max', firstName: 'Max', lastName: 'Mueller',
      headline: 'SAP S/4HANA FICO Consultant (EN)',
      linkedin: 'https://www.linkedin.com/in/max-mueller-sap-fico',
      roleType: 'functional',
      nationality: 'Germany', country: 'ae', city: 'Dubai',
      level: 'Senior', yearsExp: 10, availability: 'Within 15 days',
      languages: ['English', 'French'], currency: 'USD', dailyRate: 1300,
      summary: 'HGB+IFRS dual reporting, group consolidation and S/4HANA migration for European multinationals with Gulf operations.',
      cv: { name: 'MaxMueller_FICO_CV.pdf', size: '1.1 MB' },
      workPrefs: ['Remote','Part-time'], specialties: ['brownfield'], otherSkills: ['HGB to IFRS conversion','Group consolidation'],
      industries: ['Banking & Financial Services', 'Healthcare & Pharma'],
      skills: [
        { productId: 's4onprem', moduleId: 'fi', projects: 14, certified: true },
        { productId: 's4onprem', moduleId: 'co', projects: 4, certified: true },
        { productId: 'btp', moduleId: 'abapcloud', projects: 2 }
      ],
      savedJobIds: []
    }
  ];

  const companies = [
    {
      id: 'co-crescent', name: 'Crescent Bank',
      industry: 'Banking & Financial Services', size: '1001-5000',
      country: 'ae', city: 'Dubai', website: 'crescentbank.ae',
      about: 'A leading regional retail and corporate bank, mid-way through its S/4HANA core conversion programme.',
      sapSystems: ['s4onprem', 'data'],
      contactName: 'Hala Al Suwaidi', contactTitle: 'Talent Partner'
    },
    {
      id: 'co-nexus', name: 'Nexus Digital India',
      industry: 'Information Technology (IT)', size: '501-1000',
      country: 'in', city: 'Bangalore', website: 'nexusdigital.in',
      about: 'SAP delivery partner focused on finance, HR cloud and procurement for global clients with APAC and Gulf offices.',
      sapSystems: ['s4onprem', 'successfactors', 'ariba', 'data'],
      contactName: 'Arjun Mehta', contactTitle: 'Practice Head'
    },
    {
      id: 'co-royal', name: 'Royal Energy Group',
      industry: 'Oil, Gas & Energy', size: '5000+',
      country: 'sa', city: 'Riyadh', website: 'royalenergy.sa',
      about: 'Upstream and midstream group running one of the Kingdom\'s largest SAP landscapes, now consolidating onto S/4HANA.',
      sapSystems: ['s4onprem', 'data'],
      contactName: 'Sara Al-Otaibi', contactTitle: 'HR Director'
    },
    {
      id: 'co-mena-retail', name: 'Mena Retail Group',
      industry: 'Retail & Consumer Goods (FMCG)', size: '1001-5000',
      country: 'ae', city: 'Dubai', website: 'mena-retail.com',
      about: 'Multi-brand retailer and wholesaler with 300+ stores, digitising HR and customer commerce on SAP.',
      sapSystems: ['s4onprem', 'successfactors', 'cx', 'data'],
      contactName: 'Omar Zaki', contactTitle: 'Head of Digital'
    },
    {
      id: 'co-indus', name: 'Indus Software House',
      industry: 'Information Technology (IT)', size: '51-200',
      country: 'in', city: 'Pune', website: 'indushouse.in',
      about: 'Boutique SAP boutique serving mid-market manufacturers — ECC care and cloud-first upgrades.',
      sapSystems: ['ecc', 's4public', 'successfactors'],
      contactName: 'Neha Kulkarni', contactTitle: 'Founder'
    },
    {
      id: 'co-dune', anon: true, name: 'Dune Cloud Solutions',
      industry: 'Consulting & Professional Services', size: '201-500',
      country: 'qa', city: 'Doha', website: 'dunecloud.qa',
      about: 'SAP public-cloud specialist (S/4HANA Public Cloud, SAC, BTP) helping Gulf enterprises leapfrog classic stacks.',
      sapSystems: ['s4public', 'data', 'btp'],
      contactName: 'Bilal Choudhury', contactTitle: 'CTO'
    },
    {
      id: 'co-siwa', name: 'Siwa Telecom',
      industry: 'Telecommunications', size: '5000+',
      country: 'eg', city: 'Cairo', website: 'siwa-tel.eg',
      about: 'National carrier modernising billing and supply chain on S/4HANA, with a dedicated internal SAP academy.',
      sapSystems: ['s4onprem', 'ariba'],
      contactName: 'Mona Hassan', contactTitle: 'VP People'
    },
    {
      id: 'co-basalt', name: 'Basalt Metals',
      industry: 'Manufacturing & Industrial', size: '501-1000',
      country: 'om', city: 'Muscat', website: 'basalt-metals.om',
      about: 'Aluminium and steel processor running plant-floor SAP; converting from ECC to S/4HANA across two plants.',
      sapSystems: ['s4onprem'],
      contactName: 'Yusuf Al-Hinai', contactTitle: 'Operations Director'
    }
  ];

  const jobs = [
    {
      id: 'j1', title: 'S/4HANA FICO Lead Consultant', companyId: 'co-crescent',
      requires: [ { productId: 's4onprem', moduleId: 'fi', minProjects: 3 }, { productId: 's4onprem', moduleId: 'co' } ],
      industry: 'Banking & Financial Services', certification: 'preferred',
      employmentType: 'Contract', duration: '6 months', city: 'Dubai', country: 'ae', remote: false,
      currency: 'USD', rateMin: 400, rateMax: 600, minExp: 8, languages: ['English', 'Arabic'], preferredSpecialties: ['cutover'],
      description: 'Own the financials workstream for our S/4HANA cutover in Q1 — FI/CO configuration, parallel accounting and cutover testing. You will lead a team of 4 consultants on site in Dubai.',
      postedDaysAgo: 2, applicants: ['c-vikram', 'c-fatima'], status: 'open'
    },
    {
      id: 'j2', title: 'S/4HANA MM Consultant — Supply Chain', companyId: 'co-royal',
      requires: [ { productId: 's4onprem', moduleId: 'mm', minProjects: 3 } ],
      industry: 'Oil, Gas & Energy', certification: '',
      employmentType: 'Contract', duration: '12 months', city: 'Riyadh', country: 'sa', remote: false,
      currency: 'USD', rateMin: 350, rateMax: 550, minExp: 5, languages: ['English'],
      description: 'Materials management for an upstream consolidation: procurement, inventory and production supply flows. Part of a 30-consultant transformation programme.',
      postedDaysAgo: 5, applicants: ['c-priya'], status: 'open'
    },
    {
      id: 'j3', title: 'SuccessFactors Employee Central Consultant', companyId: 'co-mena-retail',
      requires: [ { productId: 'successfactors', moduleId: 'ec', minProjects: 3 }, { productId: 'successfactors', moduleId: 'ecp' } ],
      industry: 'Retail & Consumer Goods (FMCG)', certification: '',
      employmentType: 'Full-time', duration: 'Permanent', city: 'Dubai', country: 'ae', remote: false,
      currency: 'USD', rateMin: 250, rateMax: 400, minExp: 4, languages: ['English'],
      description: 'Lead our HR cloud implementation for 4,000+ employees across the region — Employee Central, payroll (ECP) and integrations.',
      postedDaysAgo: 1, applicants: ['c-raja'], status: 'open'
    },
    {
      id: 'j4', title: 'S/4HANA PP & QM Consultant', companyId: 'co-basalt',
      requires: [ { productId: 's4onprem', moduleId: 'pp', minProjects: 2 }, { productId: 's4onprem', moduleId: 'qm', minProjects: 2 } ],
      industry: 'Manufacturing & Industrial', certification: 'required',
      employmentType: 'Contract', duration: '9 months', city: 'Muscat', country: 'om', remote: false,
      currency: 'USD', rateMin: 300, rateMax: 450, minExp: 5, languages: ['English', 'Arabic'],
      description: 'Production planning and quality for a two-plant metal conversion line, with heavy shop-floor integration and lean practices.',
      postedDaysAgo: 3, applicants: [], status: 'open'
    },
    {
      id: 'j5', title: 'SAP Ariba Procure-to-Pay Consultant', companyId: 'co-siwa',
      requires: [ { productId: 'ariba', moduleId: 'buying', minProjects: 3 } ],
      industry: 'Telecommunications', certification: '',
      employmentType: 'Contract', duration: '6 months', city: 'Cairo', country: 'eg', remote: true,
      currency: 'USD', rateMin: 700, rateMax: 1000, minExp: 4, languages: ['English', 'Arabic'], preferredLangs: ['French'],
      description: 'Extend Ariba P2P to 600+ supplier flows and tune procurement UX. Remote-friendly with occasional travel to our Cairo office.',
      postedDaysAgo: 4, applicants: ['c-diego'], status: 'open'
    },
    {
      id: 'j6', title: 'S/4HANA SD Consultant (Freelance)', companyId: 'co-dune',
      requires: [ { productId: 's4public', moduleId: 'sd', minProjects: 2 } ],
      industry: '', certification: '',
      employmentType: 'Freelance', duration: '4 months', city: 'Doha', country: 'qa', remote: true,
      currency: 'USD', rateMin: 250, rateMax: 400, minExp: 3, languages: ['English'],
      description: 'Order-to-cash configuration for a public-cloud S/4HANA tenant for a fuel retailer. Fully remote, Qatari business hours.',
      postedDaysAgo: 7, applicants: [], status: 'open'
    },
    {
      id: 'j7', title: 'GRC Access Control Consultant', companyId: 'co-crescent',
      requires: [ { productId: 's4onprem', moduleId: 'securitygrc', minProjects: 3 } ],
      industry: 'Banking & Financial Services', certification: 'required',
      employmentType: 'Contract', duration: '12 months', city: 'Dubai', country: 'ae', remote: false,
      currency: 'USD', rateMin: 350, rateMax: 500, minExp: 6, languages: ['English', 'Arabic'],
      description: 'Regulator-driven access governance: quarterly access reviews, risk-based roles and SoC testing across our S/4HANA landscape.',
      postedDaysAgo: 6, applicants: ['c-omar'], status: 'open'
    },
    {
      id: 'j8', title: 'SAP Datasphere Developer', companyId: 'co-nexus',
      requires: [ { productId: 'data', moduleId: 'datasphere', minProjects: 3 }, { productId: 'data', moduleId: 'bistories' } ],
      industry: 'Information Technology (IT)', certification: '',
      employmentType: 'Full-time', duration: 'Permanent', city: 'Bangalore', country: 'in', remote: true,
      currency: 'USD', rateMin: 500, rateMax: 800, minExp: 5, languages: ['English'],
      description: 'Modernise client analytics onto SAP Datasphere and SAC — data models, designer content and stories. Hybrid work from our Bangalore hub, client travel ~20%.',
      postedDaysAgo: 3, applicants: ['c-rahul'], status: 'open'
    },
    {
      id: 'j9', title: 'S/4HANA Public Cloud FICO Consultant', companyId: 'co-dune',
      requires: [ { productId: 's4public', moduleId: 'fico', minProjects: 2 } ],
      industry: 'Logistics & Supply Chain', certification: '',
      employmentType: 'Contract', duration: '6 months', city: 'Doha', country: 'qa', remote: false,
      currency: 'USD', rateMin: 300, rateMax: 450, minExp: 4, languages: ['English'], preferredSpecialties: ['grow'],
      description: 'Activate and extend public-cloud financials for a logistics client — including quarterly release upgrades and BTP side builds.',
      postedDaysAgo: 2, applicants: ['c-karim'], status: 'open'
    },
    {
      id: 'j10', title: 'SuccessFactors Recruiting Consultant (Freelance)', companyId: 'co-indus',
      requires: [ { productId: 'successfactors', moduleId: 'recruiting', minProjects: 2 }, { productId: 'successfactors', moduleId: 'onboarding' } ],
      industry: 'Information Technology (IT)', certification: 'preferred',
      employmentType: 'Freelance', duration: '3 months', city: 'Pune', country: 'in', remote: true,
      currency: 'USD', rateMin: 350, rateMax: 550, minExp: 2, languages: ['English'],
      description: 'Build RCM and onboarding flows for a mid-market client, then hand over to their internal team. 100% remote.',
      postedDaysAgo: 1, applicants: ['c-meera', 'c-raja'], status: 'open'
    },
    {
      id: 'j11', title: 'ECC → S/4HANA FICO Migration Consultant', companyId: 'co-siwa',
      requires: [ { productId: 'ecc', moduleId: 'fi', minProjects: 3 }, { productId: 's4onprem', moduleId: 'fi', minProjects: 5 } ],
      industry: 'Telecommunications', certification: 'preferred',
      employmentType: 'Contract', duration: '18 months', city: 'Cairo', country: 'eg', remote: false,
      currency: 'USD', rateMin: 800, rateMax: 1200, minExp: 6, languages: ['English', 'Arabic'], preferredLangs: ['French'], preferredSpecialties: ['brownfield'],
      description: 'Long-horizon migration of 15 years of ECC financials to S/4HANA — data cleansing, parallel runs, cutover. Arabic a strong plus.',
      postedDaysAgo: 1, applicants: ['c-vikram', 'c-fatima', 'c-karim'], status: 'open'
    },
    {
      id: 'j12', title: 'SAP TM / EWM Logistics Consultant', companyId: 'co-royal',
      requires: [ { productId: 's4onprem', moduleId: 'ewm', minProjects: 2 }, { productId: 's4onprem', moduleId: 'tm' } ],
      industry: 'Oil, Gas & Energy', certification: '',
      employmentType: 'Contract', duration: '12 months', city: 'Riyadh', country: 'sa', remote: false,
      currency: 'USD', rateMin: 350, rateMax: 500, minExp: 5, languages: ['English'],
      description: 'Transport and warehouse execution for our fuel distribution network — fleet, routing and EWM integration with S/4HANA.',
      postedDaysAgo: 8, applicants: ['c-nour', 'c-priya'], status: 'open'
    }
  ];

  const conversations = [
    {
      id: 'cv-1', cId: 'c-ahmed', eId: 'co-crescent', jobId: 'j1', botReplyUsed: false,
      messages: [
        { side: 'e', text: 'Hi Ahmed, we\'re kicking off our S/4HANA cutover in Q1. Your profile looks strong on FICO — are you available for a 6-month contract in Dubai?', ts: now - 26 * H },
        { side: 'c', text: 'Hi Hala, thanks for reaching out. Yes, I\'m available immediately — I led a similar cutover for a regional bank last year.', ts: now - 24 * H },
        { side: 'e', text: 'Great. Could you share your CV so I can forward it to the project lead?', ts: now - 22 * H },
        { side: 'c', text: 'Attaching my CV now — it covers the bank cutover in detail.', ts: now - 21 * H, cv: true }
      ],
      unread: { c: 1, e: 0 }, lastTs: now - 20 * H
    },
    {
      id: 'cv-2', cId: 'c-vikram', eId: 'co-nexus', jobId: 'j23', botReplyUsed: false,
      messages: [
        { side: 'e', text: 'Hi Vikram, we\'re scaling our S/4HANA financials practice and your profile stood out. Open to a quick call this week?', ts: now - 5 * H }
      ],
      unread: { c: 1, e: 0 }, lastTs: now - 5 * H
    },
    {
      id: 'cv-3', cId: 'c-ahmed', eId: 'co-royal', jobId: 'j2', botReplyUsed: false,
      messages: [
        { side: 'e', text: 'Hi Ahmed, your MM + EWM background could fit our Riyadh supply chain programme. Do you have a preferred rate band for Saudi roles?', ts: now - 2 * H }
      ],
      unread: { c: 1, e: 0 }, lastTs: now - 2 * H
    }
  ];

  const questions = [
    {
      id: 'q1', authorId: 'c-vikram',
      title: 'After 15 years of ECC FI/CO history, what is the sanest S/4HANA cutover path?',
      body: 'We run ECC 6.0 with a thin custom code base, and the board wants an S/4HANA go-live by 2027. DMO, blue-green, or digital coexistence — what do you actually recommend at mid-market scale, and what surprises teams most at cutover?',
      productId: 's4onprem', moduleId: 'fi',
      createdTs: now - 5 * D, upvotes: 12, upvotedBy: ['c-ahmed', 'c-max', 'c-karim'],
      answers: [
        { id: 'q1a1', authorId: 'c-ahmed', body: 'Digital coexistence only if you\'re forced by legacy interfaces. Otherwise DMO with 2–3 parallel runs; start cleansing open items 6 months ahead — dirty open items are what blow up cutover, not the config.', createdTs: now - 2 * D, upvotes: 9, upvotedBy: ['c-vikram', 'c-fatima', 'c-max'], accepted: true },
        { id: 'q1a2', authorId: 'c-karim', body: 'If your custom code base is thin, a greenfield on Public Cloud FICO beat a DMO on cost for a mid-market client last year — check the custom delta before you commit.', createdTs: now - 3 * D, upvotes: 3, upvotedBy: ['c-vikram'], accepted: false }
      ]
    },
    {
      id: 'q2', authorId: 'c-sara',
      title: 'ECC IS-Retail → S/4HANA: how painful is the merchandise management migration really?',
      body: 'Retail landscape on ECC with IS-Retail for a hundred-plus stores. Config-wise the swap to S/4HANA MM looks simple, but we carry 10 years of assortment, pricing and location history. How painful is the merchandise data migration in practice?',
      productId: 'industry', moduleId: 'isretail',
      createdTs: now - 9 * D, upvotes: 8, upvotedBy: ['c-diego', 'c-priya'],
      answers: [
        { id: 'q2a1', authorId: 'c-diego', body: 'Config-level it\'s a swap (MM takes over). The real pain is the history: 10 years of assortment and location data. We archived everything before the last 12 months and the load went from 3 weeks to 3 days.', createdTs: now - 4 * D, upvotes: 7, upvotedBy: ['c-sara', 'c-priya'], accepted: true }
      ]
    },
    {
      id: 'q3', authorId: 'c-karim',
      title: 'SuccessFactors EC + on-prem payroll: what is the actually-recommended hybrid architecture now?',
      body: 'We have SuccessFactors Employee Central live in three countries, payroll still on ECC ECP. What is the recommended hybrid architecture now — keep ECP reading from ECC, or go cloud ECP? Country coverage is our sticking point.',
      productId: 'successfactors', moduleId: 'ecp',
      createdTs: now - 12 * D, upvotes: 11, upvotedBy: ['c-meera', 'c-rahul', 'c-raja'],
      answers: [
        { id: 'q3a1', authorId: 'c-meera', body: 'ECP on ECC reading from SF EC is still the mainstream pattern. Check the cloud ECP country coverage for your countries first — if all your pays are covered, go cloud ECP and drop ECC payroll entirely.', createdTs: now - 6 * D, upvotes: 8, upvotedBy: ['c-karim', 'c-rahul'], accepted: true },
        { id: 'q3a2', authorId: 'c-rahul', body: 'One caution: if you later move to Datasphere for payroll analytics, the on-prem ECP bridge becomes a permanent integration tax.', createdTs: now - 8 * D, upvotes: 2, upvotedBy: ['c-karim'], accepted: false }
      ]
    },
    {
      id: 'q4', authorId: 'co-siwa',
      title: 'Hiring a FICO consultant for our billing + S/4HANA conversion — what should they prove in the first 90 days?',
      body: 'We are hiring a FICO consultant for our S/4HANA conversion, which includes a billing modernisation. What should a candidate prove in the first 90 days for you to trust them with the cutover workstream?',
      productId: 's4onprem', moduleId: 'fi',
      createdTs: now - 7 * D, upvotes: 15, upvotedBy: ['c-vikram', 'c-fatima', 'c-ahmed'],
      answers: [
        { id: 'q4a1', authorId: 'c-vikram', body: 'Three things: (1) a conversion readiness assessment of your FI data within 30 days — not a generic deck, actual exception reports. (2) A data-cleansing KPI they can drive down monthly. (3) A parallel close they own end-to-end. Anyone who can deliver those three is worth their rate.', createdTs: now - 3 * D, upvotes: 10, upvotedBy: ['co-siwa', 'c-ahmed', 'c-karim'], accepted: true },
        { id: 'q4a2', authorId: 'c-fatima', body: 'Add a cutover weekend shadow — watch them run one. You\'ll know in a day if they\'ve ever actually cut over.', createdTs: now - 2 * D, upvotes: 4, upvotedBy: ['c-vikram'], accepted: false }
      ]
    },
    {
      id: 'q5', authorId: 'c-fatima',
      title: 'GRC Access Control: separate system or on the S/4HANA stack? And certification campaign gotchas in the GCC?',
      body: 'Deciding where to put GRC Access Control — a separate system or on the S/4HANA stack — and planning a certification campaign across the Kingdom. Which has served you better, and what are the GCC-specific gotchas?',
      productId: 's4onprem', moduleId: 'securitygrc',
      createdTs: now - 15 * D, upvotes: 9, upvotedBy: ['c-omar', 'c-ahmed'],
      answers: [
        { id: 'q5a1', authorId: 'c-omar', body: 'Stack choice matters less than the certification process. Our CBA (critical business actions) definitions did the heavy lifting, not the tool version. GCC gotcha: regulators increasingly want the audit trail in-country — check where GRC stores its evidence before you size the deployment.', createdTs: now - 5 * D, upvotes: 6, upvotedBy: ['c-fatima', 'c-ahmed'], accepted: true }
      ]
    },
    {
      id: 'q6', authorId: 'c-priya',
      title: 'Embedded S/4HANA EWM vs decentralized (DM) — 3 warehouses, mostly batch. What did you pick and why?',
      body: 'Three warehouses, mostly batch processes, no high-velocity picking. Do you embed EWM in S/4HANA or go decentralized? Curious what people at our scale actually pick and why.',
      productId: 's4onprem', moduleId: 'ewm',
      createdTs: now - 18 * D, upvotes: 7, upvotedBy: ['c-nour', 'c-diego'],
      answers: [
        { id: 'q6a1', authorId: 'c-nour', body: 'Embedded at that scale. DM only pays off with many sites, 24/7 wave execution and a big WCS team. Three batch warehouses: embedded — less integration surface, cheaper to run.', createdTs: now - 8 * D, upvotes: 5, upvotedBy: ['c-priya', 'c-ahmed'], accepted: true },
        { id: 'q6a2', authorId: 'c-diego', body: 'Agreed — and one more: if you later add a cross-dock or a DC with high-velocity picks, you can start DM there without touching the others.', createdTs: now - 10 * D, upvotes: 2, upvotedBy: ['c-priya'], accepted: false }
      ]
    },
    {
      id: 'q7', authorId: 'c-nour',
      title: 'TM routing in GCC fuel distribution — carrier onboarding is painful. Any patterns that worked?',
      body: 'Fuel distribution across the Gulf — our TM rollout keeps hitting the same wall: carrier onboarding. New carrier, new two weeks of calls and spreadsheet mapping. Anyone got a pattern that made onboarding a checklist instead of an event?',
      productId: 's4onprem', moduleId: 'tm',
      createdTs: now - 20 * D, upvotes: 10, upvotedBy: ['c-rahul', 'c-priya'],
      answers: [
        { id: 'q7a1', authorId: 'c-rahul', body: 'Two things fixed it for us: (1) deterministic routing — no AI magic, just rule-based segments by commodity/weight so planners trust it; (2) load types per commodity with a carrier confirmation step before dispatch. Onboarding a new carrier went from 2 weeks of calls to a checklist.', createdTs: now - 10 * D, upvotes: 6, upvotedBy: ['c-nour', 'c-priya'], accepted: true }
      ]
    },
    {
      id: 'q8', authorId: 'c-raja',
      title: 'SuccessFactors Employee Central rollout across three Gulf countries: which localizations actually exist for payroll?',
      body: 'Rolling out Employee Central across three Gulf countries next year. HR-data localisation seems covered, but which localisations actually exist for payroll, and where do you run into "check with your partner" answers?',
      productId: 'successfactors', moduleId: 'ec',
      createdTs: now - 25 * D, upvotes: 13, upvotedBy: ['c-meera', 'c-diego', 'c-ahmed'],
      answers: [
        { id: 'q8a1', authorId: 'c-meera', body: 'SF EC localizations cover HR data and leave differently per country — KSA has the deepest package (WPS, Iqama fields are there). For payroll itself, budget the ECP per-country check: Saudi and UAE are covered, but Oman we ran on ECC ECP. Always verify the exact country+payroll combo before you promise a timeline.', createdTs: now - 11 * D, upvotes: 9, upvotedBy: ['c-raja', 'c-diego'], accepted: true }
      ]
    },
    {
      id: 'q9', authorId: 'c-omar',
      title: 'ABAP: what is the realistic effort to prep custom code for S/4HANA? Our ATC run came back with 4,000 findings.',
      body: 'ATC for S/4HANA came back with 4,000 findings across our custom code. Before we budget the rework — how do you realistically triage this? And what does the effort usually look like per 1,000 findings?',
      productId: 's4onprem', moduleId: 'abap',
      createdTs: now - 30 * D, upvotes: 14, upvotedBy: ['c-max', 'c-diego', 'c-ahmed', 'c-vikram'],
      answers: [
        { id: 'q9a1', authorId: 'c-max', body: 'Don\'t budget per finding. Triage by severity + usage first — in our last two conversions 80% of findings were noise (deprecated syntax nobody calls). What remains is usually 3–6 weeks of rework per 1,000 *used* procedures, not per finding. And plan 2–3× your naive estimate for the rewrite.', createdTs: now - 14 * D, upvotes: 8, upvotedBy: ['c-omar', 'c-diego', 'c-vikram'], accepted: true },
        { id: 'q9a2', authorId: 'c-diego', body: 'Also: run the usage check (SCU) before the ATC even. We deleted 200+ unused objects and the ATC count halved for free.', createdTs: now - 18 * D, upvotes: 3, upvotedBy: ['c-omar'], accepted: false }
      ]
    },
    {
      id: 'q10', authorId: 'co-indus',
      title: 'Still on ECC 6.0: should we care about SAP\'s extended maintenance pricing after 2027?',
      body: 'We still run ECC 6.0 for a mid-market client, and the extended maintenance pricing after 2027 just landed. Should we treat this as a conversion trigger, or is there a sane middle path?',
      productId: 'ecc', moduleId: 'fi',
      createdTs: now - 35 * D, upvotes: 16, upvotedBy: ['c-vikram', 'c-priya', 'c-ahmed'],
      answers: [
        { id: 'q10a1', authorId: 'c-vikram', body: 'Yes — treat it as the forcing function it is. Extended maintenance is priced to push you off, and it compounds yearly. Model three scenarios (convert / extend / hybrid) and let the 2027–2028 line items decide. Most clients we model land on conversion.', createdTs: now - 16 * D, upvotes: 11, upvotedBy: ['co-indus', 'c-priya', 'c-max'], accepted: true },
        { id: 'q10a2', authorId: 'c-priya', body: 'If the full conversion is too big for your budget, the phased module-by-module approach (FI/CO first, then the rest) keeps the extended-maintenance exposure down where it matters least.', createdTs: now - 15 * D, upvotes: 5, upvotedBy: ['c-vikram'], accepted: false }
      ]
    },
    {
      id: 'q11', authorId: 'c-anita',
      title: 'Ariba Sourcing feeding S/4HANA P2P: the two integration pain points we always hit',
      body: 'Integrating Ariba Sourcing with S/4HANA P2P for a retail client. We keep hitting the same two pain points — field mismatches in source-to-contract data, and version drift between integration releases. Anyone have patterns that dodged both?',
      productId: 'ariba', moduleId: 'sourcing',
      createdTs: now - 28 * D, upvotes: 8, upvotedBy: ['c-diego', 'c-rahul'],
      answers: [
        { id: 'q11a1', authorId: 'c-diego', body: 'You\'ll be glad to hear both are avoidable. (1) Source-to-contract data lands in S/4 with field mismatches — map the Ariba item fields to your PO segments early, don\'t wait for integration week. (2) The S/4HANA Ariba integration suite (not the old RFC) handles 90% of the flows out of the box — only build custom for the real gaps.', createdTs: now - 12 * D, upvotes: 7, upvotedBy: ['c-anita', 'c-rahul', 'c-meera'], accepted: true },
        { id: 'q11a2', authorId: 'c-rahul', body: 'Adding: keep the Sourcing event log accessible to your S/4 team during cutover — half our "data errors" were Sourcing-side and invisible until we compared timestamps.', createdTs: now - 20 * D, upvotes: 2, upvotedBy: ['c-anita'], accepted: false }
      ]
    },
    {
      id: 'q12', authorId: 'c-diego',
      title: 'BTP: when does "side-by-side" extension actually beat embedded ABAP on S/4HANA?',
      body: 'The BTP vs embedded ABAP debate again. When does side-by-side extension on BTP actually beat an embedded extension on S/4HANA — and when do teams put it on BTP by mistake?',
      productId: 'btp', moduleId: 'integration',
      createdTs: now - 40 * D, upvotes: 9, upvotedBy: ['c-max', 'c-rahul'],
      answers: [
        { id: 'q12a1', authorId: 'c-max', body: 'Rule of thumb: if the extension needs its own release cycle, its own scale, or talks to a third party — BTP. If it\'s a UI or logic change that must stay transactionally consistent with S/4HANA — embedded, every time. The day you find yourself versioning a side app in lockstep with an S/4 release, you put it on BTP by mistake.', createdTs: now - 19 * D, upvotes: 6, upvotedBy: ['c-diego', 'c-rahul'], accepted: true }
      ]
    },
    {
      id: 'q13', authorId: 'c-ahmed',
      title: 'MM: 15 years of purchase history — what do we actually bring into S/4HANA?',
      body: '15 years of purchase history, open POs, GR/IR and a fairly rich vendor master heading into S/4HANA. What do you actually bring across, and what do you archive instead?',
      productId: 's4onprem', moduleId: 'mm',
      createdTs: now - 4 * D, upvotes: 10, upvotedBy: ['c-priya', 'c-nour', 'c-diego'],
      answers: [
        { id: 'q13a1', authorId: 'c-priya', body: 'Open POs + GR/IR, and the last 2–3 years of purchase history for condition and MRP relevance. Everything older: archive, don\'t migrate. We brought 18 months for a client with heavy consignment, and their MRP was happy with it. Full 15-year history will only slow you down and hurt nothing.', createdTs: now - 2 * D, upvotes: 8, upvotedBy: ['c-ahmed', 'c-nour', 'c-diego'], accepted: true },
        { id: 'q13a2', authorId: 'c-nour', body: 'Same here — plus: bring the vendor master with its full address/history, but let S/4 re-validate bank details at cutover. Old bank info is where funds-payment surprises live.', createdTs: now - 3 * D, upvotes: 3, upvotedBy: ['c-ahmed', 'c-priya'], accepted: false }
      ]
    },
    {
      id: 'qo1', authorId: 'c-layla',
      title: 'Public Cloud FICO: how do you handle a second ledger for local GAAP without custom code?',
      body: 'Group reports in IFRS but the Saudi entity needs local GAAP statements. In S/4HANA Cloud Public Edition, is a parallel ledger with a different fiscal-year variant realistic, or do people end up reporting outside SAP? Looking for what worked in practice.',
      productId: 's4public', moduleId: 'fico',
      createdTs: now - 2 * D, upvotes: 2, upvotedBy: ['c-sara', 'c-meera'],
      answers: []
    },
    {
      id: 'qo2', authorId: 'c-raja',
      title: 'SuccessFactors Employee Central: best way to migrate 8 years of job-history data?',
      body: 'About 4,000 employees with a long history of position and compensation changes. Should we load everything with effective-dated records, or only the last two years and archive the rest? What did the loads cost in time?',
      productId: 'successfactors', moduleId: 'ec',
      createdTs: now - 1 * D, upvotes: 1, upvotedBy: ['c-priya'],
      answers: []
    },
    {
      id: 'qo3', authorId: 'c-diego',
      title: 'Ariba + S/4HANA: which integration option for a mid-size company that is not on BTP yet?',
      body: 'We want Ariba Buying and Invoicing against S/4HANA Private Cloud. Is SAP Integration Suite really required, or is there a lighter path for a first phase? Interested in cost and what you would avoid.',
      productId: 'ariba', moduleId: 'buying',
      createdTs: now - 6 * H, upvotes: 0, upvotedBy: [],
      answers: []
    },
    {
      id: 'qo4', authorId: 'co-siwa', topic: 'new-to-sap', productId: '', moduleId: '',
      title: 'We are a 300-person distributor on spreadsheets and QuickBooks — where do we even start with SAP?',
      body: 'Management wants a real ERP in the next 18 months. We have no SAP knowledge in-house. Is the right first step a partner, a fit-gap workshop, or picking the product first? What would you have wanted to know before signing anything?',
      createdTs: now - 3 * D, upvotes: 6, upvotedBy: ['c-ahmed', 'c-max', 'c-karim', 'c-priya', 'c-vikram', 'c-omar'], milestone: 5,
      answers: [
        { id: 'qo4a1', authorId: 'c-ahmed', body: 'Start with the business case and process list, not the product. A 2–3 day fit-gap workshop against your top 20 processes will tell you quickly whether Public Cloud covers you or whether you need Private. Decide the product after that, then pick a partner who has done your industry — ask for references at your size.', createdTs: now - 3 * D + 4 * H, upvotes: 4, upvotedBy: ['c-max', 'c-karim', 'co-siwa', 'c-priya'], accepted: true },
        { id: 'qo4a2', authorId: 'c-vikram', body: 'Also budget for data migration and change management — they are usually the real cost, not the licences.', createdTs: now - 2 * D, upvotes: 2, upvotedBy: ['c-ahmed', 'co-siwa'], accepted: false }
      ]
    },
    {
      id: 'qo5', authorId: 'co-indus', topic: 'partners', productId: '', moduleId: '',
      title: 'How do you vet an implementation partner for a first S/4HANA project?',
      body: 'We have three proposals with very different day rates. Beyond references, what should we check — team seniority, fixed price vs time-and-materials, who actually does the work? Looking for what went wrong for you, not marketing.',
      createdTs: now - 18 * H, upvotes: 1, upvotedBy: ['c-diego'],
      answers: []
    },
    {
      id: 'qo6', authorId: 'c-layla', anonymous: true, topic: 'career', productId: '', moduleId: '',
      title: 'Is it a good time to leave a permanent SAP job and go freelance in the Gulf?',
      body: 'I have 8 years of experience and one S/4HANA certification. A client offered a 6-month contract at roughly double my salary, but I worry about gaps between projects and visas. How did you decide, and what would you check first?',
      createdTs: now - 2 * D, upvotes: 3, upvotedBy: ['c-sara', 'c-nour', 'c-raja'],
      answers: [
        { id: 'qo6a1', authorId: 'c-max', body: 'Keep six months of living costs saved, and check how the visa works for contractors in your country before you resign. Many people in the Gulf start by taking contracts through a local agency while keeping the option of going back to a permanent role.', createdTs: now - 1 * D, upvotes: 2, upvotedBy: ['c-sara', 'c-nour'], accepted: false }
      ]
    }
  ];

  const articles = [
    {
      id: 'a1', authorId: 'c-vikram',
      title: 'The five things we wish we\'d prepared before our S/4HANA cutover weekend',
      url: 'https://sapfieldnotes.example/s4hana-cutover-checklist',
      body: 'Short version: open items, clean master data, a rehearsed rollback, a named owner for every ticket, and a freeze on changes two weeks prior. The cutover itself is the easy part — everything before it is the real work.',
      productId: 's4onprem', moduleId: 'fi',
      createdTs: now - 3 * D, upvotes: 21, upvotedBy: ['c-ahmed', 'c-max', 'c-karim', 'c-fatima'],
      comments: [
        { id: 'a1c1', authorId: 'c-max', body: 'Good list. I would add a dry run of the interface cut-over with the business users, not just IT — that is where most of our surprises came from.', createdTs: now - 2 * D },
        { id: 'a1c2', authorId: 'c-karim', body: 'Agreed on the change freeze. We also froze new custom reports two weeks before and it saved a lot of last-minute testing.', createdTs: now - 1 * D }
      ]
    },
    {
      id: 'a2', authorId: 'c-ahmed',
      title: 'What SAP\'s ECC extended maintenance really means for your 2026 budget',
      url: 'https://sapfieldnotes.example/ecc-extended-maintenance-budget',
      body: 'Extended maintenance is priced to be an argument, not an option. It\'s the line item that finally gets the board to fund the conversion — read the pricing page, do the 3-year math, and bring that number to your next budget meeting.',
      productId: 'ecc', moduleId: 'co',
      createdTs: now - 6 * D, upvotes: 18, upvotedBy: ['c-vikram', 'c-omar']
    },
    {
      id: 'a3', authorId: 'c-meera',
      title: 'SuccessFactors vs Workday in the Gulf — what we\'ve seen after four rollouts',
      url: 'https://sapfieldnotes.example/sf-vs-workday-gulf',
      body: 'Localizations, payroll coverage and integration with existing on-prem stacks tilt most Gulf public-sector deals to SuccessFactors; Workday wins the younger, cloud-native private ones. The honest answer for your shortlist: it depends on your payroll countries and your existing HCM.',
      productId: 'successfactors', moduleId: 'ec',
      createdTs: now - 9 * D, upvotes: 16, upvotedBy: ['c-raja', 'c-rahul']
    },
    {
      id: 'a4', authorId: 'c-max',
      title: 'A field guide to the ATC checks that actually bite in S/4HANA',
      url: 'https://sapfieldnotes.example/atc-field-guide',
      body: 'ABAP Test Cockpit findings are grouped by how much they\'ll hurt you. The ones that actually block cutover are a short list — dynamic SQL into changed tables, BAPIs that lost their signatures, and a few OData quirks. Triage by severity, not by count.',
      productId: 's4onprem', moduleId: 'abap',
      createdTs: now - 12 * D, upvotes: 19, upvotedBy: ['c-omar', 'c-vikram', 'c-ahmed']
    },
    {
      id: 'a5', authorId: 'c-karim',
      title: 'S/4HANA Public Cloud: the six things you can\'t do (and the workarounds that do)',
      url: 'https://sapfieldnotes.example/public-cloud-limitations',
      body: 'You can\'t extend the standard the old way, you can\'t choose your own release cadence, and a few classic FI tricks have no switch. Here\'s how each of the six limitations is actually worked around in production — and which ones should make you stay on private cloud.',
      productId: 's4public', moduleId: 'fico',
      createdTs: now - 18 * D, upvotes: 14, upvotedBy: ['c-max', 'c-rahul']
    },
    {
      id: 'a6', authorId: 'c-rahul',
      title: 'Datasphere vs SAC data models: what we learned migrating 120 BW queries',
      url: 'https://sapfieldnotes.example/datasphere-sac-migration',
      body: 'Datasphere for the semantic layer and reusable flows, SAC for the front end. The migration taught us the models matter less than the ownership model — every query needs a named owner in Datasphere or it rots within a release.',
      productId: 'data', moduleId: 'datasphere',
      createdTs: now - 22 * D, upvotes: 12, upvotedBy: ['c-vikram', 'c-ahmed']
    },
    {
      id: 'a7', authorId: 'c-layla',
      title: 'Commerce Cloud on C/4HANA: what the S/4HANA backend actually needs',
      url: 'https://sapfieldnotes.example/cx-backend-prep',
      body: 'The storefront gets the attention; the backend does the work. Price determination, availability and return flows have to be clean in S/4HANA before you integrate — we fixed 14 backend issues the storefront would have otherwise "solved" with workarounds.',
      productId: 'cx', moduleId: 'commercecloud',
      createdTs: now - 26 * D, upvotes: 9, upvotedBy: ['c-anita', 'c-raja']
    },
    {
      id: 'a8', authorId: 'c-anita',
      title: 'Business One for a 40-person trading company: the six modules we skipped',
      url: 'https://sapfieldnotes.example/business-one-trading',
      body: 'Not every Business One license needs every module. For a trading company we switched off Production, Maintenance, HR\'s advanced views and three others — same price, half the clicks, and the team actually uses it now.',
      productId: 'businessone', moduleId: 'inventoryproduction',
      createdTs: now - 33 * D, upvotes: 6, upvotedBy: ['c-meera', 'c-diego']
    }
  ];

  const notifications = {
    'c-ahmed': [
      { id: 'n1', type: 'job', text: 'Crescent Bank posted "S/4HANA FICO Lead Consultant" — strong match with your profile', ts: now - 2 * D, read: false, link: '#/c/jobs'},
      { id: 'n2', type: 'msg', text: 'Hala Al Suwaidi (Crescent Bank) sent you a message', ts: now - 20 * H, read: false, link: '#/c/messages/cv-1'},
      { id: 'n3', type: 'msg', text: 'Sara Al-Otaibi (Royal Energy Group) sent you a message', ts: now - 2 * H, read: false, link: '#/c/messages/cv-3'},
      { id: 'n4', type: 'job', text: 'Siwa Telecom posted an ECC → S/4HANA FICO migration role in Cairo', ts: now - 1 * D, read: true, link: '#/c/jobs'},
      { id: 'nc1', type: 'comm', text: 'Priya Nair answered your question “MM: 15 years of purchase history…”', ts: now - 2 * D, read: false, link: '#/community/q/q13'},
      { id: 'nc2', type: 'comm', text: 'Your answer on “After 15 years of ECC FI/CO history…” was marked accepted', ts: now - 1 * D, read: false, link: '#/community/q/q1'}
    ],
    'c-vikram': [
      { id: 'nc3', type: 'comm', text: 'Ahmed Said answered your question “After 15 years of ECC FI/CO history…”', ts: now - 2 * D, read: false, link: '#/community/q/q1'},
      { id: 'nc4', type: 'comm', text: 'Your answer on “Still on ECC 6.0: extended maintenance…” was marked accepted', ts: now - 15 * D, read: true, link: '#/community/q/q10'}
    ],
    'c-priya': [
      { id: 'nc5', type: 'comm', text: 'Your answer on “MM: 15 years of purchase history…” was marked accepted', ts: now - 2 * D, read: false, link: '#/community/q/q13'}
    ],
    'c-sara': [
      { id: 'nc6', type: 'comm', text: 'Diego Fernandes answered your question “ECC IS-Retail → S/4HANA…”', ts: now - 4 * D, read: false, link: '#/community/q/q2'}
    ],
    'c-fatima': [
      { id: 'nc7', type: 'comm', text: 'Omar Farouk answered your question “GRC Access Control in the GCC…”', ts: now - 5 * D, read: true, link: '#/community/q/q5'}
    ],
    'co-siwa': [
      { id: 'nc8', type: 'comm', text: 'Vikram Singh answered your question “Hiring a FICO consultant…”', ts: now - 3 * D, read: false, link: '#/community/q/q4'}
    ],
    'co-indus': [
      { id: 'nc9', type: 'comm', text: 'Vikram Singh answered your question “Still on ECC 6.0: extended maintenance…”', ts: now - 15 * D, read: true, link: '#/community/q/q10'}
    ],
    'co-crescent': [
      { id: 'n5', type: 'app', text: 'Vikram Singh applied to "S/4HANA FICO Lead Consultant"', ts: now - 1 * D, read: false, link: '#/e/jobs/j1'},
      { id: 'n6', type: 'app', text: 'Fatima Al-Qahtani applied to "S/4HANA FICO Lead Consultant"', ts: now - 8 * H, read: false, link: '#/e/jobs/j1'},
      { id: 'n7', type: 'msg', text: 'Ahmed Said shared his CV in your inbox', ts: now - 21 * H, read: true, link: '#/e/messages/cv-1'}
    ]
  };

  /* ===================== v20 refresh: wider roster, mixed rates, more jobs ===================== */
  /* Existing professionals — rates now show the new currency / period fields. */
  const rateTweaks = {
    'c-layla':  { currency: 'AED', dailyRate: 1850 },
    'c-sara':   { currency: 'OMR', dailyRate: 250 },
    'c-diego':  { currency: 'AED', dailyRate: 22000, ratePeriod: 'month' },
    'c-fatima': { currency: 'SAR', dailyRate: 1700 },
    'c-nour':   { currency: 'QAR', dailyRate: 1450 },
    'c-karim':  { currency: 'KWD', dailyRate: 420 },
    'c-max':    { currency: 'EUR', dailyRate: 1150 },
    'c-anita':  { currency: 'USD', dailyRate: 1300, ratePeriod: 'month' }
  };
  consultants.forEach(c => { if (rateTweaks[c.id]) Object.assign(c, rateTweaks[c.id]); });

  consultants.push(
    { id: 'c-hassan', firstName: 'Hassan', lastName: 'Al-Mansoori', headline: 'Senior SAP ABAP & Fiori Developer (RAP, CAP)',
      linkedin: 'https://www.linkedin.com/in/hassan-almansoori-sap-dev', roleType: 'technical',
      nationality: 'United Arab Emirates', country: 'ae', city: 'Abu Dhabi', level: 'Senior', yearsExp: 10, availability: 'Within 30 days',
      languages: ['English', 'Arabic'], currency: 'AED', dailyRate: 2300,
      summary: 'Builds clean-core extensions on S/4HANA: RAP services, Fiori elements apps and side-by-side CAP apps on BTP. Led a team of six developers at a government entity.',
      cv: { name: 'HassanAlMansoori_Dev_CV.pdf', size: '0.8 MB' }, workPrefs: ['Hybrid', 'On-site'], specialties: ['build', 'clean-core', 'testing'], otherSkills: ['RAP', 'OData'],
      industries: ['Public Sector / Government', 'Oil, Gas & Energy'],
      skills: [ { productId: 's4onprem', moduleId: 'abap', projects: 14, certified: true }, { productId: 's4onprem', moduleId: 'fioriui5', projects: 9 }, { productId: 'btp', moduleId: 'cap', projects: 3 } ], savedJobIds: [] },
    { id: 'c-lena', firstName: 'Lena', lastName: 'Fischer', headline: 'SAP BTP Integration & Extension Developer',
      linkedin: 'https://www.linkedin.com/in/lena-fischer-btp', roleType: 'technical',
      nationality: 'Germany', country: 'de', city: 'Munich', level: 'Mid', yearsExp: 6, availability: 'Immediate',
      languages: ['English', 'French'], currency: 'EUR', dailyRate: 950,
      summary: 'Integration Suite and CAP developer. Replaced a point-to-point interface landscape of 40 flows with a governed iFlow catalogue for a manufacturing group.',
      cv: { name: 'LenaFischer_BTP_CV.pdf', size: '0.7 MB' }, workPrefs: ['Remote', 'Hybrid'], specialties: ['btp', 'engineering'], otherSkills: ['Event Mesh'],
      industries: ['Manufacturing & Industrial', 'Automotive'],
      skills: [ { productId: 'btp', moduleId: 'integration', projects: 8, certified: true }, { productId: 'btp', moduleId: 'cap', projects: 4 }, { productId: 'btp', moduleId: 'abapcloud', projects: 2 } ], savedJobIds: [] },
    { id: 'c-yusuf', firstName: 'Yusuf', lastName: 'Hamdan', headline: 'SAP Basis & HANA Administrator — Upgrades and Migrations',
      linkedin: 'https://www.linkedin.com/in/yusuf-hamdan-basis', roleType: 'basis',
      nationality: 'Jordan', country: 'jo', city: 'Amman', level: 'Senior', yearsExp: 13, availability: 'Within 15 days',
      languages: ['English', 'Arabic'], currency: 'USD', dailyRate: 700,
      summary: 'Runs S/4HANA conversions from the Basis side: DMO, HANA sizing, high availability and hosting moves to a hyperscaler. 24/7 support experience.',
      cv: { name: 'YusufHamdan_Basis_CV.pdf', size: '0.6 MB' }, workPrefs: ['Remote', 'Hybrid'], specialties: ['brownfield', 'perf', 'ams'], otherSkills: ['DMO', 'HANA HA/DR'],
      industries: ['Telecommunications', 'Banking & Financial Services'],
      skills: [ { productId: 's4onprem', moduleId: 'basis', projects: 15, certified: true }, { productId: 's4onprem', moduleId: 'hanadba', projects: 10 }, { productId: 'ecc', moduleId: 'basis', projects: 12 } ], savedJobIds: [] },
    { id: 'c-noura', firstName: 'Noura', lastName: 'Al-Khalifa', headline: 'SAP Cloud Infrastructure & Identity Specialist',
      linkedin: '', roleType: 'basis',
      nationality: 'Bahrain', country: 'bh', city: 'Manama', level: 'Mid', yearsExp: 5, availability: 'Immediate',
      languages: ['English', 'Arabic'], currency: 'BHD', dailyRate: '',
      summary: 'BTP account administration, SSO and identity provisioning for SAP and non-SAP apps.',
      cv: null, workPrefs: ['Hybrid'], specialties: ['security'], otherSkills: [],
      industries: ['Banking & Financial Services'],
      skills: [ { productId: 'btp', moduleId: 'btpadmin', projects: 4 }, { productId: 'btp', moduleId: 'identity', projects: 4, certified: true }, { productId: 's4onprem', moduleId: 'basis', projects: 2 } ], savedJobIds: [] },
    { id: 'c-ibrahim', firstName: 'Ibrahim', lastName: 'Khalil', headline: 'Finance Business Expert / Key User — S/4HANA Record-to-Report',
      linkedin: '', roleType: 'keyuser',
      nationality: 'Egypt', country: 'eg', city: 'Cairo', level: 'Mid', yearsExp: 8, availability: 'Within 30 days',
      languages: ['English', 'Arabic'], currency: 'USD', dailyRate: 2800, ratePeriod: 'month',
      summary: 'Chartered accountant who served as finance key user on two S/4HANA programmes: owned the closing process, test scripts and user training.',
      cv: { name: 'IbrahimKhalil_CV.pdf', size: '0.5 MB' }, workPrefs: ['On-site', 'Hybrid'], specialties: ['training', 'testing', 'adoption'], otherSkills: ['IFRS', 'Month-end close'],
      industries: ['Retail & Consumer Goods (FMCG)', 'Manufacturing & Industrial'],
      skills: [ { productId: 's4onprem', moduleId: 'fi', projects: 2 }, { productId: 's4onprem', moduleId: 'co', projects: 1 } ], savedJobIds: [] },
    { id: 'c-sofia', firstName: 'Sofia', lastName: 'Marino', headline: 'Procurement Business Process Expert',
      linkedin: '', roleType: 'keyuser',
      nationality: 'Other', country: 'ae', city: 'Dubai', level: 'Mid', yearsExp: 7, availability: 'Within 60 days',
      languages: ['English', 'French'], currency: 'AED', dailyRate: 20000, ratePeriod: 'month',
      summary: '',
      cv: null, workPrefs: ['On-site'], specialties: ['training'], otherSkills: ['Sourcing strategy'],
      industries: ['Retail & Consumer Goods (FMCG)'],
      skills: [ { productId: 's4onprem', moduleId: 'mm', projects: 3 }, { productId: 'ariba', moduleId: 'buying', projects: 2 } ], savedJobIds: [] },
    { id: 'c-tariq', firstName: 'Tariq', lastName: 'Mahmood', headline: 'SAP Programme & Project Manager — Greenfield and Conversions',
      linkedin: 'https://www.linkedin.com/in/tariq-mahmood-sap-pmo', roleType: 'delivery',
      nationality: 'Pakistan', country: 'sa', city: 'Riyadh', level: 'Senior', yearsExp: 14, availability: 'Within 30 days',
      languages: ['English', 'Urdu', 'Arabic'], currency: 'SAR', dailyRate: 2600,
      summary: 'Delivered 7 SAP programmes up to 120 consultants, including two S/4HANA greenfield go-lives in the GCC. SAP Activate certified, strong on steering committees and vendor management.',
      cv: { name: 'TariqMahmood_PM_CV.pdf', size: '1.1 MB' }, workPrefs: ['On-site', 'Hybrid'], specialties: ['pmo', 'activate', 'greenfield', 'cutover'], otherSkills: ['Vendor management'],
      industries: ['Oil, Gas & Energy', 'Public Sector / Government'],
      skills: [ { productId: 's4onprem', moduleId: 'ps', projects: 9, certified: true }, { productId: 's4onprem', moduleId: 'fi', projects: 5 } ], savedJobIds: [] },
    { id: 'c-deepa', firstName: 'Deepa', lastName: 'Menon', headline: 'SuccessFactors Programme Manager — HR Transformation',
      linkedin: 'https://www.linkedin.com/in/deepa-menon-sf-pm', roleType: 'delivery',
      nationality: 'India', country: 'in', city: 'Bangalore', level: 'Senior', yearsExp: 11, availability: 'Within 60 days',
      languages: ['English', 'Hindi'], currency: 'USD', dailyRate: 78000, ratePeriod: 'year',
      summary: 'Runs multi-country HR cloud rollouts: Employee Central, Compensation and Onboarding. Strong change-management and stakeholder reporting. Looking for a permanent programme role.',
      cv: { name: 'DeepaMenon_CV.pdf', size: '0.9 MB' }, workPrefs: ['Hybrid', 'Remote'], specialties: ['pmo', 'ocm', 'adoption'], otherSkills: ['Global HR rollouts'],
      industries: ['Information Technology (IT)', 'Banking & Financial Services'],
      skills: [ { productId: 'successfactors', moduleId: 'ec', projects: 7, certified: true }, { productId: 'successfactors', moduleId: 'ecp', projects: 4 }, { productId: 'successfactors', moduleId: 'onboarding', projects: 3 } ], savedJobIds: [] },
    { id: 'c-khalid', firstName: 'Khalid', lastName: 'Rahman', headline: 'SAP Solution Architect — S/4HANA, BTP Integration and Clean Core',
      linkedin: 'https://www.linkedin.com/in/khalid-rahman-sap-architect', roleType: 'architect',
      nationality: 'Qatar', country: 'qa', city: 'Doha', level: 'Senior', yearsExp: 16, availability: 'Within 30 days',
      languages: ['English', 'Arabic'], currency: 'QAR', dailyRate: 3400,
      summary: 'Enterprise and solution architect for GCC groups: landscape strategy, clean-core guardrails, integration blueprints. Ran 30+ fit-to-standard workshops.',
      cv: { name: 'KhalidRahman_Architect_CV.pdf', size: '1.0 MB' }, workPrefs: ['On-site', 'Hybrid'], specialties: ['clean-core', 'value-discovery', 'fit-standard'], otherSkills: ['Landscape strategy'],
      industries: ['Oil, Gas & Energy', 'Utilities (Power & Water)'],
      skills: [ { productId: 's4onprem', moduleId: 'fi', projects: 5 }, { productId: 'btp', moduleId: 'integration', projects: 6, certified: true }, { productId: 's4public', moduleId: 'fico', projects: 3 } ], savedJobIds: [] }
  );

  companies.push(
    { id: 'co-rayan', name: 'Al-Rayan Logistics', industry: 'Logistics & Supply Chain', size: '501-1000',
      country: 'kw', city: 'Kuwait City', website: 'alrayan-logistics.com',
      about: 'Regional 3PL and freight forwarder digitising its warehouses and transport planning on S/4HANA and BTP.',
      sapSystems: ['s4onprem', 'btp'], contactName: 'Mariam Al-Sabah', contactTitle: 'IT Programme Director' },
    { id: 'co-manara', name: 'Manara Financial Group', industry: 'Banking & Financial Services', size: '201-500',
      country: 'bh', city: 'Manama', website: 'manarafinancial.bh',
      about: 'Bahrain-based wealth and corporate finance group running S/4HANA Cloud Public Edition and SuccessFactors.',
      sapSystems: ['s4public', 'successfactors'], contactName: 'Faisal Al-Dosari', contactTitle: 'Head of Finance Systems' },
    { id: 'co-orbit', name: 'Orbit SAP Partners', industry: 'Consulting & Professional Services', size: '51-200',
      country: 'ae', city: 'Dubai', website: 'orbitsap.ae',
      about: 'Boutique SAP partner delivering S/4HANA programmes across the GCC. Hires project managers and consultants for client engagements.',
      sapSystems: ['s4onprem', 's4public', 'btp'], contactName: 'Rania Haddad', contactTitle: 'Delivery Director' }
  );

  /* Jobs: every employment type and pay style (daily, monthly, yearly, not disclosed); some remote / location-free. */
  const newJobs = [
    { id: 'j13', title: 'SAP Project Manager — S/4HANA Greenfield Programme', companyId: 'co-orbit',
      requires: [ { productId: 's4onprem', moduleId: 'ps', minProjects: 5 } ], industries: ['Banking & Financial Services'], industry: 'Banking & Financial Services',
      certification: 'preferred', level: 'Senior', employmentType: 'Contract', duration: '12 months', city: 'Dubai', country: 'ae', remote: false,
      currency: 'AED', ratePeriod: 'day', rateMin: 2200, rateMax: 3000, minExp: 10, languages: ['English'], preferredSpecialties: ['pmo', 'activate'],
      description: 'Lead a 40-person greenfield programme for a regional bank client: plan, steering committee reporting, vendor and risk management. SAP Activate experience required.',
      postedDaysAgo: 1, applicants: [], status: 'open' },
    { id: 'j14', title: 'SAP ABAP & Fiori Developer (RAP)', companyId: 'co-royal',
      requires: [ { productId: 's4onprem', moduleId: 'abap', minProjects: 4 }, { productId: 's4onprem', moduleId: 'fioriui5' } ], industries: ['Oil, Gas & Energy'], industry: 'Oil, Gas & Energy',
      certification: '', level: 'Senior', employmentType: 'Full-time', duration: 'Permanent', city: 'Riyadh', country: 'sa', remote: false,
      currency: 'SAR', ratePeriod: 'month', rateMin: 28000, rateMax: 38000, minExp: 6, languages: ['English'], preferredSpecialties: ['clean-core'],
      description: 'Join our in-house SAP team: clean-core extensions with RAP, Fiori elements apps and OData services. Permanent role with housing allowance.',
      postedDaysAgo: 3, applicants: [], status: 'open' },
    { id: 'j15', title: 'SAP BTP Integration Developer (Remote)', companyId: 'co-nexus',
      requires: [ { productId: 'btp', moduleId: 'integration', minProjects: 3 }, { productId: 'btp', moduleId: 'cap' } ], industries: ['Information Technology (IT)'], industry: 'Information Technology (IT)',
      certification: '', level: 'Mid', employmentType: 'Contract', duration: '6 months', city: '', country: '', remote: true,
      currency: 'USD', ratePeriod: 'day', rateMin: 600, rateMax: 850, minExp: 4, languages: ['English'], preferredSpecialties: ['btp'],
      description: 'Fully remote. Build and govern an iFlow catalogue and CAP extensions for a global client. Overlap with CET working hours.',
      postedDaysAgo: 4, applicants: [], status: 'open' },
    { id: 'j16', title: 'SAP Basis & HANA Administrator', companyId: 'co-crescent',
      requires: [ { productId: 's4onprem', moduleId: 'basis', minProjects: 5 }, { productId: 's4onprem', moduleId: 'hanadba' } ], industries: ['Banking & Financial Services'], industry: 'Banking & Financial Services',
      certification: 'preferred', level: 'Senior', employmentType: 'Full-time', duration: 'Permanent', city: 'Dubai', country: 'ae', remote: false,
      currency: 'AED', ratePeriod: 'month', rateMin: 22000, rateMax: 30000, minExp: 8, languages: ['English', 'Arabic'], preferredSpecialties: ['perf'],
      description: 'Own run and upgrade operations for our S/4HANA landscape: HANA, high availability, patching and the move to a hosted environment.',
      postedDaysAgo: 6, applicants: [], status: 'open' },
    { id: 'j17', title: 'Finance Key User — S/4HANA Cloud Public Edition', companyId: 'co-manara',
      requires: [ { productId: 's4public', moduleId: 'fico', minProjects: 1 } ], industries: ['Banking & Financial Services'], industry: 'Banking & Financial Services',
      certification: '', level: 'Mid', employmentType: 'Full-time', duration: 'Permanent', city: 'Manama', country: 'bh', remote: false,
      currency: 'BHD', ratePeriod: 'month', rateMin: 1100, rateMax: 1500, minExp: 4, languages: ['English', 'Arabic'], preferredSpecialties: ['training'],
      description: 'Be the finance voice in our Public Cloud rollout: own the month-end close in SAP, write test scripts and train colleagues.',
      postedDaysAgo: 2, applicants: [], status: 'open' },
    { id: 'j18', title: 'SAP Solution Architect — S/4HANA & BTP', companyId: 'co-dune',
      requires: [ { productId: 'btp', moduleId: 'integration', minProjects: 4 }, { productId: 's4public', moduleId: 'fico', minProjects: 2 } ], industries: ['Information Technology (IT)'], industry: 'Information Technology (IT)',
      certification: 'preferred', level: 'Senior', employmentType: 'Contract', duration: '9 months', city: 'Doha', country: 'qa', remote: false,
      currency: 'QAR', ratePeriod: 'day', rateMin: 3000, rateMax: 4200, minExp: 12, languages: ['English', 'Arabic'], preferredSpecialties: ['clean-core', 'fit-standard'],
      description: 'Own the target architecture and integration blueprint for our Public Cloud product. Run fit-to-standard workshops and guard the clean core.',
      postedDaysAgo: 5, applicants: [], status: 'open' },
    { id: 'j19', title: 'SAP EWM Consultant — Warehouse Rollout', companyId: 'co-rayan',
      requires: [ { productId: 's4onprem', moduleId: 'ewm', minProjects: 3 }, { productId: 's4onprem', moduleId: 'tm' } ], industries: ['Logistics & Supply Chain'], industry: 'Logistics & Supply Chain',
      certification: '', level: 'Mid', employmentType: 'Contract', duration: '6 months', city: 'Kuwait City', country: 'kw', remote: false,
      currency: 'KWD', ratePeriod: 'day', rateMin: 380, rateMax: 520, minExp: 5, languages: ['English'], preferredSpecialties: ['cutover'],
      description: 'Roll out EWM to three warehouses with RF scanning and TM integration. On-site in Kuwait.',
      postedDaysAgo: 7, applicants: [], status: 'open' },
    { id: 'j20', title: 'SAP Analytics Cloud Consultant', companyId: 'co-mena-retail',
      requires: [ { productId: 'data', moduleId: 'bistories', minProjects: 2 } ], industries: ['Retail & Consumer Goods (FMCG)'], industry: 'Retail & Consumer Goods (FMCG)',
      certification: '', level: 'Mid', employmentType: 'Freelance', duration: '3 months', city: 'Dubai', country: 'ae', remote: false,
      currency: 'USD', ratePeriod: 'day', rateMin: 0, rateMax: 0, minExp: 3, languages: ['English'], preferredSpecialties: [],
      description: 'Build executive dashboards on SAP Analytics Cloud for retail KPIs. Rate to be discussed with the right profile.',
      postedDaysAgo: 3, applicants: [], status: 'open' },
    { id: 'j21', title: 'Junior SAP CX Support Analyst (Trainee Programme)', companyId: 'co-mena-retail',
      requires: [ { productId: 'cx', moduleId: 'salescloud', minProjects: 0 } ], industries: ['Retail & Consumer Goods (FMCG)'], industry: 'Retail & Consumer Goods (FMCG)',
      certification: '', level: 'Junior', employmentType: 'Full-time', duration: 'Permanent', city: 'Dubai', country: 'ae', remote: false,
      currency: 'AED', ratePeriod: 'month', rateMin: 7000, rateMax: 10000, minExp: 0, languages: ['English'], preferredSpecialties: ['training'],
      description: 'Early-career role with mentoring: first-line support for our Sales Cloud, ticket analysis and user training. You will be trained on Service Cloud as well.',
      postedDaysAgo: 2, applicants: [], status: 'open' },
    { id: 'j22', title: 'Finance Business Analyst — S/4HANA (Remote)', companyId: 'co-orbit',
      requires: [ { productId: 's4onprem', moduleId: 'fi', minProjects: 3 }, { productId: 's4onprem', moduleId: 'co' } ], industries: ['Consulting & Professional Services'], industry: 'Consulting & Professional Services',
      certification: '', level: 'Mid', employmentType: 'Contract', duration: '3 months', city: '', country: '', remote: true,
      currency: 'USD', ratePeriod: 'day', rateMin: 450, rateMax: 650, minExp: 5, languages: ['English'], preferredSpecialties: [],
      description: 'Remote fit-gap and requirement workshops for FI/CO with a partner team. Open to any time zone within GCC to Europe.',
      postedDaysAgo: 1, applicants: [], status: 'open' },
    { id: 'j23', title: 'SuccessFactors Programme Manager', companyId: 'co-nexus',
      requires: [ { productId: 'successfactors', moduleId: 'ec', minProjects: 4 } ], industries: ['Information Technology (IT)'], industry: 'Information Technology (IT)',
      certification: '', level: 'Senior', employmentType: 'Full-time', duration: 'Permanent', city: 'Bangalore', country: 'in', remote: false,
      currency: 'USD', ratePeriod: 'year', rateMin: 70000, rateMax: 95000, minExp: 9, languages: ['English'], preferredSpecialties: ['pmo', 'ocm'],
      description: 'Lead HR cloud transformation programmes for global clients. Permanent role with hybrid working.',
      postedDaysAgo: 4, applicants: [], status: 'open' }
  ];
  newJobs.forEach(j => jobs.push(j));

  /* Existing jobs: local currencies and a monthly / yearly / undisclosed mix. */
  const payTweaks = {
    j2:  { currency: 'SAR', rateMin: 1300, rateMax: 2000 },
    j3:  { currency: 'AED', ratePeriod: 'month', rateMin: 18000, rateMax: 26000 },
    j6:  { currency: 'QAR', rateMin: 900, rateMax: 1400 },
    j7:  { currency: 'AED', rateMin: 1300, rateMax: 1900 },
    j8:  { ratePeriod: 'year', rateMin: 60000, rateMax: 85000 },
    j9:  { currency: 'QAR', rateMin: 1100, rateMax: 1600 },
    j10: { rateMin: 0, rateMax: 0 },
    j12: { currency: 'SAR', rateMin: 1300, rateMax: 1800 }
  };
  jobs.forEach(j => { if (payTweaks[j.id]) Object.assign(j, payTweaks[j.id]); });

  /* More open questions so more than one demo user has something to answer. */
  [
    { id: 'qo7', authorId: 'c-hassan', title: 'RAP vs CAP for a new extension that must read S/4HANA data: where do you draw the line?', body: 'We need a new approval app reading purchase orders and writing to a custom table. Side-by-side on BTP with CAP, or in-app with RAP? What did you regret choosing?', productId: 'btp', moduleId: 'cap', createdTs: now - 1 * D, upvotes: 1, upvotedBy: ['c-lena'], answers: [] },
    { id: 'qo8', authorId: 'c-yusuf', title: 'DMO to a hyperscaler: how long should the downtime-optimised run really take for a 6 TB database?', body: 'Planning a conversion plus a move to a hyperscaler in one weekend. Sizing says 6 TB. Has anyone achieved a sub-24-hour downtime and what did you have to tune?', productId: 's4onprem', moduleId: 'basis', createdTs: now - 2 * D, upvotes: 2, upvotedBy: ['c-max'], answers: [] },
    { id: 'qo9', authorId: 'c-deepa', title: 'Employee Central: how do you design position management for a matrix organisation?', body: 'Two business lines share a department tree but report differently. Position management on or off? What broke for you after go-live?', productId: 'successfactors', moduleId: 'ec', createdTs: now - 1 * D, upvotes: 1, upvotedBy: ['c-raja'], answers: [] },
    { id: 'qo10', authorId: 'c-tariq', title: 'How do you keep a greenfield on schedule when the business keeps adding scope in the realise phase?', body: 'We are 14 weeks into realise with a steering committee that keeps adding "small" requests. What governance actually stopped scope creep for you without losing the sponsor?', topic: 'career', productId: '', moduleId: '', createdTs: now - 2 * D, upvotes: 3, upvotedBy: ['c-vikram', 'c-khalid'], answers: [] },
    { id: 'qo11', authorId: 'co-rayan', title: 'EWM or Extended Warehouse in S/4HANA basic: what do we actually need for 3 mid-size warehouses?', body: 'We have RF scanning and about 400 pallet movements a day per site. Is embedded EWM basic enough or should we go decentralised? Looking for real experience.', productId: 's4onprem', moduleId: 'ewm', createdTs: now - 1 * D, upvotes: 1, upvotedBy: ['c-nour'], answers: [] },
    { id: 'qo12', authorId: 'co-manara', title: 'Public Cloud: how restrictive is the extensibility model for a bank with local reporting rules?', body: 'Our regulator wants specific monthly reports. Can we cover this with key-user extensibility and CDS views, or will we need BTP side-by-side?', productId: 's4public', moduleId: 'fico', createdTs: now - 3 * D, upvotes: 2, upvotedBy: ['c-karim'], answers: [] }
  ].forEach(q => questions.push(q));

  window.SAMPLE = { consultants, companies, jobs, conversations, notifications, questions, articles };
})();

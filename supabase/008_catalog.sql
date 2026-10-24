-- =====================================================================
-- 008 · Catalog (SAP products, modules, specialties) kept in the database
-- The admin edits it in Admin > Catalog; the app reads it with get_catalog().
-- Nothing is ever hard-deleted: items are hidden (still shown wherever
-- someone already uses them) or merged into another item. Ids never change.
-- Safe to run again (the seed only fills empty tables).
-- =====================================================================

create table if not exists public.catalog_products (
  id text primary key, name text not null, short text not null default '',
  pos int not null default 0, hidden boolean not null default false
);
create table if not exists public.catalog_modules (
  product_id text not null references public.catalog_products(id), id text not null,
  name text not null, family text not null default '' check (family in ('','fin','log','tech')),
  pos int not null default 0, hidden boolean not null default false, merged_into text,
  primary key (product_id, id)
);
create table if not exists public.catalog_areas (
  id text primary key, name text not null, pos int not null default 0, hidden boolean not null default false
);
create table if not exists public.catalog_specs (
  id text primary key, area_id text not null references public.catalog_areas(id),
  grp text not null default '', grp_pos int not null default 0,
  name text not null, short text not null default '', pos int not null default 0,
  hidden boolean not null default false, merged_into text
);
create table if not exists public.catalog_role_spec (
  role_type text not null, spec_id text not null references public.catalog_specs(id),
  pos int not null default 0, primary key (role_type, spec_id)
);
create table if not exists public.catalog_log (
  id bigserial primary key, ts bigint not null default (extract(epoch from now())*1000)::bigint,
  admin text not null default '', action text not null, summary text not null default '',
  undo jsonb, undone boolean not null default false
);
alter table public.catalog_products enable row level security;
alter table public.catalog_modules  enable row level security;
alter table public.catalog_areas    enable row level security;
alter table public.catalog_specs    enable row level security;
alter table public.catalog_role_spec enable row level security;
alter table public.catalog_log      enable row level security;
revoke all on public.catalog_products, public.catalog_modules, public.catalog_areas, public.catalog_specs, public.catalog_role_spec, public.catalog_log from anon, authenticated, public;

-- ---------- seed (first run only) -------------------------------------------
do $seed$
declare s jsonb := $json${"products":[{"id":"s4onprem","name":"S/4HANA Private Cloud / On-Premise (Core Enterprise)","short":"S/4HANA Private Cloud / On-Prem","pos":1,"modules":[{"id":"fi","name":"FI (Financial Accounting)","family":"fin","pos":1},{"id":"co","name":"CO (Controlling)","family":"fin","pos":2},{"id":"cfin","name":"Central Finance (cFin)","family":"fin","pos":3},{"id":"groupreporting","name":"Group Reporting (Consolidation)","family":"fin","pos":4},{"id":"sd","name":"SD (Sales & Distribution)","family":"log","pos":5},{"id":"cs","name":"S/4HANA Service (formerly CS)","family":"log","pos":6},{"id":"mm","name":"MM (Sourcing & Procurement / Materials Management)","family":"log","pos":7},{"id":"pp","name":"PP (Production Planning)","family":"log","pos":8},{"id":"qm","name":"QM (Quality Management)","family":"log","pos":9},{"id":"pm","name":"PM / EAM (Plant Maintenance / Asset Management)","family":"log","pos":10},{"id":"ps","name":"EPPM / PS (Project System)","family":"log","pos":11},{"id":"ewm","name":"EWM (Extended Warehouse Management)","family":"log","pos":12},{"id":"tm","name":"TM (Transportation Management)","family":"log","pos":13},{"id":"trm","name":"Treasury & Bank Communication (TRM / BCM / Cash)","family":"fin","pos":14},{"id":"fscm","name":"FSCM (Credit, Collections & Dispute Management)","family":"fin","pos":15},{"id":"ehs","name":"EHS (Environment, Health & Safety)","family":"log","pos":16},{"id":"gts","name":"GTS (Global Trade Services)","family":"log","pos":17},{"id":"grants","name":"Grants Management","family":"fin","pos":18},{"id":"abap","name":"ABAP / ABAP Cloud","family":"tech","pos":19},{"id":"fioriui5","name":"Fiori / UI5 Development","family":"tech","pos":20},{"id":"basis","name":"BASIS & System Administration","family":"tech","pos":21},{"id":"hanadba","name":"HANA Database Administration","family":"tech","pos":22},{"id":"securitygrc","name":"Security & GRC","family":"tech","pos":23},{"id":"solman","name":"Solution Manager / Cloud ALM","family":"tech","pos":24},{"id":"po","name":"PO / PI (Process Orchestration / Integration)","family":"tech","pos":25},{"id":"hcm","name":"HCM on S/4HANA (Human Resources – private cloud)","family":"","pos":26}]},{"id":"ecc","name":"ECC 6.0 (Legacy Core)","short":"ECC 6.0","pos":2,"modules":[{"id":"fi","name":"FI (Financial Accounting)","family":"fin","pos":1},{"id":"co","name":"CO (Controlling)","family":"fin","pos":2},{"id":"sd","name":"SD (Sales & Distribution)","family":"log","pos":3},{"id":"cs","name":"CS (Customer Service)","family":"log","pos":4},{"id":"mm","name":"MM (Materials Management)","family":"log","pos":5},{"id":"pp","name":"PP (Production Planning)","family":"log","pos":6},{"id":"qm","name":"QM (Quality Management)","family":"log","pos":7},{"id":"pm","name":"PM (Plant Maintenance)","family":"log","pos":8},{"id":"ps","name":"PS (Project System)","family":"log","pos":9},{"id":"hcm","name":"HCM (Human Resources)","family":"","pos":10},{"id":"hcmpay","name":"HCM Payroll","family":"","pos":11},{"id":"ewm","name":"EWM (Extended Warehouse Management)","family":"log","pos":12},{"id":"tm","name":"TM (Transportation Management)","family":"log","pos":13},{"id":"trm","name":"Treasury & Bank Communication (TRM / BCM / Cash)","family":"fin","pos":14},{"id":"fscm","name":"FSCM (Credit, Collections & Dispute Management)","family":"fin","pos":15},{"id":"ehs","name":"EHS (Environment, Health & Safety)","family":"log","pos":16},{"id":"gts","name":"GTS (Global Trade Services)","family":"log","pos":17},{"id":"grants","name":"Grants Management","family":"fin","pos":18},{"id":"abap","name":"ABAP","family":"tech","pos":19},{"id":"basis","name":"BASIS","family":"tech","pos":20},{"id":"securitygrc","name":"Security & GRC","family":"tech","pos":21},{"id":"solman","name":"Solution Manager","family":"tech","pos":22},{"id":"po","name":"PO / PI (Process Orchestration / Integration)","family":"tech","pos":23},{"id":"bobods","name":"BO / BODS Administration","family":"tech","pos":24}]},{"id":"s4public","name":"S/4HANA Public Cloud","short":"S/4HANA Public Cloud","pos":3,"modules":[{"id":"fico","name":"Finance (FI/CO)","family":"fin","pos":1},{"id":"mm","name":"Sourcing & Procurement (MM)","family":"log","pos":2},{"id":"sd","name":"Sales (SD)","family":"log","pos":3},{"id":"scm","name":"Supply Chain (SCM)","family":"log","pos":4},{"id":"pp","name":"Manufacturing (PP)","family":"log","pos":5},{"id":"pm","name":"Asset Management (PM)","family":"log","pos":6},{"id":"cs","name":"Service","family":"log","pos":7},{"id":"ps","name":"EPPM / Project Systems (PS)","family":"log","pos":8},{"id":"cbc","name":"CBC (Central Business Configuration)","family":"log","pos":9},{"id":"trm","name":"Treasury & Bank Communication (TRM / BCM / Cash)","family":"fin","pos":10},{"id":"fscm","name":"FSCM (Credit, Collections & Dispute Management)","family":"fin","pos":11},{"id":"ehs","name":"EHS (Environment, Health & Safety)","family":"log","pos":12},{"id":"cfin","name":"Central Finance (cFin)","family":"fin","pos":13},{"id":"groupreporting","name":"Group Reporting (Consolidation)","family":"fin","pos":14}]},{"id":"successfactors","name":"SuccessFactors (HXM)","short":"SuccessFactors","pos":4,"modules":[{"id":"ec","name":"Employee Central (EC)","family":"","pos":1},{"id":"ecp","name":"Employee Central Payroll (ECP)","family":"","pos":2},{"id":"recruiting","name":"Recruiting (RCM/RMK)","family":"","pos":3},{"id":"onboarding","name":"Onboarding (ONB)","family":"","pos":4},{"id":"perfgoals","name":"Performance & Goals (PMGM)","family":"","pos":5},{"id":"learning","name":"Learning (LMS)","family":"","pos":6},{"id":"compensation","name":"Compensation (COMP)","family":"","pos":7},{"id":"succession","name":"Succession & Development (CDP)","family":"","pos":8},{"id":"wfm","name":"Workforce Management – Time, Attendance & Scheduling (WFM)","family":"","pos":9},{"id":"wfa","name":"Workforce Analytics & Planning (WFA)","family":"","pos":10}]},{"id":"ariba","name":"Ariba (Procurement)","short":"Ariba","pos":5,"modules":[{"id":"sourcing","name":"Ariba Sourcing","family":"","pos":1},{"id":"contracts","name":"Ariba Contracts","family":"","pos":2},{"id":"slp","name":"Ariba SLP (Supplier Lifecycle & Performance)","family":"","pos":3},{"id":"buying","name":"Ariba Buying & Invoicing","family":"","pos":4},{"id":"commerceautomation","name":"Commerce Automation","family":"","pos":5},{"id":"cig","name":"Ariba CIG / Integration Suite","family":"","pos":6},{"id":"taulia","name":"SAP Taulia (Supply Chain Finance / Dynamic Discounting)","family":"","pos":7}]},{"id":"btp","name":"BTP (Business Technology Platform)","short":"BTP","pos":6,"modules":[{"id":"integration","name":"Integration Suite (CPI / API Management)","family":"","pos":1},{"id":"buildapps","name":"SAP Build Apps (Low-Code / No-Code)","family":"","pos":2},{"id":"buildpa","name":"SAP Build Process Automation (Workflow & RPA)","family":"","pos":3},{"id":"basfiori","name":"SAP BAS / Fiori Development","family":"","pos":4},{"id":"cap","name":"CAP (Cloud Application Programming Model)","family":"","pos":5},{"id":"abapcloud","name":"ABAP Cloud","family":"","pos":6},{"id":"btpadmin","name":"BTP Administration (Subaccounts, Connectivity, Cloud Connector)","family":"","pos":7},{"id":"identity","name":"Cloud Identity Services (IAS / IPS)","family":"","pos":8},{"id":"eventmesh","name":"Event Mesh (Advanced Event Mesh)","family":"","pos":9},{"id":"hanacloud","name":"SAP HANA Cloud (Managed Cloud Database)","family":"","pos":10},{"id":"workzone","name":"SAP Work Zone (Digital Workplace / Employee Portal)","family":"","pos":11},{"id":"drc","name":"SAP Document & Reporting Compliance – Cloud (DRC / e-Invoicing)","family":"","pos":12}]},{"id":"data","name":"Data, Analytics & Insights","short":"Data & Analytics","pos":7,"modules":[{"id":"bistories","name":"SAP Analytics Cloud (SAC) - BI & Stories","family":"","pos":1},{"id":"planning","name":"SAP Analytics Cloud (SAC) - Planning (FP&A)","family":"","pos":2},{"id":"datasphere","name":"SAP Datasphere","family":"","pos":3},{"id":"bw","name":"SAP BW / BW/4HANA","family":"","pos":4},{"id":"bods","name":"SAP BODS (Data Services / ETL)","family":"","pos":5},{"id":"mdg","name":"MDG (Master Data Governance)","family":"","pos":6},{"id":"datamigration","name":"Data Migration & Transformation (Migration Cockpit, SLT, TDMS, LSMW)","family":"","pos":7},{"id":"archiving","name":"Data Archiving & ILM","family":"","pos":8}]},{"id":"cx","name":"CX (Customer Experience / CRM)","short":"CX","pos":8,"modules":[{"id":"commercecloud","name":"Commerce Cloud (Hybris)","family":"","pos":1},{"id":"salescloud","name":"Sales Cloud (C4C)","family":"","pos":2},{"id":"servicecloud","name":"Service Cloud (C4C)","family":"","pos":3},{"id":"marketingcloud","name":"Customer Data Platform (CDP) / Marketing Cloud","family":"","pos":4},{"id":"crmsales","name":"CRM Sales (Classic & S/4HANA)","family":"","pos":5},{"id":"crmservice","name":"CRM Service (Classic & S/4HANA)","family":"","pos":6},{"id":"crmmarketing","name":"CRM Marketing (Classic & S/4HANA)","family":"","pos":7},{"id":"emarsys","name":"SAP Emarsys / Engagement Cloud (Marketing Automation & Omnichannel)","family":"","pos":8},{"id":"cpq","name":"SAP CPQ (Configure, Price, Quote)","family":"","pos":9},{"id":"fsm","name":"SAP Field Service & Asset Management (FSM – standalone)","family":"","pos":10}]},{"id":"businessone","name":"Business One (SME ERP)","short":"Business One","pos":9,"modules":[{"id":"financebanking","name":"Finance & Banking","family":"","pos":1},{"id":"salespurchasing","name":"Sales & Purchasing","family":"","pos":2},{"id":"inventoryproduction","name":"Inventory & Production","family":"","pos":3},{"id":"sdkaddon","name":"SDK / Add-on Development","family":"","pos":4}]},{"id":"industry","name":"SAP Industry Solutions (IS)","short":"Industry Solutions","pos":10,"modules":[{"id":"isutilities","name":"IS-Utilities (IS-U / Energy & Water)","family":"","pos":1},{"id":"isretail","name":"IS-Retail & Fashion (FMS)","family":"","pos":2},{"id":"isoilgas","name":"IS-Oil & Gas","family":"","pos":3},{"id":"isrealestate","name":"IS-Real Estate (RE-FX)","family":"","pos":4},{"id":"publicsector","name":"Public Sector (PSM / Funds Management)","family":"","pos":5},{"id":"isautomotive","name":"IS-Automotive (DBM / VMS / Proaxia)","family":"","pos":6},{"id":"isbanking","name":"IS-Banking & Financial Services (FS-CD / Loans)","family":"","pos":7},{"id":"ishealthcare","name":"IS-Healthcare (IS-H)","family":"","pos":8},{"id":"ismills","name":"IS-Mill Products & Mining","family":"","pos":9},{"id":"iseco","name":"IS-Engineering, Construction & Operations (EC&O)","family":"","pos":10},{"id":"islifesciences","name":"IS-Life Sciences & Pharmaceuticals (GxP / Serialization)","family":"","pos":11}]},{"id":"specialized","name":"Specialized Cloud & SaaS Solutions","short":"Specialized Cloud & SaaS","pos":11,"modules":[{"id":"concur","name":"SAP Concur (Travel, Expense & Invoice)","family":"","pos":1},{"id":"fieldglass","name":"SAP Fieldglass (Vendor Management / External Workforce)","family":"","pos":2},{"id":"signavio","name":"SAP Signavio (Process Insights, Modeling & Mining)","family":"","pos":3},{"id":"leanix","name":"SAP LeanIX (Enterprise Architecture Management)","family":"","pos":4}]},{"id":"ai","name":"AI & Intelligent Technologies","short":"AI & Intelligent Tech","pos":12,"modules":[{"id":"aicore","name":"SAP AI Core (ML Lifecycle Management & Model Deployment)","family":"","pos":1},{"id":"ailaunchpad","name":"SAP AI Launchpad / Generative AI Hub (Prompt Engineering & LLM Orchestration)","family":"","pos":2},{"id":"joule","name":"SAP Joule (AI Copilot – Configuration, Activation & Skills)","family":"","pos":3},{"id":"bdc","name":"SAP Business Data Cloud (BDC – Unified Data + AI Platform)","family":"","pos":4},{"id":"dox","name":"SAP Document Information Extraction (DOX – AI Document Processing)","family":"","pos":5}]},{"id":"qualtrics","name":"SAP Qualtrics (Experience Management)","short":"Qualtrics","pos":13,"modules":[{"id":"qualtrics-cx","name":"Customer Experience Management (XM – CX / NPS / CES)","family":"","pos":1},{"id":"qualtrics-ex","name":"Employee Experience Management (XM – EX / Engagement)","family":"","pos":2},{"id":"qualtrics-bx","name":"Brand & Market Research (XM – BX / Research)","family":"","pos":3},{"id":"qualtrics-admin","name":"Qualtrics Platform Administration & CoreXM","family":"","pos":4}]},{"id":"scmcloud","name":"SAP Supply Chain Cloud (Standalone)","short":"Supply Chain Cloud","pos":14,"modules":[{"id":"ibp","name":"SAP IBP (Integrated Business Planning - Demand, S&OP, Inventory)","family":"","pos":1},{"id":"dmc","name":"SAP Digital Manufacturing (DMC – Manufacturing Execution)","family":"","pos":2},{"id":"apm","name":"SAP Asset Performance Management (APM / Intelligent Asset Management)","family":"","pos":3},{"id":"oms","name":"SAP Order Management Services (OMS – Order Orchestration)","family":"","pos":4},{"id":"sustainability","name":"SAP Sustainability Cloud (Green Ledger, Sustainability Control Tower)","family":"","pos":5}]},{"id":"biznetwork","name":"SAP Business Network","short":"Business Network","pos":15,"modules":[{"id":"bn-procurement","name":"SAP Business Network for Procurement (Supplier / Buyer Collaboration)","family":"","pos":1},{"id":"bn-supplychain","name":"SAP Business Network for Supply Chain (Trading Partner Collaboration)","family":"","pos":2},{"id":"bn-assets","name":"SAP Business Network for Asset Management","family":"","pos":3}]}],"areas":[{"id":"strategic","name":"Strategic Advisory & Architecture","pos":1,"groups":[{"name":"Cloud Transformation Programs","pos":1,"items":[{"id":"rise","name":"RISE with SAP","short":"RISE","pos":1},{"id":"grow","name":"GROW with SAP","short":"GROW","pos":2}]},{"name":"Enterprise & Solution Architecture","pos":2,"items":[{"id":"s4cloud-arch","name":"S/4HANA Cloud Architecture (Public / Private)","short":"S/4HANA Cloud Architecture","pos":1},{"id":"clean-core","name":"Clean Core Strategy","short":"Clean Core","pos":2},{"id":"integration-arch","name":"Integration Architecture (SAP Integration Suite / CPI)","short":"Integration Architecture","pos":3}]},{"name":"Business Transformation & Discovery","pos":3,"items":[{"id":"value-discovery","name":"Value Discovery & Business Case","short":"Value Discovery","pos":1},{"id":"fit-standard","name":"Fit-to-Standard Workshops","short":"Fit-to-Standard","pos":2},{"id":"process-mining","name":"Process Transformation & Mining (SAP Signavio)","short":"Signavio / Process Mining","pos":3},{"id":"presales","name":"Presales / Proof of Concept (PoC)","short":"Presales / PoC","pos":4}]}]},{"id":"implementation","name":"Implementation & Transition Leadership","pos":2,"groups":[{"name":"Migration & Transition Strategies","pos":1,"items":[{"id":"greenfield","name":"Greenfield Implementation (New Implementation)","short":"Greenfield","pos":1},{"id":"brownfield","name":"Brownfield (System Conversion)","short":"Brownfield","pos":2},{"id":"sdt","name":"Selective Data Transition / SDT (Carve-outs & Mergers)","short":"SDT (Carve-outs & Mergers)","pos":3}]},{"name":"Localization & Statutory","pos":2,"items":[{"id":"localization","name":"Localization & Statutory Compliance (e-Invoicing, VAT, country versions)","short":"Localization","pos":1}]},{"name":"Program Governance & Methodology","pos":3,"items":[{"id":"activate","name":"SAP Activate Methodology","short":"SAP Activate","pos":1},{"id":"pmo","name":"Project Management & Governance (PMO)","short":"Project Mgmt & Governance (PMO)","pos":2},{"id":"cutover","name":"Cutover & Go-Live","short":"Cutover","pos":3}]},{"name":"Data Management","pos":4,"items":[{"id":"data-migration","name":"Data Migration & ETL (Migration Cockpit, BODS, Syniti)","short":"Data Migration & ETL","pos":1},{"id":"mdg","name":"Master Data Governance (SAP MDG)","short":"MDG","pos":2},{"id":"data-cleansing","name":"Data Cleansing & Quality","short":"Data Cleansing","pos":3}]}]},{"id":"engineering","name":"Engineering, Quality & Platform Operations","pos":3,"groups":[{"name":"Platform & Extensibility","pos":1,"items":[{"id":"btp","name":"SAP BTP (Business Technology Platform)","short":"BTP","pos":1},{"id":"build","name":"SAP Build & Low-Code / No-Code Automation","short":"SAP Build","pos":2},{"id":"extensibility","name":"Extensibility (RAP / CAP / Side-by-side)","short":"Extensibility","pos":3}]},{"name":"Quality, Testing & ALM","pos":2,"items":[{"id":"testing","name":"Test Management & Automation (Tricentis / Tosca)","short":"Test Automation","pos":1},{"id":"alm","name":"SAP Cloud ALM / Solution Manager","short":"Cloud ALM / SolMan","pos":2},{"id":"uat","name":"UAT Coordination","short":"UAT Coordination","pos":3},{"id":"release","name":"Release Management","short":"Release Mgmt","pos":4},{"id":"upgrades","name":"Release Upgrades (Feature & Support Packs)","short":"Release Upgrades","pos":5}]},{"name":"Security & Compliance","pos":3,"items":[{"id":"security","name":"SAP Security, Authorizations & GRC","short":"Security & GRC","pos":1}]},{"name":"Production Operations & Hypercare","pos":4,"items":[{"id":"hypercare","name":"Hypercare & Go-Live Transition","short":"Hypercare","pos":1},{"id":"ams","name":"AMS & Production Support (L2/L3)","short":"AMS & Support","pos":2},{"id":"sla","name":"SLA & Incident Management","short":"SLA / Incident","pos":3},{"id":"hadr","name":"High Availability & Disaster Recovery","short":"HA/DR","pos":4},{"id":"perf","name":"Performance Optimization & Health Checks","short":"Performance","pos":5}]}]},{"id":"adoption","name":"Adoption & Change Enablement","pos":4,"groups":[{"name":"","pos":1,"items":[{"id":"ocm","name":"Organizational Change Management (OCM)","short":"OCM","pos":1},{"id":"training","name":"User Enablement & Training","short":"Training & Enablement","pos":2},{"id":"process-doc","name":"Process Documentation","short":"Process Docs","pos":3}]}]},{"id":"ai","name":"AI & Intelligent Technologies","pos":5,"groups":[{"name":"AI Strategy & Architecture","pos":1,"items":[{"id":"ai-strategy","name":"Business AI Strategy & Roadmap","short":"Business AI Strategy","pos":1},{"id":"joule-config","name":"Joule Configuration & Activation","short":"Joule Config","pos":2}]},{"name":"AI Development","pos":2,"items":[{"id":"genai-dev","name":"Generative AI Development (AI Core / GenAI Hub / ABAP AI SDK)","short":"GenAI Development","pos":1},{"id":"agentic-ai","name":"Agentic AI & MCP (Multi-Agent Systems / AI Agents)","short":"Agentic AI","pos":2}]}]}],"roles":{"functional":["fit-standard","process-mining","greenfield","brownfield","activate","data-migration","mdg","cutover","localization","testing","hypercare","training"],"technical":["clean-core","extensibility","integration-arch","greenfield","brownfield","data-migration","btp","build","testing","hypercare","perf","joule-config","genai-dev","agentic-ai"],"basis":["rise","s4cloud-arch","clean-core","brownfield","sdt","cutover","hadr","btp","alm","security","hypercare","perf","joule-config"],"architect":["presales","value-discovery","rise","grow","s4cloud-arch","clean-core","integration-arch","fit-standard","process-mining","greenfield","brownfield","sdt","btp","ai-strategy","joule-config","genai-dev","agentic-ai"],"delivery":["rise","grow","greenfield","brownfield","sdt","activate","pmo","release","cutover","alm","hypercare","ocm","ai-strategy"],"support":["sla","upgrades","testing","alm","security","hypercare","ams","perf"],"keyuser":["fit-standard","process-mining","activate","data-cleansing","mdg","build","uat","hypercare","ocm","training"],"junior":["activate","data-migration","testing","process-doc","hypercare","training"]}}$json$::jsonb; p jsonb; m jsonb; a jsonb; g jsonb; it jsonb; r record; i int; sid text;
begin
  if exists (select 1 from public.catalog_products) then return; end if;
  for p in select * from jsonb_array_elements(s->'products') loop
    insert into public.catalog_products(id, name, short, pos) values (p->>'id', p->>'name', p->>'short', (p->>'pos')::int);
    for m in select * from jsonb_array_elements(p->'modules') loop
      insert into public.catalog_modules(product_id, id, name, family, pos) values (p->>'id', m->>'id', m->>'name', m->>'family', (m->>'pos')::int);
    end loop;
  end loop;
  for a in select * from jsonb_array_elements(s->'areas') loop
    insert into public.catalog_areas(id, name, pos) values (a->>'id', a->>'name', (a->>'pos')::int);
    for g in select * from jsonb_array_elements(a->'groups') loop
      for it in select * from jsonb_array_elements(g->'items') loop
        insert into public.catalog_specs(id, area_id, grp, grp_pos, name, short, pos)
        values (it->>'id', a->>'id', coalesce(g->>'name',''), (g->>'pos')::int, it->>'name', it->>'short', (it->>'pos')::int);
      end loop;
    end loop;
  end loop;
  for r in select key as rt, value as ids from jsonb_each(s->'roles') loop
    i := 0;
    for sid in select jsonb_array_elements_text(r.ids) loop
      i := i + 1;
      insert into public.catalog_role_spec(role_type, spec_id, pos) select r.rt, sid, i where exists (select 1 from public.catalog_specs where id = sid);
    end loop;
  end loop;
end $seed$;

-- ---------- reading (everyone) ----------------------------------------------
create or replace function public.get_catalog() returns jsonb
language sql stable security definer set search_path = public as
$$
select jsonb_build_object(
  'v', coalesce((select max(id) from public.catalog_log), 0),
  'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'short', p.short, 'hidden', p.hidden,
      'modules', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'family', m.family, 'hidden', m.hidden) order by m.pos, m.id)
                           from public.catalog_modules m where m.product_id = p.id), '[]'::jsonb)) order by p.pos, p.id)
                         from public.catalog_products p), '[]'::jsonb),
  'areas', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'hidden', a.hidden,
      'groups', coalesce((select jsonb_agg(jsonb_build_object('name', g.grp, 'items', g.items) order by g.gpos, g.grp)
                          from (select s.grp, min(s.grp_pos) as gpos,
                                       jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'short', s.short, 'hidden', s.hidden) order by s.pos, s.id) as items
                                  from public.catalog_specs s where s.area_id = a.id group by s.grp) g), '[]'::jsonb)) order by a.pos, a.id)
                       from public.catalog_areas a), '[]'::jsonb),
  'roles', coalesce((select jsonb_object_agg(x.rt, x.ids) from (select role_type as rt, jsonb_agg(spec_id order by pos) as ids from public.catalog_role_spec group by role_type) x), '{}'::jsonb),
  'merged', coalesce((select jsonb_agg(jsonb_build_array(product_id, id, split_part(merged_into, ':', 1), split_part(merged_into, ':', 2)))
                      from public.catalog_modules where merged_into is not null), '[]'::jsonb),
  'mergedSpecs', coalesce((select jsonb_agg(jsonb_build_array(id, merged_into)) from public.catalog_specs where merged_into is not null), '[]'::jsonb)
)
$$;

-- ---------- helpers ----------------------------------------------------------
create or replace function public._cat_log(p_action text, p_summary text, p_undo jsonb) returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  insert into public.catalog_log(admin, action, summary, undo)
  values (coalesce((select email from auth.users where id = auth.uid()), '?'), p_action, left(coalesce(p_summary, ''), 300), p_undo);
  perform public._audit('catalog ' || p_action, '', p_summary);
end $$;

create or replace function public._cat_slug(p_name text, p_sep text) returns text
language sql immutable as
$$ select coalesce(nullif(trim(both p_sep from left(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', case when p_sep = '' then '' else p_sep end, 'g'), 24)), ''), 'item') $$;

/* one skill list (profile skills or role requirements) with one module moved to another, duplicates folded together */
create or replace function public._cat_remap_skills(arr jsonb, fp text, fm text, tp text, tm text) returns jsonb
language plpgsql immutable as
$$
declare e jsonb; res jsonb := '[]'::jsonb; i int; hit int; cur jsonb; k text;
begin
  if arr is null or jsonb_typeof(arr) <> 'array' then return arr; end if;
  for e in select * from jsonb_array_elements(arr) loop
    if e->>'productId' = fp and e->>'moduleId' = fm then e := e || jsonb_build_object('productId', tp, 'moduleId', tm); end if;
    hit := -1;
    for i in 0 .. jsonb_array_length(res) - 1 loop
      if (res->i->>'productId') is not distinct from (e->>'productId') and (res->i->>'moduleId') is not distinct from (e->>'moduleId') then hit := i; exit; end if;
    end loop;
    if hit >= 0 then
      cur := res->hit;
      foreach k in array array['projects', 'minProjects'] loop
        if e ? k then cur := cur || jsonb_build_object(k, greatest(coalesce((cur->>k)::numeric, 0), coalesce((e->>k)::numeric, 0))); end if;
      end loop;
      if coalesce((e->>'certified')::boolean, false) then cur := cur || '{"certified": true}'::jsonb; end if;
      res := jsonb_set(res, array[hit::text], cur);
    else
      res := res || jsonb_build_array(e);
    end if;
  end loop;
  return res;
end $$;

create or replace function public._cat_remap_ids(arr jsonb, f text, t text) returns jsonb
language plpgsql immutable as
$$
declare e text; res jsonb := '[]'::jsonb;
begin
  if arr is null or jsonb_typeof(arr) <> 'array' then return arr; end if;
  for e in select jsonb_array_elements_text(arr) loop
    if e = f then e := t; end if;
    if not (res ? e) then res := res || to_jsonb(e); end if;
  end loop;
  return res;
end $$;

-- ---------- usage counts (admin) --------------------------------------------
create or replace function public.admin_catalog_usage() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare r jsonb;
begin
  perform public._require_admin();
  with sk as (
    select c.id as ent, 'c' as side, e->>'productId' as p, e->>'moduleId' as m
      from public.consultants c, jsonb_array_elements(case when jsonb_typeof(c.data->'skills') = 'array' then c.data->'skills' else '[]'::jsonb end) e where not c.sample
    union all
    select j.id, 'j', e->>'productId', e->>'moduleId'
      from public.jobs j, jsonb_array_elements(case when jsonb_typeof(j.data->'requires') = 'array' then j.data->'requires' else '[]'::jsonb end) e where not j.sample
    union all select q.id::text, 'q', q.product_id, q.module_id from public.questions q where not coalesce(q.sample, false) and q.product_id is not null
    union all select a.id::text, 'q', a.product_id, a.module_id from public.articles a where not coalesce(a.sample, false) and a.product_id is not null
  ), sp as (
    select c.id as ent, 'c' as side, s as sid from public.consultants c, jsonb_array_elements_text(case when jsonb_typeof(c.data->'specialties') = 'array' then c.data->'specialties' else '[]'::jsonb end) s where not c.sample
    union all
    select j.id, 'j', s from public.jobs j, jsonb_array_elements_text(case when jsonb_typeof(j.data->'preferredSpecialties') = 'array' then j.data->'preferredSpecialties' else '[]'::jsonb end) s where not j.sample
  )
  select jsonb_build_object(
    'mods', coalesce((select jsonb_object_agg(k, v) from (
        select p || ':' || coalesce(m, '') as k, jsonb_build_object('pros', count(distinct ent) filter (where side = 'c'), 'roles', count(distinct ent) filter (where side = 'j'), 'posts', count(distinct ent) filter (where side = 'q')) as v
          from sk where p is not null group by p, m) x), '{}'::jsonb),
    'prods', coalesce((select jsonb_object_agg(k, v) from (
        select p as k, jsonb_build_object('pros', count(distinct ent) filter (where side = 'c'), 'roles', count(distinct ent) filter (where side = 'j'), 'posts', count(distinct ent) filter (where side = 'q')) as v
          from sk where p is not null group by p) x), '{}'::jsonb),
    'specs', coalesce((select jsonb_object_agg(k, v) from (
        select sid as k, jsonb_build_object('pros', count(distinct ent) filter (where side = 'c'), 'roles', count(distinct ent) filter (where side = 'j')) as v from sp group by sid) x), '{}'::jsonb)
  ) into r;
  return r;
end $$;

create or replace function public.admin_catalog_log(p_limit int default 40) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare lastid bigint;
begin
  perform public._require_admin();
  select id into lastid from public.catalog_log where not undone order by id desc limit 1;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'ts', l.ts, 'admin', l.admin, 'action', l.action, 'summary', l.summary,
                                                      'undone', l.undone, 'canUndo', (l.id = lastid and l.undo is not null)) order by l.id desc)
                     from (select * from public.catalog_log order by id desc limit greatest(1, least(coalesce(p_limit, 40), 200))) l), '[]'::jsonb);
end $$;

-- ---------- editing (admin) -------------------------------------------------
create or replace function public.admin_catalog_save(p_op text, p_args jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare
  a jsonb := coalesce(p_args, '{}'::jsonb);
  nm text := btrim(coalesce(a->>'name', ''));
  sh text := btrim(coalesce(a->>'short', ''));
  hid boolean := coalesce((a->>'hidden')::boolean, false);
  fam text := coalesce(nullif(a->>'family', ''), '');
  rid text; base text; n int; undo jsonb := '[]'::jsonb; row0 jsonb; newid text; summary text;
  rt text; ids jsonb; i int; id1 text; cnt_p int := 0; cnt_j int := 0;
  fp text; fm text; tp text; tm text; gp int; ord jsonb; lg record; e jsonb;
  roles_ok text[] := array['functional','technical','basis','architect','delivery','support','keyuser','junior'];
begin
  perform public._require_admin();
  if p_op in ('product_save', 'module_save', 'area_save', 'spec_save') then
    if nm = '' then raise exception 'Please give it a name'; end if;
    if length(nm) > 120 then raise exception 'That name is too long'; end if;
    if length(sh) > 60 then raise exception 'The short label is too long'; end if;
    if fam not in ('', 'fin', 'log', 'tech') then raise exception 'Unknown match family'; end if;
  end if;

  if p_op = 'product_save' then
    rid := nullif(a->>'id', '');
    if rid is null then
      base := public._cat_slug(nm, ''); newid := base; n := 1;
      while exists (select 1 from public.catalog_products where id = newid) loop n := n + 1; newid := base || n; end loop;
      insert into public.catalog_products(id, name, short, pos, hidden) values (newid, nm, coalesce(nullif(sh, ''), nm), coalesce((select max(pos) from public.catalog_products), 0) + 1, hid);
      undo := jsonb_build_array(jsonb_build_object('t', 'products', 'k', jsonb_build_object('id', newid), 'row', null));
      summary := 'Added product "' || nm || '"';
    else
      select to_jsonb(p) into row0 from public.catalog_products p where id = rid;
      if row0 is null then raise exception 'Unknown product'; end if;
      update public.catalog_products set name = nm, short = coalesce(nullif(sh, ''), nm), hidden = hid where id = rid;
      newid := rid; undo := jsonb_build_array(jsonb_build_object('t', 'products', 'k', jsonb_build_object('id', rid), 'row', row0));
      summary := case when hid and not coalesce((row0->>'hidden')::boolean, false) then 'Hid product "' || nm || '"' when not hid and coalesce((row0->>'hidden')::boolean, false) then 'Unhid product "' || nm || '"' else 'Edited product "' || nm || '"' end;
    end if;
    perform public._cat_log('product', summary, undo);

  elsif p_op = 'module_save' then
    fp := a->>'product_id'; rid := nullif(a->>'id', '');
    if not exists (select 1 from public.catalog_products where id = fp) then raise exception 'Unknown product'; end if;
    if rid is null then
      base := public._cat_slug(nm, ''); newid := base; n := 1;
      while exists (select 1 from public.catalog_modules where product_id = fp and id = newid) loop n := n + 1; newid := base || n; end loop;
      insert into public.catalog_modules(product_id, id, name, family, pos, hidden) values (fp, newid, nm, fam, coalesce((select max(pos) from public.catalog_modules where product_id = fp), 0) + 1, hid);
      undo := jsonb_build_array(jsonb_build_object('t', 'modules', 'k', jsonb_build_object('product_id', fp, 'id', newid), 'row', null));
      summary := 'Added module "' || nm || '" to ' || (select name from public.catalog_products where id = fp);
    else
      select to_jsonb(m) into row0 from public.catalog_modules m where product_id = fp and id = rid;
      if row0 is null then raise exception 'Unknown module'; end if;
      update public.catalog_modules set name = nm, family = fam, hidden = hid where product_id = fp and id = rid;
      newid := rid; undo := jsonb_build_array(jsonb_build_object('t', 'modules', 'k', jsonb_build_object('product_id', fp, 'id', rid), 'row', row0));
      summary := case when hid and not coalesce((row0->>'hidden')::boolean, false) then 'Hid module "' || nm || '"' when not hid and coalesce((row0->>'hidden')::boolean, false) then 'Unhid module "' || nm || '"' else 'Edited module "' || nm || '"' end;
    end if;
    perform public._cat_log('module', summary, undo);

  elsif p_op = 'area_save' then
    rid := nullif(a->>'id', '');
    if rid is null then
      base := public._cat_slug(nm, ''); newid := base; n := 1;
      while exists (select 1 from public.catalog_areas where id = newid) loop n := n + 1; newid := base || n; end loop;
      insert into public.catalog_areas(id, name, pos, hidden) values (newid, nm, coalesce((select max(pos) from public.catalog_areas), 0) + 1, hid);
      undo := jsonb_build_array(jsonb_build_object('t', 'areas', 'k', jsonb_build_object('id', newid), 'row', null));
      summary := 'Added practice area "' || nm || '"';
    else
      select to_jsonb(x) into row0 from public.catalog_areas x where id = rid;
      if row0 is null then raise exception 'Unknown practice area'; end if;
      update public.catalog_areas set name = nm, hidden = hid where id = rid;
      newid := rid; undo := jsonb_build_array(jsonb_build_object('t', 'areas', 'k', jsonb_build_object('id', rid), 'row', row0));
      summary := case when hid and not coalesce((row0->>'hidden')::boolean, false) then 'Hid practice area "' || nm || '"' when not hid and coalesce((row0->>'hidden')::boolean, false) then 'Unhid practice area "' || nm || '"' else 'Edited practice area "' || nm || '"' end;
    end if;
    perform public._cat_log('area', summary, undo);

  elsif p_op = 'spec_save' then
    rid := nullif(a->>'id', ''); id1 := a->>'area_id';
    if not exists (select 1 from public.catalog_areas where id = id1) then raise exception 'Unknown practice area'; end if;
    base := btrim(coalesce(a->>'grp', ''));
    if length(base) > 80 then raise exception 'The group name is too long'; end if;
    select grp_pos into gp from public.catalog_specs where area_id = id1 and grp = base limit 1;
    if gp is null then gp := coalesce((select max(grp_pos) from public.catalog_specs where area_id = id1), 0) + 1; end if;
    if rid is null then
      base := public._cat_slug(nm, '-'); newid := base; n := 1;
      while exists (select 1 from public.catalog_specs where id = newid) or exists (select 1 from public.catalog_areas where id = newid) loop n := n + 1; newid := base || n; end loop;
      insert into public.catalog_specs(id, area_id, grp, grp_pos, name, short, pos, hidden)
      values (newid, id1, btrim(coalesce(a->>'grp', '')), gp, nm, coalesce(nullif(sh, ''), nm), coalesce((select max(pos) from public.catalog_specs where area_id = id1), 0) + 1, hid);
      undo := jsonb_build_array(jsonb_build_object('t', 'specs', 'k', jsonb_build_object('id', newid), 'row', null), jsonb_build_object('t', 'role_spec', 'spec_id', newid, 'rows', '[]'::jsonb));
      summary := 'Added specialty "' || nm || '"';
    else
      select to_jsonb(s) into row0 from public.catalog_specs s where id = rid;
      if row0 is null then raise exception 'Unknown specialty'; end if;
      update public.catalog_specs set area_id = id1, grp = btrim(coalesce(a->>'grp', '')), grp_pos = gp, name = nm, short = coalesce(nullif(sh, ''), nm), hidden = hid where id = rid;
      newid := rid;
      undo := jsonb_build_array(jsonb_build_object('t', 'specs', 'k', jsonb_build_object('id', rid), 'row', row0),
        jsonb_build_object('t', 'role_spec', 'spec_id', rid, 'rows', coalesce((select jsonb_agg(jsonb_build_object('role_type', role_type, 'pos', pos)) from public.catalog_role_spec where spec_id = rid), '[]'::jsonb)));
      summary := case when hid and not coalesce((row0->>'hidden')::boolean, false) then 'Hid specialty "' || nm || '"' when not hid and coalesce((row0->>'hidden')::boolean, false) then 'Unhid specialty "' || nm || '"' else 'Edited specialty "' || nm || '"' end;
    end if;
    if a ? 'roles' then
      for rt in select jsonb_array_elements_text(a->'roles') loop
        if not (rt = any (roles_ok)) then raise exception 'Unknown role type'; end if;
      end loop;
      delete from public.catalog_role_spec where spec_id = newid and not (a->'roles' ? role_type);
      for rt in select jsonb_array_elements_text(a->'roles') loop
        insert into public.catalog_role_spec(role_type, spec_id, pos)
        values (rt, newid, coalesce((select max(pos) from public.catalog_role_spec where role_type = rt), 0) + 1) on conflict do nothing;
      end loop;
    end if;
    perform public._cat_log('specialty', summary, undo);

  elsif p_op = 'reorder' then
    ids := a->'ids'; id1 := a->>'parent';
    if jsonb_typeof(ids) <> 'array' then raise exception 'Nothing to reorder'; end if;
    if a->>'kind' = 'product' then
      undo := jsonb_build_array(jsonb_build_object('t', 'reorder', 'kind', 'product', 'parent', '', 'ids', (select jsonb_agg(id order by pos, id) from public.catalog_products)));
      i := 0; for rt in select jsonb_array_elements_text(ids) loop i := i + 1; update public.catalog_products set pos = i where id = rt; end loop;
    elsif a->>'kind' = 'module' then
      undo := jsonb_build_array(jsonb_build_object('t', 'reorder', 'kind', 'module', 'parent', id1, 'ids', (select jsonb_agg(id order by pos, id) from public.catalog_modules where product_id = id1)));
      i := 0; for rt in select jsonb_array_elements_text(ids) loop i := i + 1; update public.catalog_modules set pos = i where product_id = id1 and id = rt; end loop;
    elsif a->>'kind' = 'area' then
      undo := jsonb_build_array(jsonb_build_object('t', 'reorder', 'kind', 'area', 'parent', '', 'ids', (select jsonb_agg(id order by pos, id) from public.catalog_areas)));
      i := 0; for rt in select jsonb_array_elements_text(ids) loop i := i + 1; update public.catalog_areas set pos = i where id = rt; end loop;
    elsif a->>'kind' = 'spec' then
      undo := jsonb_build_array(jsonb_build_object('t', 'reorder', 'kind', 'spec', 'parent', id1, 'ids', (select jsonb_agg(id order by pos, id) from public.catalog_specs where area_id = id1)));
      i := 0; for rt in select jsonb_array_elements_text(ids) loop i := i + 1; update public.catalog_specs set pos = i where area_id = id1 and id = rt; end loop;
    elsif a->>'kind' = 'group' then
      undo := jsonb_build_array(jsonb_build_object('t', 'reorder', 'kind', 'group', 'parent', id1, 'ids', (select jsonb_agg(grp order by gp0) from (select grp, min(grp_pos) as gp0 from public.catalog_specs where area_id = id1 group by grp) q)));
      i := 0; for rt in select jsonb_array_elements_text(ids) loop i := i + 1; update public.catalog_specs set grp_pos = i where area_id = id1 and grp = rt; end loop;
    else raise exception 'Unknown list'; end if;
    perform public._cat_log('reorder', 'Changed the order of ' || (a->>'kind') || 's', undo);

  elsif p_op = 'merge_module' then
    fp := a->>'from_p'; fm := a->>'from_m'; tp := a->>'to_p'; tm := a->>'to_m';
    if fp = tp and fm = tm then raise exception 'Choose a different module to merge into'; end if;
    if not exists (select 1 from public.catalog_modules where product_id = fp and id = fm) then raise exception 'Unknown module to merge'; end if;
    if not exists (select 1 from public.catalog_modules where product_id = tp and id = tm and not hidden) then raise exception 'The module to merge into must exist and be visible'; end if;
    update public.consultants set data = jsonb_set(data, '{skills}', public._cat_remap_skills(data->'skills', fp, fm, tp, tm))
      where jsonb_typeof(data->'skills') = 'array' and exists (select 1 from jsonb_array_elements(data->'skills') z where z->>'productId' = fp and z->>'moduleId' = fm);
    get diagnostics cnt_p = row_count;
    update public.jobs set data = jsonb_set(data, '{requires}', public._cat_remap_skills(data->'requires', fp, fm, tp, tm))
      where jsonb_typeof(data->'requires') = 'array' and exists (select 1 from jsonb_array_elements(data->'requires') z where z->>'productId' = fp and z->>'moduleId' = fm);
    get diagnostics cnt_j = row_count;
    update public.questions set product_id = tp, module_id = tm where product_id = fp and module_id = fm;
    update public.articles set product_id = tp, module_id = tm where product_id = fp and module_id = fm;
    update public.catalog_modules set hidden = true, merged_into = tp || ':' || tm where product_id = fp and id = fm;
    perform public._cat_log('merge', 'Merged module ' || fp || ':' || fm || ' into ' || tp || ':' || tm || ' (' || cnt_p || ' profiles, ' || cnt_j || ' roles)', null);
    return jsonb_build_object('catalog', public.get_catalog(), 'profiles', cnt_p, 'roles', cnt_j);

  elsif p_op = 'merge_spec' then
    fm := a->>'from'; tm := a->>'to';
    if fm = tm then raise exception 'Choose a different specialty to merge into'; end if;
    if not exists (select 1 from public.catalog_specs where id = fm) then raise exception 'Unknown specialty to merge'; end if;
    if not exists (select 1 from public.catalog_specs where id = tm and not hidden) then raise exception 'The specialty to merge into must exist and be visible'; end if;
    update public.consultants set data = jsonb_set(data, '{specialties}', public._cat_remap_ids(data->'specialties', fm, tm))
      where jsonb_typeof(data->'specialties') = 'array' and data->'specialties' ? fm;
    get diagnostics cnt_p = row_count;
    update public.jobs set data = jsonb_set(data, '{preferredSpecialties}', public._cat_remap_ids(data->'preferredSpecialties', fm, tm))
      where jsonb_typeof(data->'preferredSpecialties') = 'array' and data->'preferredSpecialties' ? fm;
    get diagnostics cnt_j = row_count;
    insert into public.catalog_role_spec(role_type, spec_id, pos) select role_type, tm, pos + 1000 from public.catalog_role_spec where spec_id = fm on conflict do nothing;
    delete from public.catalog_role_spec where spec_id = fm;
    update public.catalog_specs set hidden = true, merged_into = tm where id = fm;
    perform public._cat_log('merge', 'Merged specialty ' || fm || ' into ' || tm || ' (' || cnt_p || ' profiles, ' || cnt_j || ' roles)', null);
    return jsonb_build_object('catalog', public.get_catalog(), 'profiles', cnt_p, 'roles', cnt_j);

  elsif p_op = 'undo' then
    select * into lg from public.catalog_log where not undone order by id desc limit 1;
    if lg.id is null then raise exception 'Nothing to undo'; end if;
    if lg.undo is null then raise exception 'The last change was a merge. Merges cannot be undone.'; end if;
    for e in select * from jsonb_array_elements(lg.undo) loop
      if e->>'t' = 'products' then
        if e->'row' = 'null'::jsonb then delete from public.catalog_modules where product_id = e#>>'{k,id}'; delete from public.catalog_products where id = e#>>'{k,id}';
        else update public.catalog_products p set name = r.name, short = r.short, pos = r.pos, hidden = r.hidden from jsonb_populate_record(null::public.catalog_products, e->'row') r where p.id = r.id; end if;
      elsif e->>'t' = 'modules' then
        if e->'row' = 'null'::jsonb then delete from public.catalog_modules where product_id = e#>>'{k,product_id}' and id = e#>>'{k,id}';
        else update public.catalog_modules m set name = r.name, family = r.family, pos = r.pos, hidden = r.hidden from jsonb_populate_record(null::public.catalog_modules, e->'row') r where m.product_id = r.product_id and m.id = r.id; end if;
      elsif e->>'t' = 'areas' then
        if e->'row' = 'null'::jsonb then delete from public.catalog_areas where id = e#>>'{k,id}';
        else update public.catalog_areas x set name = r.name, pos = r.pos, hidden = r.hidden from jsonb_populate_record(null::public.catalog_areas, e->'row') r where x.id = r.id; end if;
      elsif e->>'t' = 'specs' then
        if e->'row' = 'null'::jsonb then delete from public.catalog_role_spec where spec_id = e#>>'{k,id}'; delete from public.catalog_specs where id = e#>>'{k,id}';
        else update public.catalog_specs x set area_id = r.area_id, grp = r.grp, grp_pos = r.grp_pos, name = r.name, short = r.short, pos = r.pos, hidden = r.hidden from jsonb_populate_record(null::public.catalog_specs, e->'row') r where x.id = r.id; end if;
      elsif e->>'t' = 'role_spec' then
        if exists (select 1 from public.catalog_specs where id = e->>'spec_id') then
          delete from public.catalog_role_spec where spec_id = e->>'spec_id';
          insert into public.catalog_role_spec(role_type, spec_id, pos) select r->>'role_type', e->>'spec_id', (r->>'pos')::int from jsonb_array_elements(e->'rows') r;
        end if;
      elsif e->>'t' = 'reorder' then
        ids := e->'ids'; id1 := e->>'parent'; i := 0;
        for rt in select jsonb_array_elements_text(ids) loop
          i := i + 1;
          if e->>'kind' = 'product' then update public.catalog_products set pos = i where id = rt;
          elsif e->>'kind' = 'module' then update public.catalog_modules set pos = i where product_id = id1 and id = rt;
          elsif e->>'kind' = 'area' then update public.catalog_areas set pos = i where id = rt;
          elsif e->>'kind' = 'spec' then update public.catalog_specs set pos = i where area_id = id1 and id = rt;
          elsif e->>'kind' = 'group' then update public.catalog_specs set grp_pos = i where area_id = id1 and grp = rt;
          end if;
        end loop;
      end if;
    end loop;
    update public.catalog_log set undone = true where id = lg.id;
    perform public._audit('catalog undo', '', lg.summary);
    return jsonb_build_object('catalog', public.get_catalog(), 'undone', lg.summary);
  else
    raise exception 'Unknown action';
  end if;
  return jsonb_build_object('catalog', public.get_catalog(), 'id', newid);
end $$;

revoke all on function public._cat_log(text,text,jsonb), public._cat_slug(text,text), public._cat_remap_skills(jsonb,text,text,text,text), public._cat_remap_ids(jsonb,text,text),
  public.admin_catalog_usage(), public.admin_catalog_log(int), public.admin_catalog_save(text,jsonb), public.get_catalog() from public, anon, authenticated;
grant execute on function public.get_catalog() to anon, authenticated;
grant execute on function public.admin_catalog_usage(), public.admin_catalog_log(int), public.admin_catalog_save(text,jsonb) to authenticated;

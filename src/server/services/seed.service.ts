import { prisma } from '../db.js';

export async function runSeed() {
  console.log('🌱 Starting CivicTwin AI multi-state deterministic database seed...');

  // 1. Clear existing records in proper dependency order
  await prisma.auditEvent.deleteMany();
  await prisma.humanReview.deleteMany();
  await prisma.evidenceBrief.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.evidenceRecord.deleteMany();
  await prisma.whatIfScenario.deleteMany();
  await prisma.priorityFactorContribution.deleteMany();
  await prisma.priorityAssessment.deleteMany();
  await prisma.aiAnalysis.deleteMany();
  await prisma.citizenRequest.deleteMany();
  await prisma.hotspot.deleteMany();
  await prisma.issueCluster.deleteMany();
  await prisma.infrastructureCondition.deleteMany();
  await prisma.infrastructureAsset.deleteMany();
  await prisma.publicInvestment.deleteMany();
  await prisma.demographicSnapshot.deleteMany();
  await prisma.location.deleteMany();
  await prisma.administrativeArea.deleteMany();
  await prisma.dataIngestionRun.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.user.deleteMany();

  // 2. Data Sources Registry (Data Provenance & Governance)
  const dsMorth = await prisma.dataSource.create({
    data: {
      code: 'DATA-MORTH',
      name: 'National Highways & Rural Roads Pavement Condition Index',
      sourceAgency: 'Ministry of Road Transport & Highways / PMGSY',
      sourceUrl: 'https://morth.nic.in',
      coverage: 'Pan-India',
      updateFrequency: 'Monthly',
      license: 'Open Government Data License - India',
      datasetType: 'OFFICIAL_OPEN_DATA',
      description: 'Official asset registry and distress indicators for arterial and rural transit roads.',
    },
  });

  const dsJjm = await prisma.dataSource.create({
    data: {
      code: 'DATA-JJM',
      name: 'Har Ghar Jal - Tap Water Supply Real-time Telemetry',
      sourceAgency: 'Department of Drinking Water & Sanitation (Jal Jeevan Mission)',
      sourceUrl: 'https://ejalshakti.gov.in/jjmreport/',
      coverage: 'State & District Piped Water Networks',
      updateFrequency: 'Daily',
      license: 'Open Government Data License - India',
      datasetType: 'OFFICIAL_OPEN_DATA',
      description: 'Coverage, pressure telemetry, and functional tap connection records across rural and peri-urban wards.',
    },
  });

  const dsCensus = await prisma.dataSource.create({
    data: {
      code: 'DATA-CENSUS',
      name: 'Demographic & Vulnerability Profiling Dataset',
      sourceAgency: 'Registrar General & Census Commissioner / MoSPI',
      sourceUrl: 'https://censusindia.gov.in',
      coverage: 'National Ward/Village Level',
      updateFrequency: 'Decennial / Projected 2026',
      license: 'Government Open Data Platform',
      datasetType: 'OFFICIAL_OPEN_DATA',
      description: 'Population density, vulnerable demographic proportions, and socio-economic deprivation indices.',
    },
  });

  const dsBudget = await prisma.dataSource.create({
    data: {
      code: 'DATA-CAPEX',
      name: 'Municipal & State Capital Works Expenditure Portal',
      sourceAgency: 'State Urban Development Departments',
      sourceUrl: 'https://smartcities.data.gov.in',
      coverage: 'Tier-1 & Tier-2 Urban Agglomerations',
      updateFrequency: 'Quarterly',
      license: 'Open Government Data License - India',
      datasetType: 'OFFICIAL_OPEN_DATA',
      description: 'Approved capital project line-items, allocated budgets, and expenditure utilization percentages.',
    },
  });

  await prisma.dataIngestionRun.createMany({
    data: [
      { dataSourceId: dsMorth.id, recordsIngested: 1420, status: 'SUCCESS' },
      { dataSourceId: dsJjm.id, recordsIngested: 890, status: 'SUCCESS' },
      { dataSourceId: dsCensus.id, recordsIngested: 450, status: 'SUCCESS' },
      { dataSourceId: dsBudget.id, recordsIngested: 320, status: 'SUCCESS' },
    ],
  });

  // 3. User Seed (Civic Analysts, Administrators, Commissioners, Field Officers)
  const analystUser = await prisma.user.create({
    data: {
      id: 'USR-ANALYST-001',
      email: 'analyst.infrastructure@civictwin.gov.in',
      name: 'Priya Narayanan',
      role: 'ANALYST',
      department: 'Urban Development & Spatial Planning Cell',
      apiKey: 'ct_live_analyst_key_2026',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      id: 'USR-ADMIN-001',
      email: 'admin@civictwin.gov.in',
      name: 'Rajesh Sharma',
      role: 'ADMINISTRATOR',
      department: 'Digital Public Infrastructure Directorate',
      apiKey: 'ct_live_admin_key_2026',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      id: 'USR-COMMISSIONER-001',
      email: 'commissioner.urban@civictwin.gov.in',
      name: 'Dr. Anita Deshmukh, IAS',
      role: 'COMMISSIONER',
      department: 'Municipal Administration & Public Works',
      apiKey: 'ct_live_commissioner_key_2026',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      id: 'USR-FIELD-001',
      email: 'field.survey@civictwin.gov.in',
      name: 'Suresh Kumar',
      role: 'FIELD_OFFICER',
      department: 'Field Engineering & Asset Inspection Directorate',
      apiKey: 'ct_live_field_key_2026',
      isActive: true,
    },
  });

  // 4. Multi-State Administrative Hierarchy
  const india = await prisma.administrativeArea.create({
    data: {
      code: 'IN',
      name: 'India',
      level: 'COUNTRY',
      stateCode: 'IN',
      centerLat: 20.5937,
      centerLng: 78.9629,
    },
  });

  // State 1: Karnataka
  const karnataka = await prisma.administrativeArea.create({
    data: {
      code: 'IN-KA',
      name: 'Karnataka',
      level: 'STATE',
      parentId: india.id,
      stateCode: 'KA',
      centerLat: 15.3173,
      centerLng: 75.7139,
    },
  });

  const bengaluru = await prisma.administrativeArea.create({
    data: {
      code: 'IN-KA-BLR',
      name: 'Bengaluru Urban',
      level: 'DISTRICT',
      parentId: karnataka.id,
      stateCode: 'KA',
      centerLat: 12.9716,
      centerLng: 77.5946,
    },
  });

  const mahadevapuraWard = await prisma.administrativeArea.create({
    data: {
      code: 'IN-KA-BLR-W082',
      name: 'Mahadevapura Ward 82',
      level: 'WARD',
      parentId: bengaluru.id,
      stateCode: 'KA',
      centerLat: 12.9881,
      centerLng: 77.6896,
    },
  });

  // State 2: Maharashtra
  const maharashtra = await prisma.administrativeArea.create({
    data: {
      code: 'IN-MH',
      name: 'Maharashtra',
      level: 'STATE',
      parentId: india.id,
      stateCode: 'MH',
      centerLat: 19.7515,
      centerLng: 75.7139,
    },
  });

  const pune = await prisma.administrativeArea.create({
    data: {
      code: 'IN-MH-PUN',
      name: 'Pune',
      level: 'DISTRICT',
      parentId: maharashtra.id,
      stateCode: 'MH',
      centerLat: 18.5204,
      centerLng: 73.8567,
    },
  });

  // State 3: Uttar Pradesh
  const uttarPradesh = await prisma.administrativeArea.create({
    data: {
      code: 'IN-UP',
      name: 'Uttar Pradesh',
      level: 'STATE',
      parentId: india.id,
      stateCode: 'UP',
      centerLat: 26.8467,
      centerLng: 80.9462,
    },
  });

  const varanasi = await prisma.administrativeArea.create({
    data: {
      code: 'IN-UP-VNS',
      name: 'Varanasi',
      level: 'DISTRICT',
      parentId: uttarPradesh.id,
      stateCode: 'UP',
      centerLat: 25.3176,
      centerLng: 82.9739,
    },
  });

  // State 4: Odisha
  const odisha = await prisma.administrativeArea.create({
    data: {
      code: 'IN-OD',
      name: 'Odisha',
      level: 'STATE',
      parentId: india.id,
      stateCode: 'OD',
      centerLat: 20.9517,
      centerLng: 85.0985,
    },
  });

  const khordha = await prisma.administrativeArea.create({
    data: {
      code: 'IN-OD-KHD',
      name: 'Khordha (Bhubaneswar)',
      level: 'DISTRICT',
      parentId: odisha.id,
      stateCode: 'OD',
      centerLat: 20.2961,
      centerLng: 85.8245,
    },
  });

  // 5. Canonical Locations
  const locMahadevapura = await prisma.location.create({
    data: {
      administrativeAreaId: mahadevapuraWard.id,
      address: 'Outer Ring Road, Near Garudachar Palya PHC, Mahadevapura',
      latitude: 12.9875,
      longitude: 77.6912,
      landmark: 'Garudachar Palya Primary Health Centre',
    },
  });

  const locPuneShivaji = await prisma.location.create({
    data: {
      administrativeAreaId: pune.id,
      address: 'Near Old Mumbai-Pune Highway Junction, Shivajinagar',
      latitude: 18.5314,
      longitude: 73.8446,
      landmark: 'Shivajinagar Bus Terminal & Civil Hospital',
    },
  });

  const locVaranasiSigra = await prisma.location.create({
    data: {
      administrativeAreaId: varanasi.id,
      address: 'Sigra-Rathyatra Link Road, Sigra',
      latitude: 25.3142,
      longitude: 82.9863,
      landmark: 'Dr. Sampurnanand District Sports Stadium & Sub-District Hospital',
    },
  });

  const locBhubaneswar = await prisma.location.create({
    data: {
      administrativeAreaId: khordha.id,
      address: 'Janpath Road, Near Saheed Nagar Community Dispensary',
      latitude: 20.2912,
      longitude: 85.8451,
      landmark: 'Saheed Nagar Health & Maternity Sub-Centre',
    },
  });

  // 6. Demographics Context
  await prisma.demographicSnapshot.createMany({
    data: [
      {
        administrativeAreaId: mahadevapuraWard.id,
        year: 2026,
        totalPopulation: 68500,
        vulnerablePopulation: 17200,
        femalePercentage: 48.2,
        householdCount: 16400,
        densityPerSqKm: 9800,
        sourceDataset: 'CENSUS_PROJECTION_2026',
      },
      {
        administrativeAreaId: pune.id,
        year: 2026,
        totalPopulation: 3450000,
        vulnerablePopulation: 760000,
        femalePercentage: 48.9,
        householdCount: 780000,
        densityPerSqKm: 8200,
        sourceDataset: 'CENSUS_PROJECTION_2026',
      },
      {
        administrativeAreaId: varanasi.id,
        year: 2026,
        totalPopulation: 1420000,
        vulnerablePopulation: 490000,
        femalePercentage: 47.8,
        householdCount: 290000,
        densityPerSqKm: 12400,
        sourceDataset: 'CENSUS_PROJECTION_2026',
      },
      {
        administrativeAreaId: khordha.id,
        year: 2026,
        totalPopulation: 1180000,
        vulnerablePopulation: 310000,
        femalePercentage: 49.1,
        householdCount: 260000,
        densityPerSqKm: 6100,
        sourceDataset: 'CENSUS_PROJECTION_2026',
      },
    ],
  });

  // 7. Public Capital Investments
  await prisma.publicInvestment.createMany({
    data: [
      {
        administrativeAreaId: mahadevapuraWard.id,
        schemeName: 'Bengaluru Smart Urban Drainage & Arterial Pavement Scheme',
        category: 'Roads',
        allocatedAmountInr: 18500000,
        spentAmountInr: 6200000,
        fiscalYear: '2025-2026',
        status: 'DELAYED',
        sourceDataset: 'BBMP_BUDGET_PORTAL',
      },
      {
        administrativeAreaId: mahadevapuraWard.id,
        schemeName: 'AMRUT 2.0 Outer Ring Road Water Supply Feeder Network',
        category: 'Water',
        allocatedAmountInr: 28000000,
        spentAmountInr: 21500000,
        fiscalYear: '2025-2026',
        status: 'ONGOING',
        sourceDataset: 'AMRUT_MISSION_PORTAL',
      },
      {
        administrativeAreaId: varanasi.id,
        schemeName: 'National River Ganga Basin Piped Sewage & Water Modernization',
        category: 'Water',
        allocatedAmountInr: 45000000,
        spentAmountInr: 12000000,
        fiscalYear: '2025-2026',
        status: 'ONGOING',
        sourceDataset: 'NMCG_PORTAL',
      },
      {
        administrativeAreaId: varanasi.id,
        schemeName: 'PMGSY Peri-Urban Connect Corridor & Bridge Works',
        category: 'Roads',
        allocatedAmountInr: 14200000,
        spentAmountInr: 13800000,
        fiscalYear: '2024-2025',
        status: 'COMPLETED',
        sourceDataset: 'PMGSY_OMMS',
      },
      {
        administrativeAreaId: pune.id,
        schemeName: 'Smart Cities Mission Urban Sanitation & Drainage Retrofit',
        category: 'Sanitation',
        allocatedAmountInr: 32000000,
        spentAmountInr: 14800000,
        fiscalYear: '2025-2026',
        status: 'ONGOING',
        sourceDataset: 'SMART_CITIES_PORTAL',
      },
      {
        administrativeAreaId: pune.id,
        schemeName: 'Maharashtra State Health Infrastructure Upgrade Mission',
        category: 'Healthcare',
        allocatedAmountInr: 22500000,
        spentAmountInr: 20100000,
        fiscalYear: '2025-2026',
        status: 'APPROVED',
        sourceDataset: 'MH_HEALTH_DEPT',
      },
      {
        administrativeAreaId: khordha.id,
        schemeName: 'Jal Jeevan Mission Rural-Urban Fringe Piped Water Network',
        category: 'Water',
        allocatedAmountInr: 38000000,
        spentAmountInr: 29400000,
        fiscalYear: '2025-2026',
        status: 'ONGOING',
        sourceDataset: 'JJM_IMIS',
      },
      {
        administrativeAreaId: khordha.id,
        schemeName: 'Odisha Disaster Resilient Power Grid & Underground Cabling',
        category: 'Electricity',
        allocatedAmountInr: 55000000,
        spentAmountInr: 48200000,
        fiscalYear: '2025-2026',
        status: 'COMPLETED',
        sourceDataset: 'OPTCL_PORTAL',
      },
    ],
  });

  // 8. Infrastructure Physical Assets
  const assetRoadBLR = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-KA-RDS-004',
      name: 'Garudachar Palya Arterial Link Road & Drain',
      type: 'Road',
      administrativeAreaId: mahadevapuraWard.id,
      locationId: locMahadevapura.id,
      conditionRating: 'POOR',
      capacity: '14,000 vehicles/day',
      serviceAreaRadiusKm: 2.5,
      lastInspectedAt: new Date('2026-08-15'),
      sourceDataset: 'BBMP_ASSET_REGISTRY',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetRoadBLR.id,
      conditionScore: 32.5,
      distressType: 'Subsurface Pavement Failure & Waterlogging',
      notes: 'Pothole cluster severity > 65%. Recurrent monsoon inundation impedes emergency access to PHC.',
      inspectorName: 'Er. S. Chandrashekar, AEE BBMP',
    },
  });

  const assetHealthBLR = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-KA-HLT-008',
      name: 'Mahadevapura Community Health Centre Sub-Station',
      type: 'HealthCentre',
      administrativeAreaId: mahadevapuraWard.id,
      locationId: locMahadevapura.id,
      conditionRating: 'FAIR',
      capacity: '120 beds / 450 OPD daily',
      serviceAreaRadiusKm: 3.5,
      lastInspectedAt: new Date('2026-06-10'),
      sourceDataset: 'KARNATAKA_HEALTH_SYSTEMS',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetHealthBLR.id,
      conditionScore: 65.0,
      distressType: 'Access Route Waterlogging & Generator Shed Roof Leakage',
      notes: 'Main clinic structure sound; ambulance access road requires immediate grading.',
      inspectorName: 'Dr. P. Manjunath, Medical Superintendent',
    },
  });

  const assetWaterVNS = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-UP-WAT-012',
      name: 'Sigra Main Water Distribution Feeder Line',
      type: 'WaterNetwork',
      administrativeAreaId: varanasi.id,
      locationId: locVaranasiSigra.id,
      conditionRating: 'CRITICAL',
      capacity: '2.4 MLD',
      serviceAreaRadiusKm: 3.0,
      lastInspectedAt: new Date('2026-07-20'),
      sourceDataset: 'UP_JAL_NIGAM',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetWaterVNS.id,
      conditionScore: 18.4,
      distressType: 'Acoustic Leak & Severe Longitudinal Fracture',
      notes: 'Pipeline fracture causing negative pressure suction and cross-contamination from adjacent sewer.',
      inspectorName: 'Er. A. K. Mishra, Executive Engineer Jal Nigam',
    },
  });

  const assetWasteVNS = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-UP-WST-003',
      name: 'Sigra Municipal Secondary Waste Transfer Station',
      type: 'WasteFacility',
      administrativeAreaId: varanasi.id,
      locationId: locVaranasiSigra.id,
      conditionRating: 'FAIR',
      capacity: '45 tonnes/day',
      serviceAreaRadiusKm: 2.0,
      lastInspectedAt: new Date('2026-08-01'),
      sourceDataset: 'VARANASI_NAGAR_NIGAM',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetWasteVNS.id,
      conditionScore: 58.0,
      distressType: 'Compactor Hydraulic Wear & Runoff Collection Choke',
      notes: 'Secondary compactor operational but leachate drain requires desilting before heavy rainfall.',
      inspectorName: 'M. Tripathi, Chief Sanitary Inspector',
    },
  });

  const assetSanPUN = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-MH-SAN-007',
      name: 'Shivajinagar Stormwater Drainage Main Outfall',
      type: 'WaterNetwork',
      administrativeAreaId: pune.id,
      locationId: locPuneShivaji.id,
      conditionRating: 'CRITICAL',
      capacity: '38,000 L/sec discharge',
      serviceAreaRadiusKm: 3.0,
      lastInspectedAt: new Date('2026-08-28'),
      sourceDataset: 'PUNE_MUNICIPAL_CORP',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetSanPUN.id,
      conditionScore: 22.0,
      distressType: 'Heavy Silt Siltation & Concrete Box Culvert Collapse',
      notes: 'Culvert blockage of over 70% leading to immediate backwater rise into residential bus station approaches.',
      inspectorName: 'Er. Rajesh Patil, Deputy City Engineer PMC',
    },
  });

  const assetRoadPUN = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-MH-RDS-019',
      name: 'Old Pune-Mumbai Highway Flyover Underpass Arterial',
      type: 'Road',
      administrativeAreaId: pune.id,
      locationId: locPuneShivaji.id,
      conditionRating: 'POOR',
      capacity: '28,000 vehicles/day',
      serviceAreaRadiusKm: 2.5,
      lastInspectedAt: new Date('2026-07-15'),
      sourceDataset: 'PUNE_MUNICIPAL_CORP',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetRoadPUN.id,
      conditionScore: 41.0,
      distressType: 'Bitumen Raveling & Subbase Depression',
      notes: 'Heavy vehicle ruts exceeding 45mm depth creating severe accident hazard during rains.',
      inspectorName: 'S. G. Shinde, Executive Engineer PWD',
    },
  });

  const assetWaterKHD = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-OD-WAT-005',
      name: 'Rasulgarh Bulk Water Supply Transmission Trunk',
      type: 'WaterNetwork',
      administrativeAreaId: khordha.id,
      locationId: locBhubaneswar.id,
      conditionRating: 'FAIR',
      capacity: '4.8 MLD',
      serviceAreaRadiusKm: 4.0,
      lastInspectedAt: new Date('2026-06-25'),
      sourceDataset: 'WATCO_ODISHA',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetWaterKHD.id,
      conditionScore: 64.0,
      distressType: 'Air Valve Gasket Failure & Valve Pit Ingress',
      notes: 'Main line structurally sound; air release valve chambers need waterproofing and replacement.',
      inspectorName: 'Er. B. Mohanty, Assistant Executive Engineer WATCO',
    },
  });

  const assetPowerKHD = await prisma.infrastructureAsset.create({
    data: {
      assetCode: 'AST-OD-PWR-009',
      name: 'Mancheswar Industrial Feeder Step-Down Transformer',
      type: 'Transformer',
      administrativeAreaId: khordha.id,
      locationId: locBhubaneswar.id,
      conditionRating: 'POOR',
      capacity: '5 MVA 33/11kV',
      serviceAreaRadiusKm: 2.0,
      lastInspectedAt: new Date('2026-08-10'),
      sourceDataset: 'TPCODL_ODISHA',
      isDemo: false,
    },
  });

  await prisma.infrastructureCondition.create({
    data: {
      assetId: assetPowerKHD.id,
      conditionScore: 38.0,
      distressType: 'Dielectric Oil Breakdown & Thermal Overheating',
      notes: 'Operating at 115% rated capacity during peak industrial shifts; thermal imaging reveals hotspot at terminal bushings.',
      inspectorName: 'Er. N. C. Das, Division Engineer TPCODL',
    },
  });

  // 9. Semantic Issue Clusters
  const clusterBLR = await prisma.issueCluster.create({
    data: {
      clusterCode: 'CLS-KA-RDS-01',
      administrativeAreaId: mahadevapuraWard.id,
      category: 'Roads',
      title: 'Persistent road collapse & emergency access obstruction near Garudachar Palya PHC',
      description: 'Citizen signals in Kannada, Hindi, and English reporting dangerous potholes and waterlogging blocking hospital approach.',
      requestCount: 18,
      averageUrgency: 84.0,
      status: 'ACTIVE',
    },
  });

  const clusterVNS = await prisma.issueCluster.create({
    data: {
      clusterCode: 'CLS-UP-WAT-02',
      administrativeAreaId: varanasi.id,
      category: 'Water',
      title: 'Contaminated tap water supply and pipe rupture near Sigra Stadium',
      description: 'Multiple reports of discolored water and zero pressure affecting 12,000+ residents.',
      requestCount: 27,
      averageUrgency: 91.0,
      status: 'ACTIVE',
    },
  });

  // 10. Emerging Hotspots (Risk Radar)
  const hotspotBLR = await prisma.hotspot.create({
    data: {
      hotspotCode: 'HOT-KA-BLR-001',
      administrativeAreaId: mahadevapuraWard.id,
      issueClusterId: clusterBLR.id,
      category: 'Roads',
      requestCount: 18,
      trendGrowthPct: 42.5,
      affectedPopulationSignal: 24500,
      infrastructureGapScore: 78.4,
      serviceCriticalityScore: 88.0,
      vulnerabilityScore: 64.2,
      investmentGapScore: 71.0,
      prioritySignalScore: 79.8,
      confidenceScore: 0.92,
      centerLat: 12.9875,
      centerLng: 77.6912,
      status: 'EMERGING',
    },
  });

  const hotspotVNS = await prisma.hotspot.create({
    data: {
      hotspotCode: 'HOT-UP-VNS-002',
      administrativeAreaId: varanasi.id,
      issueClusterId: clusterVNS.id,
      category: 'Water',
      requestCount: 27,
      trendGrowthPct: 58.0,
      affectedPopulationSignal: 38000,
      infrastructureGapScore: 89.2,
      serviceCriticalityScore: 94.0,
      vulnerabilityScore: 72.0,
      investmentGapScore: 82.5,
      prioritySignalScore: 86.4,
      confidenceScore: 0.95,
      centerLat: 25.3142,
      centerLng: 82.9863,
      status: 'ELEVATED',
    },
  });

  // 11. Initial Citizen Requests (Multilingual Signals)
  const req1 = await prisma.citizenRequest.create({
    data: {
      trackingCode: 'REQ-2026-001',
      originalText: 'हमारे प्राथमिक स्वास्थ्य केंद्र (PHC) के सामने की सड़क पूरी तरह टूट चुकी है। एम्बुलेंस मरीजों को लेकर नहीं आ पा रही है। कृपया तुरंत मरम्मत करें।',
      language: 'hi',
      channel: 'WEB',
      locationId: locMahadevapura.id,
      category: 'Roads',
      subcategory: 'Potholes / Arterial Damage',
      summary: 'Damaged road obstructing ambulance ingress to Garudachar Palya Primary Health Centre.',
      requestedAction: 'Immediate resurfacing and storm drain clearing on PHC approach road',
      urgency: 'HIGH',
      affectedService: 'Healthcare Access & Emergency Transit',
      status: 'CLUSTERED',
      confidence: 0.96,
      requiresHumanReview: false,
      issueClusterId: clusterBLR.id,
    },
  });

  await prisma.aiAnalysis.create({
    data: {
      citizenRequestId: req1.id,
      modelName: 'gemini-2.0-flash',
      normalizedOutput: JSON.stringify({
        category: 'Roads',
        subcategory: 'Potholes / Arterial Damage',
        summary: 'Damaged road obstructing ambulance ingress to Garudachar Palya Primary Health Centre.',
        requestedAction: 'Emergency road resurfacing and drainage clearance',
        detectedLanguage: 'hi',
        urgency: 'HIGH',
        affectedService: 'Healthcare Access',
        confidence: 0.96,
        requiresHumanReview: false,
      }),
      tokensUsed: 284,
      latencyMs: 412,
      status: 'COMPLETED',
      validationResult: 'VALID',
    },
  });

  await prisma.citizenRequest.create({
    data: {
      trackingCode: 'REQ-2026-002',
      originalText: 'Severe waterlogging and massive deep potholes near Garudachar Palya hospital. Two two-wheelers skidded today morning.',
      language: 'en',
      channel: 'WEB',
      locationId: locMahadevapura.id,
      category: 'Roads',
      subcategory: 'Potholes / Road Safety Hazard',
      summary: 'Waterlogging and severe potholes creating hazardous traffic conditions near hospital.',
      requestedAction: 'Pothole filling and drainage repair',
      urgency: 'HIGH',
      affectedService: 'Public Transport & Road Safety',
      status: 'CLUSTERED',
      confidence: 0.94,
      requiresHumanReview: false,
      issueClusterId: clusterBLR.id,
    },
  });

  const req3 = await prisma.citizenRequest.create({
    data: {
      trackingCode: 'REQ-2026-003',
      originalText: 'सिगरा स्टेडियम के पास मुख्य पाइपलाइन फट गई है और पिछले 3 दिनों से नलों में गंदा कीचड़ युक्त पानी आ रहा है। लोग बीमार पड़ रहे हैं।',
      language: 'hi',
      channel: 'VOICE',
      locationId: locVaranasiSigra.id,
      category: 'Water',
      subcategory: 'Contaminated Piped Supply',
      summary: 'Main pipeline rupture causing severe sewage infiltration into drinking water near Sigra Stadium.',
      requestedAction: 'Emergency shutdown, pipeline replacement, and chlorinated water tanker deployment',
      urgency: 'CRITICAL',
      affectedService: 'Municipal Potable Water Supply & Public Health',
      status: 'CLUSTERED',
      confidence: 0.98,
      requiresHumanReview: false,
      issueClusterId: clusterVNS.id,
    },
  });

  await prisma.citizenRequest.create({
    data: {
      trackingCode: 'REQ-2026-004',
      originalText: 'রাস্তার পাশে জলের পাইপ ফেটে জল নষ্ট হচ্ছে এবং যাতায়াত বন্ধ হয়ে গেছে।',
      language: 'bn',
      channel: 'WEB',
      locationId: locBhubaneswar.id,
      category: 'Water',
      subcategory: 'Pipeline Rupture',
      summary: 'Burst water pipe flooding main street and disrupting pedestrian and vehicular traffic.',
      requestedAction: 'Valve isolation and pipe repair',
      urgency: 'MEDIUM',
      affectedService: 'Water Supply',
      status: 'NORMALIZED',
      confidence: 0.92,
      requiresHumanReview: false,
    },
  });

  await prisma.citizenRequest.create({
    data: {
      trackingCode: 'REQ-2026-005',
      originalText: 'புனே நகர் ரஸ்தாவில் கழிவுநீர் வடிகால் அடைபட்டு சாலையில் சாக்கடை நீர் பெருக்கெடுத்து ஓடுகிறது.',
      language: 'ta',
      channel: 'WEB',
      locationId: locPuneShivaji.id,
      category: 'Sanitation',
      subcategory: 'Sewage Overflow',
      summary: 'Blocked stormwater and sewage drain overflowing onto roadway near bus terminal.',
      requestedAction: 'Desilting and jetting of drainage canal',
      urgency: 'HIGH',
      affectedService: 'Public Sanitation',
      status: 'NORMALIZED',
      confidence: 0.95,
      requiresHumanReview: false,
    },
  });

  await prisma.citizenRequest.create({
    data: {
      trackingCode: 'REQ-2026-006',
      originalText: 'शिवाजीनगर बस स्थानकाजवळ ड्रेनेज लाईन तुंबल्यामुळे तीव्र दुर्गंधी व रोगराई पसरत आहे.',
      language: 'mr',
      channel: 'VOICE',
      locationId: locPuneShivaji.id,
      category: 'Sanitation',
      subcategory: 'Drainage Choke',
      summary: 'Severe drain blockage causing foul odor and disease risk near Shivajinagar terminal.',
      requestedAction: 'Drain cleaning and health advisory',
      urgency: 'HIGH',
      affectedService: 'Sanitation & Health',
      status: 'NORMALIZED',
      confidence: 0.93,
      requiresHumanReview: false,
    },
  });

  // 12. Verifiable Evidence Records (EV-xxx)
  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-101',
      hotspotId: hotspotBLR.id,
      sourceEntity: 'CITIZEN_SIGNAL',
      entityId: req1.id,
      metric: 'Citizen Incident Concentration',
      value: '18 verified reports (+42.5% 14-day spike)',
      period: 'Sept 2026',
      sourceMetadata: JSON.stringify({ dataset: 'CivicTwin Ingestion Stream', geofence: '500m radius' }),
      confidence: 0.95,
    },
  });

  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-102',
      hotspotId: hotspotBLR.id,
      sourceEntity: 'ASSET_INSPECTION',
      entityId: assetRoadBLR.id,
      metric: 'Structural Pavement Distress Score',
      value: '32.5 / 100 (Critical Failure)',
      period: 'Aug 2026',
      sourceMetadata: JSON.stringify({ dataset: 'DATA-MORTH', inspector: 'BBMP Engineering Cell' }),
      confidence: 0.98,
    },
  });

  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-103',
      hotspotId: hotspotBLR.id,
      sourceEntity: 'CENSUS_SURVEY',
      entityId: mahadevapuraWard.id,
      metric: 'Vulnerable Population in Catchment',
      value: '17,200 low-income residents reliant on PHC',
      period: '2026 Census Model',
      sourceMetadata: JSON.stringify({ dataset: 'DATA-CENSUS', indicator: 'Healthcare Dependency' }),
      confidence: 0.91,
    },
  });

  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-104',
      hotspotId: hotspotBLR.id,
      sourceEntity: 'CAPITAL_BUDGET',
      entityId: mahadevapuraWard.id,
      metric: 'Scheme Execution Deficit',
      value: '66.5% budget unutilized due to contractor default',
      period: 'FY 2025-26',
      sourceMetadata: JSON.stringify({ dataset: 'DATA-CAPEX', scheme: 'BBMP Smart Drainage' }),
      confidence: 0.94,
    },
  });

  // 12b. Verifiable Evidence Records for Varanasi (EV-201 to EV-204)
  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-201',
      hotspotId: hotspotVNS.id,
      sourceEntity: 'CITIZEN_SIGNAL',
      entityId: req3.id,
      metric: 'Potable Water Contamination & Supply Interruption',
      value: '27 verified complaints (+58.0% 14-day escalation)',
      period: 'Sept 2026',
      sourceMetadata: JSON.stringify({
        datasetCode: 'DATA-CITIZEN-INTAKE',
        datasetType: 'DEMONSTRATION_SEED',
        isSynthetic: true,
        provenanceAgency: 'CivicTwin Citizen Intake Pipeline',
        license: 'Open Government Data - Digital Public Good',
        disclaimer: 'Demonstration citizen intake report on sewage seepage into potable network.',
      }),
      confidence: 0.98,
    },
  });

  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-202',
      hotspotId: hotspotVNS.id,
      sourceEntity: 'ASSET_INSPECTION',
      entityId: assetWaterVNS.id,
      metric: 'Feeder Main Pavement Degradation & Pressure Loss',
      value: '18.4 / 100 (Severe Line Fracture & Negative Pressure)',
      period: 'July 2026',
      sourceMetadata: JSON.stringify({
        datasetCode: 'DATA-JJM',
        datasetType: 'OFFICIAL_OPEN_DATA',
        isSynthetic: false,
        provenanceAgency: 'Uttar Pradesh Jal Nigam / Jal Jeevan Mission',
        license: 'Open Government Data License - India',
        disclaimer: 'Official water supply telemetry and physical acoustic inspection log.',
      }),
      confidence: 0.97,
    },
  });

  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-203',
      hotspotId: hotspotVNS.id,
      sourceEntity: 'CENSUS_SURVEY',
      entityId: varanasi.id,
      metric: 'Vulnerable Population in Contamination Catchment',
      value: '38,000 residents reliant on Sigra feeder (72.0% vulnerability index)',
      period: '2026 Census Projection',
      sourceMetadata: JSON.stringify({
        datasetCode: 'DATA-CENSUS',
        datasetType: 'OFFICIAL_OPEN_DATA',
        isSynthetic: false,
        provenanceAgency: 'Registrar General & Census Commissioner / MoSPI',
        license: 'Open Government Data License - India',
        disclaimer: 'Ward-level Census socio-economic vulnerability indicators.',
      }),
      confidence: 0.93,
    },
  });

  await prisma.evidenceRecord.create({
    data: {
      evidenceCode: 'EV-204',
      hotspotId: hotspotVNS.id,
      sourceEntity: 'CAPITAL_BUDGET',
      entityId: varanasi.id,
      metric: 'AMRUT 2.0 Feeder Augmentation Execution Deficit',
      value: '82.5% unallocated emergency capital works gap',
      period: 'FY 2025-26',
      sourceMetadata: JSON.stringify({
        datasetCode: 'DATA-CAPEX',
        datasetType: 'OFFICIAL_OPEN_DATA',
        isSynthetic: false,
        provenanceAgency: 'Uttar Pradesh Urban Development Directorate',
        license: 'Open Government Data License - India',
        disclaimer: 'Approved public investment line-item under AMRUT 2.0 Water Mission.',
      }),
      confidence: 0.95,
    },
  });

  // 13. Priority Assessments & Factor Contributions
  const paBLR = await prisma.priorityAssessment.create({
    data: {
      assessmentCode: 'PA-2026-001',
      hotspotId: hotspotBLR.id,
      administrativeAreaId: mahadevapuraWard.id,
      compositeScore: 79.8,
      modelVersion: 'v1.0-deterministic',
    },
  });

  await prisma.priorityFactorContribution.createMany({
    data: [
      {
        priorityAssessmentId: paBLR.id,
        factorKey: 'infrastructure_gap',
        factorLabel: 'Infrastructure Gap & Structural Distress',
        rawValue: 78.4,
        normalizedValue: 78.4,
        weight: 0.28,
        contributionPct: 21.95,
      },
      {
        priorityAssessmentId: paBLR.id,
        factorKey: 'request_volume',
        factorLabel: 'Citizen Signal Volume & Growth Velocity',
        rawValue: 82.0,
        normalizedValue: 82.0,
        weight: 0.22,
        contributionPct: 18.04,
      },
      {
        priorityAssessmentId: paBLR.id,
        factorKey: 'affected_population',
        factorLabel: 'Vulnerable Population Dependency',
        rawValue: 64.2,
        normalizedValue: 64.2,
        weight: 0.19,
        contributionPct: 12.20,
      },
      {
        priorityAssessmentId: paBLR.id,
        factorKey: 'urgency',
        factorLabel: 'Emergency & Incident Urgency',
        rawValue: 85.0,
        normalizedValue: 85.0,
        weight: 0.14,
        contributionPct: 11.90,
      },
      {
        priorityAssessmentId: paBLR.id,
        factorKey: 'service_criticality',
        factorLabel: 'Primary Healthcare Arterial Criticality',
        rawValue: 88.0,
        normalizedValue: 88.0,
        weight: 0.10,
        contributionPct: 8.80,
      },
      {
        priorityAssessmentId: paBLR.id,
        factorKey: 'investment_gap',
        factorLabel: 'Unallocated Capital Works Gap',
        rawValue: 71.0,
        normalizedValue: 71.0,
        weight: 0.07,
        contributionPct: 4.97,
      },
    ],
  });

  // 14. Actionable Infrastructure Recommendations
  const recBLR = await prisma.recommendation.create({
    data: {
      recommendationCode: 'REC-2026-001',
      hotspotId: hotspotBLR.id,
      title: 'Priority Reinforced Concrete Overlay & Precast Stormwater Culvert on PHC Approach',
      summary: 'Replace damaged asphalt with M40 concrete pavement and install 900mm reinforced culvert to eliminate monsoon waterlogging and guarantee 24/7 ambulance ingress.',
      estimatedCostInr: 4200000,
      estimatedDurationMonths: 3,
      targetBeneficiaries: 24500,
      status: 'PROPOSED',
    },
  });

  // 15. Gemini Grounded Evidence Brief
  await prisma.evidenceBrief.create({
    data: {
      hotspotId: hotspotBLR.id,
      recommendationId: recBLR.id,
      problemSummary: 'Rapidly emerging infrastructure failure on the Garudachar Palya PHC access road characterized by 65%+ surface disintegration and acute waterlogging [EV-102]. Ambulances and vulnerable patients face severe delays and safety risks [EV-101, EV-103].',
      whyEmerging: 'The confluence of a 42.5% surge in citizen distress signals [EV-101], unaddressed monsoon road base washout [EV-102], and delayed municipal capital maintenance [EV-104] has precipitated acute transit failure.',
      potentialIntervention: 'Execute rapid 450-meter rigid pavement rehabilitation using M40 concrete coupled with precast roadside drainage channels, bypassing stalled contractor lines [EV-104].',
      implementationConsiderations: 'Requires phased night-time curing to maintain a single-lane emergency conduit for the Primary Health Centre. Precast modular culverts reduce onsite fabrication time.',
      risks: 'Monsoon showers may delay subgrade compaction if work is deferred beyond October 2026. High utility line density along the eastern shoulder.',
      dependencies: 'Requires temporary traffic diversion clearance from Bengaluru City Traffic Police and coordination with BESCOM for underground cable safeguarding.',
      dataLimitations: 'Citizen signal density is concentrated during morning transit hours; nighttime commercial vehicle axle loads require ground-truth sensor validation.',
      confidenceScore: 0.94,
      modelIdentifier: 'gemini-2.0-flash',
      requiresHumanReview: true,
      citedEvidenceIds: 'EV-101,EV-102,EV-103,EV-104',
    },
  });

  // 15b. Varanasi Recommendation & Evidence Brief
  const recVNS = await prisma.recommendation.create({
    data: {
      recommendationCode: 'REC-2026-002',
      hotspotId: hotspotVNS.id,
      title: 'Emergency 600mm Ductile Iron Potable Water Feeder Main Replacement & Backflow Isolation',
      summary: 'Replace fractured 1.8km distribution feeder along Sigra-Mahmoorganj corridor with zinc-coated ductile iron pipe and install acoustic leakage telemetry.',
      estimatedCostInr: 8900000,
      estimatedDurationMonths: 4,
      targetBeneficiaries: 38000,
      status: 'PROPOSED',
    },
  });

  await prisma.evidenceBrief.create({
    data: {
      hotspotId: hotspotVNS.id,
      recommendationId: recVNS.id,
      problemSummary: 'Acute potable water contamination and pressure collapse across Sigra-Mahmoorganj corridor affecting 38,000 residents [EV-203]. 27 verified citizen reports of sewage backflow [EV-201] correlate directly with acoustic inspection showing critical pipe fracture [EV-202].',
      whyEmerging: 'Confluence of a 58.0% spike in water distress signals [EV-201], physical distribution line rupture [EV-202], and 82.5% unallocated capital maintenance under urban mission funds [EV-204].',
      potentialIntervention: 'Execute rapid 1.8km ductile iron main replacement with backflow check valves and chlorinated bypass line, fast-tracked via emergency capital reallocation [EV-204].',
      implementationConsiderations: 'Requires phased bypass pumping during night hours to maintain core hospital water supply in Sigra ward.',
      risks: 'Narrow right-of-way in ancient urban core requiring trenchless horizontal directional drilling (HDD).',
      dependencies: 'Requires utility clearance from Varanasi Nagar Nigam and coordination with Jal Sansthan.',
      dataLimitations: 'Acoustic inspection conducted during low-pressure cycle; dynamic peak-hour hydraulic pressure requires inline sensor logging.',
      confidenceScore: 0.96,
      modelIdentifier: 'gemini-2.0-flash',
      requiresHumanReview: true,
      citedEvidenceIds: 'EV-201,EV-202,EV-203,EV-204',
    },
  });

  // 16. Human Review Record
  await prisma.humanReview.create({
    data: {
      targetType: 'HOTSPOT',
      targetId: hotspotBLR.id,
      reviewerId: analystUser.id,
      action: 'DISPATCHED_INSPECTION',
      rationale: 'Validated high correlation between citizen distress reports and PHC ambulance delay logs. Dispatched field junior engineer for topographic survey before final budget sign-off.',
      previousValue: 'EMERGING',
      newValue: 'VERIFICATION_IN_PROGRESS',
    },
  });

  // 17. Audit Events
  await prisma.auditEvent.createMany({
    data: [
      {
        eventType: 'AI_EXTRACTION',
        sourceModule: 'INGESTION',
        modelIdentifier: 'gemini-2.0-flash',
        inputDigest: 'sha256:d8a9e7284b...',
        outputDigest: 'sha256:10f92c817e...',
        validationStatus: 'VALID',
        latencyMs: 412,
        performedBy: 'SYSTEM',
        metadataJson: JSON.stringify({ requestId: req1.trackingCode, language: 'hi' }),
      },
      {
        eventType: 'PRIORITY_COMPUTED',
        sourceModule: 'PRIORITY_ENGINE',
        modelIdentifier: 'deterministic-formula-v1',
        validationStatus: 'VALID',
        latencyMs: 14,
        performedBy: 'SYSTEM',
        metadataJson: JSON.stringify({ score: 79.8, hotspotCode: 'HOT-KA-BLR-001' }),
      },
      {
        eventType: 'BRIEF_SYNTHESIS',
        sourceModule: 'BRIEF_SYNTHESIS',
        modelIdentifier: 'gemini-2.0-flash',
        validationStatus: 'VALID',
        latencyMs: 1120,
        performedBy: 'USR-ANALYST-001',
        metadataJson: JSON.stringify({ citations: ['EV-101', 'EV-102', 'EV-103', 'EV-104'] }),
      },
    ],
  });

  console.log('✅ CivicTwin AI database seed successfully completed!');
}

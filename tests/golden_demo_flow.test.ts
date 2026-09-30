import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';

describe('CivicTwin AI - Golden Demo Flow 5x Verification', () => {
  const demoScenarios = [
    {
      iteration: 1,
      language: 'hi',
      channel: 'VOICE',
      text: 'वाराणसी सिगरा वार्ड 12 में मुख्य पेयजल पाइपलाइन टूट गई है और बदबूदार पानी आ रहा है।',
      address: 'Sigra Stadium Road, Ward 12, Varanasi, Uttar Pradesh',
      lat: 25.3176,
      lng: 82.9739,
      category: 'Water',
    },
    {
      iteration: 2,
      language: 'en',
      channel: 'WEB',
      text: 'Severe road collapse, deep potholes, and waterlogging on Outer Ring Road Mahadevapura blocking emergency ambulance access.',
      address: 'Outer Ring Road, Opp Garudachar Palya PHC, Mahadevapura, Bengaluru',
      lat: 12.9875,
      lng: 77.6912,
      category: 'Roads',
    },
    {
      iteration: 3,
      language: 'bn',
      channel: 'VOICE',
      text: 'উত্তর কলকাতায় নিকাশী নালা বন্ধ হয়ে রাস্তা প্লাবিত এবং প্রাথমিক স্বাস্থ্যকেন্দ্রে জল ঢুকছে।',
      address: 'Bidhan Sarani, Ward 45, North Kolkata, West Bengal',
      lat: 22.5833,
      lng: 88.3712,
      category: 'Water',
    },
    {
      iteration: 4,
      language: 'ta',
      channel: 'MESSAGING',
      text: 'வியாசர்பாடி பகுதியில் மழைநீர் வடிகால் உடைந்து கழிவுநீர் தெருவில் தேங்கி சுகாதார சீர்கேடு ஏற்பட்டுள்ளது.',
      address: 'Perambur High Road, Vyasarpadi, Zone 4, Chennai, Tamil Nadu',
      lat: 13.1075,
      lng: 80.2612,
      category: 'Sanitation',
    },
    {
      iteration: 5,
      language: 'mr',
      channel: 'VOICE',
      text: 'पुणे नगर रस्त्यावरील मुख्य ड्रेनेज लाईन फुटल्यामुळे रस्त्यावर घाण पाणी येत आहे आणि वाहतूक ठप्प झाली आहे.',
      address: 'Ahmednagar Road, Somnath Nagar, Vadgaon Sheri, Pune, Maharashtra',
      lat: 18.5524,
      lng: 73.9182,
      category: 'Sanitation',
    },
  ];

  for (const scenario of demoScenarios) {
    it(`executes golden demo flow iteration ${scenario.iteration} (${scenario.language.toUpperCase()} / ${scenario.channel})`, async () => {
      // -------------------------------------------------------------
      // Step 1: Citizen Ingestion (Multilingual & Channel Ingestion)
      // -------------------------------------------------------------
      const uniqueText = `${scenario.text} [Iter ${scenario.iteration} - ${Date.now()}]`;
      const ingestRes = await request(app)
        .post('/api/v1/citizen/requests')
        .send({
          originalText: uniqueText,
          language: scenario.language,
          channel: scenario.channel,
          location: {
            address: scenario.address,
            latitude: scenario.lat,
            longitude: scenario.lng,
          },
        });

      expect(ingestRes.status).toBe(201);
      expect(ingestRes.body.success).toBe(true);
      const trackingCode = ingestRes.body.data.trackingCode;
      const citizenRequestId = ingestRes.body.data.id;
      expect(trackingCode).toBeDefined();
      expect(ingestRes.body.data.originalText).toBe(uniqueText); // Verbatim content preserved

      // -------------------------------------------------------------
      // Step 2: Risk Radar (Geographic Aggregation & Hotspots)
      // -------------------------------------------------------------
      const radarRes = await request(app).get('/api/v1/radar/hotspots');
      expect(radarRes.status).toBe(200);
      expect(radarRes.body.success).toBe(true);
      expect(radarRes.body.data.length).toBeGreaterThan(0);

      const targetHotspot = radarRes.body.data[0];
      const hotspotId = targetHotspot.id;
      expect(hotspotId).toBeDefined();

      // -------------------------------------------------------------
      // Step 3: Evidence Graph & Traceability
      // -------------------------------------------------------------
      const graphRes = await request(app).get(`/api/v1/evidence-graph/hotspot/${hotspotId}`);
      expect(graphRes.status).toBe(200);
      expect(graphRes.body.success).toBe(true);
      expect(graphRes.body.data.nodes).toBeDefined();
      expect(graphRes.body.data.edges).toBeDefined();

      // -------------------------------------------------------------
      // Step 4: Explainable Priority Engine & What-If Simulation
      // -------------------------------------------------------------
      const priorityRes = await request(app)
        .post(`/api/v1/priority/calculate/${hotspotId}`)
        .send({
          weights: {
            affectedPopulation: 0.25,
            infrastructureGap: 0.25,
            urgencyTrend: 0.20,
            socialVulnerability: 0.15,
            budgetFeasibility: 0.15,
          },
        });

      expect(priorityRes.status).toBe(200);
      expect(priorityRes.body.success).toBe(true);
      expect(priorityRes.body.data.compositeScore).toBeGreaterThanOrEqual(0);
      expect(priorityRes.body.data.compositeScore).toBeLessThanOrEqual(100);
      expect(priorityRes.body.data.factors).toBeDefined();
      expect(priorityRes.body.data.factors.length).toBe(6);

      // -------------------------------------------------------------
      // Step 5: Gemini Evidence Brief Generation
      // -------------------------------------------------------------
      const briefRes = await request(app).post(`/api/v1/briefs/generate/${hotspotId}`);
      expect(briefRes.status).toBe(201);
      expect(briefRes.body.success).toBe(true);
      expect(briefRes.body.data.id).toBeDefined();
      expect(briefRes.body.data.problemSummary).toBeDefined();
      expect(briefRes.body.data.auditRecordId).toBeDefined();

      // -------------------------------------------------------------
      // Step 6: Tamper-Evident SHA-256 Audit Verification
      // -------------------------------------------------------------
      const auditRes = await request(app).get('/api/v1/audit/logs?limit=5');
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.success).toBe(true);
      expect(auditRes.body.data.length).toBeGreaterThan(0);
      expect(auditRes.body.data[0].inputDigest).toBeDefined();

      // Verify request in DB directly
      const dbReq = await prisma.citizenRequest.findUnique({
        where: { id: citizenRequestId },
      });
      expect(dbReq).not.toBeNull();
      expect(dbReq?.trackingCode).toBe(trackingCode);
      expect(dbReq?.channel).toBe(scenario.channel);
    });
  }
});

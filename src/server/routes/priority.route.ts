import { Router } from 'express';
import { DEFAULT_PRIORITY_WEIGHTS, PRIORITY_FACTOR_LABELS } from '../../shared/constants.js';
import {
  WhatIfScenarioInputSchema,
  CalculatePriorityInputSchema,
} from '../../shared/schemas/priority.schema.js';
import {
  calculateHotspotPriority,
  getHistoricalAssessments,
  getSingleAssessment,
  compareAssessments,
  PRIORITY_FACTOR_UNITS,
  PRIORITY_MODEL_VERSIONS,
} from '../services/priority.service.js';
import {
  runWhatIfSimulation,
  getScenariosForHotspot,
  getScenarioDetail,
  getSimulationPresets,
} from '../services/simulator.service.js';

export const priorityRouter = Router();

// GET /api/v1/priority/factors - Current analytical weights, models, and units
priorityRouter.get('/priority/factors', (_req, res) => {
  res.json({
    success: true,
    modelVersion: 'v1.0-deterministic',
    weights: DEFAULT_PRIORITY_WEIGHTS,
    labels: PRIORITY_FACTOR_LABELS,
    units: PRIORITY_FACTOR_UNITS,
    supportedModels: PRIORITY_MODEL_VERSIONS,
  });
});

// GET /api/v1/priority/assessments/:hotspotId - Historical assessments for hotspot
priorityRouter.get('/priority/assessments/:hotspotId', async (req, res) => {
  try {
    const { hotspotId } = req.params;
    const assessments = await getHistoricalAssessments(hotspotId);
    res.json({ success: true, data: assessments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/priority/assessments/:id/detail - Single assessment details
priorityRouter.get('/priority/assessments/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await getSingleAssessment(id);
    res.json({ success: true, data: assessment });
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/v1/priority/assessments/compare - Compare two assessments side-by-side
priorityRouter.post('/priority/assessments/compare', async (req, res) => {
  try {
    const { assessmentIdA, assessmentIdB } = req.body;
    if (!assessmentIdA || !assessmentIdB) {
      return res.status(400).json({
        success: false,
        error: 'Both assessmentIdA and assessmentIdB are required',
      });
    }
    const comparison = await compareAssessments(assessmentIdA, assessmentIdB);
    res.json({ success: true, data: comparison });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/priority/calculate/:hotspotId - Trigger multi-factor priority calculation
priorityRouter.post('/priority/calculate/:hotspotId', async (req, res) => {
  try {
    const { hotspotId } = req.params;
    const validation = CalculatePriorityInputSchema.safeParse(req.body);

    const weights = validation.success ? validation.data.weights : req.body.weights;
    const modelVersion = validation.success ? validation.data.modelVersion : req.body.modelVersion;

    const result = await calculateHotspotPriority(hotspotId, weights, modelVersion);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/simulator/presets - Standard simulation presets
priorityRouter.get('/simulator/presets', (_req, res) => {
  const presets = getSimulationPresets();
  res.json({ success: true, data: presets });
});

// POST /api/v1/simulator/what-if - Run deterministic what-if scenario
priorityRouter.post('/simulator/what-if', async (req, res) => {
  try {
    const validation = WhatIfScenarioInputSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.format(),
      });
    }

    const data = await runWhatIfSimulation(validation.data);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/simulator/scenarios/:hotspotId - List saved scenarios for hotspot
priorityRouter.get('/simulator/scenarios/:hotspotId', async (req, res) => {
  try {
    const { hotspotId } = req.params;
    const scenarios = await getScenariosForHotspot(hotspotId);
    res.json({ success: true, data: scenarios });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/simulator/scenarios/:id/detail - Get single scenario details
priorityRouter.get('/simulator/scenarios/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const scenario = await getScenarioDetail(id);
    res.json({ success: true, data: scenario });
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

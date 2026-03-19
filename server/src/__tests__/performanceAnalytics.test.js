const { computePlacementReadiness, computeLocalAIInsights } = require('../controllers/performanceAnalytics.controller');

describe('Performance Analytics helpers', () => {
  test('computePlacementReadiness returns expected structure and sensible scores', () => {
    const analytics = [
      { subject: 'Math', topic: 'Algebra', totalAttempts: 10, correctAttempts: 7, accuracy: 70, avgTimeSeconds: 50, lastAttemptDate: new Date() },
      { subject: 'Math', topic: 'Geometry', totalAttempts: 5, correctAttempts: 3, accuracy: 60, avgTimeSeconds: 70, lastAttemptDate: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)) },
      { subject: 'English', topic: 'Grammar', totalAttempts: 8, correctAttempts: 6, accuracy: 75, avgTimeSeconds: 40, lastAttemptDate: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)) }
    ];

    const res = computePlacementReadiness(analytics);
    expect(res).toHaveProperty('score');
    expect(res).toHaveProperty('level');
    expect(res).toHaveProperty('breakdown');
    expect(res.breakdown).toHaveProperty('accuracy');
    expect(res.weakAreas.length).toBeGreaterThanOrEqual(0);
    expect(res.actionPlan.length).toBeGreaterThanOrEqual(0);
    expect(typeof res.score).toBe('number');
  });

  test('computeLocalAIInsights produces sensible fallback when little data', () => {
    const recentScores = [50, 55, 60];
    const riskAnalytics = [
      { topic: 'A', accuracy: 50, totalAttempts: 3 },
      { topic: 'B', accuracy: 80, totalAttempts: 4 }
    ];

    const out = computeLocalAIInsights(recentScores, riskAnalytics);
    expect(out).toHaveProperty('profile');
    expect(out).toHaveProperty('trend');
    expect(out).toHaveProperty('weak_areas');
    expect(Array.isArray(out.weak_areas)).toBe(true);
  });
});

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const PlacementReadinessCard = ({ data }) => {
    if (!data) return null;

    const { score, level, insights, breakdown } = data;

    // Data for the gauge chart (half pie)
    const gaugeData = [
        { name: 'Score', value: score },
        { name: 'Remaining', value: 100 - score }
    ];

    const COLORS = [
        score > 80 ? '#2f9e44' : score > 50 ? '#f08c00' : '#e03131',
        '#e9ecef'
    ];

    return (
        <div className="card" style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            <div style={{ flex: '1', minWidth: '300px' }}>
                <h3>🚀 Placement Readiness Score</h3>
                <p>AI-calculated probability of clearing technical rounds</p>

                <div style={{ position: 'relative', height: '200px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={gaugeData}
                                cx="50%"
                                cy="70%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={0}
                                dataKey="value"
                            >
                                {gaugeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div style={{
                        position: 'absolute',
                        top: '60%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: COLORS[0] }}>{score}%</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '500', color: '#666' }}>{level}</div>
                    </div>
                </div>
            </div>

            <div style={{ flex: '2', minWidth: '300px' }}>
                <h4>📈 Detailed Breakdown</h4>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
                    <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#666' }}>Accuracy</div>
                        <div style={{ fontSize: '1.5rem' }}>{breakdown.accuracy}%</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#666' }}>Consistency</div>
                        <div style={{ fontSize: '1.5rem' }}>{breakdown.consistency}%</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#666' }}>Topic Coverage</div>
                        <div style={{ fontSize: '1.5rem' }}>{breakdown.coverage}%</div>
                    </div>
                </div>

                <h4>🤖 AI Insights</h4>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                    {insights.map((insight, idx) => (
                        <li key={idx} style={{ marginBottom: '0.5rem', color: '#495057' }}>{insight}</li>
                    ))}
                    {insights.length === 0 && <li>Keep taking more tests to get personalized insights!</li>}
                </ul>
            </div>
        </div>
    );
};

export default PlacementReadinessCard;

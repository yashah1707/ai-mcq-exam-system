const User = require('../models/user.model');
const PerformanceAnalytics = require('../models/performanceAnalytics.model');
const ExamAttempt = require('../models/examAttempt.model');

// Get high-level batch overview
exports.getBatchOverview = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: { $ne: 'admin' } });

        // Active students (those with at least one analytics entry)
        const activeStudents = (await PerformanceAnalytics.distinct('userId')).length;

        // Total exams conducted
        const totalExams = await ExamAttempt.countDocuments({ status: 'completed' });

        // Batch Average Accuracy
        const result = await PerformanceAnalytics.aggregate([
            {
                $group: {
                    _id: null,
                    avgAccuracy: { $avg: "$accuracy" }
                }
            }
        ]);
        const batchAverage = result.length > 0 ? Math.round(result[0].avgAccuracy) : 0;

        res.json({
            success: true,
            data: {
                totalStudents,
                activeStudents,
                totalExams,
                batchAverage
            }
        });
    } catch (error) {
        console.error('Error fetching batch overview:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Subject-wise performance comparison
exports.getSubjectPerformance = async (req, res) => {
    try {
        const stats = await PerformanceAnalytics.aggregate([
            {
                $group: {
                    _id: "$subject",
                    avgScore: { $avg: "$accuracy" },
                    totalAttempts: { $sum: "$totalAttempts" }
                }
            },
            { $sort: { avgScore: 1 } } // Weakest first
        ]);

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching subject performance:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Weakness Heatmap (Topics with lowest accuracy across batch)
exports.getWeaknessHeatmap = async (req, res) => {
    try {
        const { subject } = req.query;
        const matchStage = subject ? { subject: subject } : {};

        const weakTopics = await PerformanceAnalytics.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$topic",
                    subject: { $first: "$subject" },
                    avgAccuracy: { $avg: "$accuracy" },
                    studentCount: { $sum: 1 } // How many students attempted this topic
                }
            },
            { $match: { studentCount: { $gt: 0 } } }, // Filter out unused
            { $sort: { avgAccuracy: 1 } },
            { $limit: 20 }
        ]);

        res.json({ success: true, data: weakTopics });
    } catch (error) {
        console.error('Error fetching weakness heatmap:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Placement Readiness Distribution
exports.getReadinessDistribution = async (req, res) => {
    try {
        // We need to calculate readiness for each student
        // This is expensive if we do it real-time for 1000 students
        // Ideally, readiness score is stored in User model or a separate collection
        // For now, we perform an aggregation

        const readinessData = await PerformanceAnalytics.aggregate([
            {
                $group: {
                    _id: "$userId",
                    overallAccuracy: { $avg: "$accuracy" },
                    totalAttempts: { $sum: "$totalAttempts" }
                }
            }
        ]);

        const buckets = {
            'Not Ready (<40%)': 0,
            'Needs Improvement (40-60%)': 0,
            'Good (60-80%)': 0,
            'Excellent (>80%)': 0
        };

        readinessData.forEach(student => {
            const score = student.overallAccuracy;
            // Simple heuristic for readiness (can be replaced with AI model logic)
            // Weight accuracy heavily, but maybe penalize low attempts? 
            // For now, raw accuracy mapping.

            if (score < 40) buckets['Not Ready (<40%)']++;
            else if (score < 60) buckets['Needs Improvement (40-60%)']++;
            else if (score < 80) buckets['Good (60-80%)']++;
            else buckets['Excellent (>80%)']++;
        });

        const chartData = Object.keys(buckets).map(key => ({
            name: key,
            value: buckets[key]
        }));

        res.json({ success: true, data: chartData });

    } catch (error) {
        console.error('Error fetching readiness distribution:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

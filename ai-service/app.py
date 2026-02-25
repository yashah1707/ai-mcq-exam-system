from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from logic.clustering import cluster_student
from logic.trend_analysis import analyze_trend

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "AI-MCQ-Exam-System"})

@app.route('/analyze-performance', methods=['POST'])
def analyze_performance():
    try:
        data = request.json
        # Expected Input:
        # {
        #   "recentScores": [80, 85, 90, ...], 
        #   "topicAccuracy": {"Arrays": 40, "Strings": 90},
        #   "avgTimePerQuestion": 45
        # }
        
        scores = data.get('recentScores', [])
        topic_accuracy = data.get('topicAccuracy', {})
        avg_time = data.get('avgTimePerQuestion', 0)

        # 1. Clustering / Profile Analysis
        overall_accuracy = np.mean(scores) if scores else 0
        profile = cluster_student(overall_accuracy, avg_time)
        
        # 2. Trend Analysis
        trend = analyze_trend(scores)

        # 3. Weak Area Identification
        weak_areas = [topic for topic, acc in topic_accuracy.items() if acc < 50]

        response = {
            "profile": profile,
            "trend": trend,
            "weak_areas": weak_areas,
            "recommendation": f"Focus on {weak_areas[0]}" if weak_areas else "Maintain current pace",
            "reasoning": {
                "profile_reason": profile['reason'],
                "trend_reason": trend['reason']
            }
        }
        
        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/readiness-indicators', methods=['POST'])
def readiness_indicators():
    try:
        data = request.json
        # Expected Input:
        # { "topicAccuracy": {"DBMS": 60, "DSA": 80, ...} }
        
        topic_accuracy = data.get('topicAccuracy', {})
        
        # Simple weighted readiness score (Mock weights)
        weights = {"DSA": 0.4, "DBMS": 0.3, "CN": 0.2, "OS": 0.1}
        
        total_score = 0
        total_weight = 0
        
        for topic, acc in topic_accuracy.items():
            w = weights.get(topic, 0.05) # Default low weight for others
            total_score += acc * w
            total_weight += w
            
        final_score = total_score / total_weight if total_weight > 0 else 0
        
        verdict = "Not Ready"
        if final_score > 80: verdict = "Product-Based Ready"
        elif final_score > 60: verdict = "Service-Based Ready"
        
        return jsonify({
            "readiness_score": round(final_score, 2),
            "verdict": verdict,
            "reason": f"Weighted score is {round(final_score, 2)} based on key placement topics."
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)

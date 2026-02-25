import numpy as np
from sklearn.linear_model import LinearRegression

def analyze_trend(scores):
    """
    Analyzes the trend of scores using simple linear regression.
    """
    if len(scores) < 2:
        return {"trend": "Insufficient Data", "slope": 0, "reason": "Need at least 2 tests to determine trend."}
    
    # X axis = Attempt number (0, 1, 2...)
    X = np.array(range(len(scores))).reshape(-1, 1)
    y = np.array(scores).reshape(-1, 1)
    
    model = LinearRegression()
    model.fit(X, y)
    
    slope = model.coef_[0][0]
    
    trend = "Stable"
    reason = "Performance is consistent."
    
    if slope > 2:
        trend = "Improving Rapidly"
        reason = f"Score increasing by approx {round(slope, 1)} points per test."
    elif slope > 0.5:
        trend = "Improving"
        reason = "Steady upward trend."
    elif slope < -2:
        trend = "Declining Rapidly"
        reason = "Significant drop in recent performance."
    elif slope < -0.5:
        trend = "Declining"
        reason = "Slight downward trend."
        
    return {
        "trend": trend,
        "slope": round(slope, 2),
        "reason": reason
    }

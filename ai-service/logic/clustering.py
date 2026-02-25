def cluster_student(accuracy, avg_time):
    """
    Classifies a student into a performance cluster based on accuracy and speed.
    """
    cluster_label = "Unclassified"
    reason = "Insufficient data"

    if accuracy >= 80:
        if avg_time < 30:
            cluster_label = "High Performer (Fast)"
            reason = "High accuracy with excellent speed."
        elif avg_time < 60:
            cluster_label = "High Performer (Steady)"
            reason = "High accuracy with standard speed."
        else:
            cluster_label = "Cautious Expert"
            reason = "High accuracy but takes longer than average."
    
    elif accuracy >= 50:
        if avg_time < 20:
            cluster_label = "Rusher"
            reason = "Average accuracy but answering too fast. Likely guessing."
        elif avg_time > 60:
            cluster_label = "Struggling with Speed"
            reason = "Concepts are okay but speed is a bottleneck."
        else:
            cluster_label = "Steady Improver"
            reason = "Balanced performance with room for improvement."
            
    else:
        if avg_time < 20:
            cluster_label = "Guessing / Disengaged"
            reason = "Low accuracy and very fast answers."
        else:
            cluster_label = "Conceptual Gaps"
            reason = "Low accuracy despite spending time."

    return {
        "cluster": cluster_label,
        "reason": reason
    }

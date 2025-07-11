from fastapi import Depends
from .database import SessionLocal
import base64
from sqlalchemy.orm import Session
import numpy as np
import cv2
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import io
from scipy.ndimage import gaussian_filter
from scipy import stats
from sklearn.metrics import roc_curve, auc
import math

# Database session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Function to generate a simple heatmap
def generate_heatmap(gaze_data, width, height):
    """
    Generate a heatmap from gaze data
    Returns colored heatmap and raw heatmap as base64 encoded strings
    """
    print(f"generate_heatmap called with {len(gaze_data)} points, width={width}, height={height}")
    
    # Validate inputs
    if not gaze_data:
        print("Warning: No gaze data provided for heatmap generation")
        empty_heatmap = np.zeros((height, width))
        return "", empty_heatmap
    
    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        print(f"Error: Invalid dimensions for heatmap: width={width}, height={height}")
        return "", np.zeros((100, 100))
    
    # Create an empty heatmap
    heatmap = np.zeros((height, width))
    
    # Sigma for Gaussian filter (adjust as needed for smoothness)
    sigma = 30
    
    # Maximum number of points to process to avoid timeouts
    max_points = 5000
    if len(gaze_data) > max_points:
        # Take a sample of points if there are too many
        import random
        print(f"Sampling {max_points} points from {len(gaze_data)} total points")
        gaze_data = random.sample(gaze_data, max_points)
    
    # Count valid points actually used
    valid_points = 0
    
    # Process gaze points - just mark their positions on the heatmap
    for point in gaze_data:
        try:
            x, y = int(point['x']), int(point['y'])
            # Skip points outside the screen
            if 0 <= x < width and 0 <= y < height:
                heatmap[y, x] += 1
                valid_points += 1
            else:
                print(f"Skipping out-of-bounds point: ({x}, {y})")
        except (ValueError, TypeError, KeyError) as e:
            # Skip invalid points
            print(f"Skipping invalid point: {point}, error: {str(e)}")
            continue
    
    print(f"Added {valid_points} valid points to heatmap")
    
    if valid_points == 0:
        print("Warning: No valid points for heatmap generation")
        return "", heatmap
    
    # Apply Gaussian filter for smoothing (much faster than manual calculation)
    try:
        heatmap = gaussian_filter(heatmap, sigma=sigma)
        print(f"Applied Gaussian filter with sigma={sigma}")
    except Exception as e:
        print(f"Error applying Gaussian filter: {str(e)}")
    
    # Normalize the heatmap
    heatmap_max = np.max(heatmap)
    if heatmap_max > 0:
        heatmap = heatmap / heatmap_max
        print(f"Normalized heatmap. Max value: {heatmap_max}, new max: {np.max(heatmap)}")
    else:
        print("Warning: Empty heatmap (max value is 0)")
    
    # Debug info about the heatmap
    print(f"Heatmap stats - min: {np.min(heatmap)}, max: {np.max(heatmap)}, mean: {np.mean(heatmap)}")
    print(f"Heatmap shape: {heatmap.shape}")
    print(f"Non-zero elements: {np.count_nonzero(heatmap)}")
    
    # Create a custom colormap (transparent blue to red)
    colors = [(0, 0, 0, 0), (0, 0, 1, 0.3), (0, 1, 1, 0.5), (0, 1, 0, 0.7), (1, 1, 0, 0.8), (1, 0, 0, 0.9)]
    cmap = LinearSegmentedColormap.from_list('heatmap_cmap', colors)
    
    try:
        # Create the plot with transparent background
        plt.figure(figsize=(width/100, height/100), dpi=100)
        plt.imshow(heatmap, cmap=cmap)
        plt.axis('off')
        
        # Save the colored heatmap to a BytesIO object
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, transparent=True)
        buf.seek(0)
        
        # Encode as base64
        heatmap_colored = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        # Close the plot to free memory
        plt.close()
        
        print(f"Successfully generated heatmap image, size: {len(heatmap_colored)} bytes")
        
        # Also return the raw heatmap data for statistics
        return heatmap_colored, heatmap
    except Exception as e:
        print(f"Error generating heatmap visualization: {str(e)}")
        import traceback
        traceback.print_exc()
        return "", heatmap

# Function to convert an image to base64
def img_to_base64(img):
    """Convert an image to base64 string"""
    # Convert numpy array to image bytes
    _, encoded_img = cv2.imencode('.png', img)
    return base64.b64encode(encoded_img).decode('utf-8')

# Calculate Kullback-Leibler Divergence
def calculate_kld(P, Q):
    """
    Calculate Kullback-Leibler Divergence between two distributions
    P: Ground truth fixation distribution
    Q: Predicted fixation distribution
    
    Returns: KLD value (lower is better)
    """
    # Avoid division by zero and log(0)
    P = np.maximum(P, 1e-10)
    Q = np.maximum(Q, 1e-10)
    
    # Normalize distributions
    P = P / np.sum(P)
    Q = Q / np.sum(Q)
    
    # Calculate KLD
    kld = np.sum(P * np.log(P / Q))
    return float(kld)

# Calculate Normalized Scanpath Saliency
def calculate_nss(saliency_map, fixation_points):
    """
    Calculate Normalized Scanpath Saliency
    saliency_map: Predicted saliency map
    fixation_points: List of (x,y) fixation points
    
    Returns: NSS value (higher is better)
    """
    # Normalize saliency map to have zero mean and unit std
    norm_map = (saliency_map - np.mean(saliency_map)) / (np.std(saliency_map) + 1e-10)
    
    # Extract values at fixation points
    nss_values = []
    height, width = norm_map.shape
    
    for point in fixation_points:
        x, y = int(point[0]), int(point[1])
        if 0 <= x < width and 0 <= y < height:
            nss_values.append(norm_map[y, x])
    
    # Average NSS over all fixation points
    if len(nss_values) > 0:
        return float(np.mean(nss_values))
    return 0.0

# Calculate Similarity metric
def calculate_similarity(P, Q):
    """
    Calculate Similarity between two distributions
    P, Q: Probability distributions to compare
    
    Returns: SIM value (higher is better, range [0,1])
    """
    # Normalize distributions
    P = P / (np.sum(P) + 1e-10)
    Q = Q / (np.sum(Q) + 1e-10)
    
    # Calculate similarity (histogram intersection)
    sim = np.sum(np.minimum(P, Q))
    return float(sim)

# Calculate Pearson's Correlation Coefficient
def calculate_cc(P, Q):
    """
    Calculate Pearson's Correlation Coefficient
    P, Q: Distributions to compare
    
    Returns: CC value (higher is better, range [-1,1])
    """
    # Flatten arrays
    P = P.flatten()
    Q = Q.flatten()
    
    # Calculate CC
    cc = np.corrcoef(P, Q)[0, 1]
    return float(cc)

# Calculate Area Under ROC Curve
def calculate_auc(saliency_map, fixation_points, num_samples=10000):
    """
    Calculate Area Under ROC Curve
    saliency_map: Predicted saliency map
    fixation_points: List of (x,y) fixation points
    
    Returns: AUC value (higher is better, range [0,1])
    """
    height, width = saliency_map.shape
    
    # Create fixation map with ones at fixation points
    fixation_map = np.zeros((height, width))
    for point in fixation_points:
        x, y = int(point[0]), int(point[1])
        if 0 <= x < width and 0 <= y < height:
            fixation_map[y, x] = 1
    
    # Flatten maps
    sal_flat = saliency_map.flatten()
    fix_flat = fixation_map.flatten()
    
    # If there are too many pixels, take a random sample for efficiency
    if len(sal_flat) > num_samples:
        indices = np.random.choice(len(sal_flat), num_samples, replace=False)
        sal_flat = sal_flat[indices]
        fix_flat = fix_flat[indices]
    
    # Calculate AUC
    fpr, tpr, _ = roc_curve(fix_flat, sal_flat)
    return float(auc(fpr, tpr))

# Calculate Focus Areas
def calculate_focus_areas(heatmap, threshold=0.5):
    """
    Calculate the number of distinct focus areas in the heatmap
    
    Returns: Integer count of focus areas
    """
    # Threshold the heatmap to find high-density regions
    binary = (heatmap > threshold * np.max(heatmap)).astype(np.uint8)
    
    # Find connected components (focus areas)
    num_labels, _ = cv2.connectedComponents(binary)
    
    # Subtract 1 to exclude background
    return max(0, num_labels - 1)

# Calculate Coverage
def calculate_coverage(heatmap, threshold=0.2):
    """
    Calculate the percentage of the screen covered by significant gaze activity
    
    Returns: Coverage value (0-1)
    """
    # Threshold the heatmap to find regions with any significant activity
    binary = (heatmap > threshold * np.max(heatmap)).astype(np.uint8)
    
    # Calculate the percentage of covered area
    return float(np.sum(binary) / binary.size)

# Calculate Attention Score
def calculate_attention_score(heatmap, point_count):
    """
    Calculate attention score based on the concentration of gaze points
    
    Returns: Attention score (0-100)
    """
    # Measures how focused or dispersed attention is based on the entropy of the heatmap
    # Lower entropy means more focused attention
    
    # Normalize heatmap
    p = heatmap / (np.sum(heatmap) + 1e-10)
    
    # Calculate entropy (avoid log(0))
    p_positive = p[p > 0]
    entropy = -np.sum(p_positive * np.log2(p_positive))
    
    # Map entropy to a score (0-100), lower entropy = higher score
    max_entropy = math.log2(heatmap.size)  # Maximum possible entropy
    attention_score = 100 * (1 - entropy / max_entropy)
    
    # Adjust based on point count - more points generally indicate better attention
    point_factor = min(1.0, point_count / 1000)  # Scale up to 1000 points
    
    # Blend entropy-based score with point count factor
    final_score = 0.7 * attention_score + 0.3 * 100 * point_factor
    
    return min(100, max(0, round(final_score)))

# Calculate intensity metrics (mean, median, std_dev, etc.)
def calculate_intensity_metrics(heatmap):
    """
    Calculate basic intensity metrics for the heatmap
    
    Returns: Dictionary of intensity metrics
    """
    # Ensure heatmap is normalized to [0,1] range
    if np.max(heatmap) > 0:
        normalized_heatmap = heatmap / np.max(heatmap)
    else:
        normalized_heatmap = heatmap
    
    # Calculate basic statistics
    mean_intensity = float(np.mean(normalized_heatmap))
    median_intensity = float(np.median(normalized_heatmap))
    std_dev = float(np.std(normalized_heatmap))
    max_intensity = float(np.max(normalized_heatmap))
    min_intensity = float(np.min(normalized_heatmap))
    
    # Calculate proportion of high and low activity zones
    high_threshold = 0.7  # 70% of maximum intensity
    low_threshold = 0.2   # 20% of maximum intensity
    
    high_activity = float(np.sum(normalized_heatmap > high_threshold) / normalized_heatmap.size)
    low_activity = float(np.sum(normalized_heatmap < low_threshold) / normalized_heatmap.size)
    
    # Calculate gradient magnitude (Sobel operator)
    gradient_x = cv2.Sobel(normalized_heatmap, cv2.CV_64F, 1, 0, ksize=3)
    gradient_y = cv2.Sobel(normalized_heatmap, cv2.CV_64F, 0, 1, ksize=3)
    gradient_magnitude = np.sqrt(gradient_x**2 + gradient_y**2)
    mean_gradient = float(np.mean(gradient_magnitude))
    
    return {
        "mean_intensity": round(mean_intensity, 3),
        "median_intensity": round(median_intensity, 3),
        "std_dev": round(std_dev, 3),
        "max_intensity": round(max_intensity, 3),
        "min_intensity": round(min_intensity, 3),
        "high_activity_proportion": round(high_activity * 100, 1),  # As percentage
        "low_activity_proportion": round(low_activity * 100, 1),    # As percentage
        "mean_gradient": round(mean_gradient, 3)
    }

# Function to calculate heatmap statistics
def calculate_heatmap_stats(heatmap, gaze_points=None):
    """
    Calculate comprehensive statistics for heatmap analysis
    
    Args:
        heatmap: The heatmap as a numpy array
        gaze_points: List of gaze points with x,y coordinates (optional)
        
    Returns:
        Dictionary of statistics
    """
    try:
        point_count = len(gaze_points) if gaze_points else 0
        
        # Handle empty heatmap
        if np.sum(heatmap) == 0:
            return {
                "pointCount": point_count,
                "focus_areas": 0,
                "attention_score": 0,
                "coverage": 0,
                "kld": 0,
                "nss": 0,
                "similarity": 0,
                "cc": 0,
                "auc": 0,
                # Add basic intensity metrics with zeros
                "mean_intensity": 0,
                "median_intensity": 0,
                "std_dev": 0,
                "max_intensity": 0,
                "min_intensity": 0,
                "high_activity_proportion": 0,
                "low_activity_proportion": 0,
                "mean_gradient": 0
            }
        
        # Basic statistics
        focus_areas = calculate_focus_areas(heatmap)
        coverage = calculate_coverage(heatmap)
        attention_score = calculate_attention_score(heatmap, point_count)
        
        # Calculate intensity metrics
        intensity_metrics = calculate_intensity_metrics(heatmap)
        
        # Advanced statistics (only if we have gaze points)
        if gaze_points and len(gaze_points) > 5:
            # Create a uniform distribution as the baseline for comparison
            uniform_map = np.ones_like(heatmap) / heatmap.size
            
            # Extract (x,y) coordinates from gaze points
            coords = [(p['x'], p['y']) for p in gaze_points 
                      if 'x' in p and 'y' in p and 
                      0 <= p['x'] < heatmap.shape[1] and 
                      0 <= p['y'] < heatmap.shape[0]]
            
            # Calculate advanced metrics if we have enough points
            if len(coords) > 5:
                kld = calculate_kld(heatmap, uniform_map)
                nss = calculate_nss(heatmap, coords)
                sim = calculate_similarity(heatmap, uniform_map)
                cc = calculate_cc(heatmap, uniform_map)
                auc_score = calculate_auc(heatmap, coords, num_samples=5000)
                
                # Ensure values are within expected ranges
                kld = max(0, kld)  # KLD should be non-negative
                nss = max(-3, min(3, nss))  # NSS typically in range [-3, 3]
                sim = max(0, min(1, sim))  # Similarity should be [0, 1]
                cc = max(-1, min(1, cc))  # CC should be [-1, 1]
                auc_score = max(0, min(1, auc_score))  # AUC should be [0, 1]
            else:
                kld = nss = sim = cc = auc_score = 0
        else:
            kld = nss = sim = cc = auc_score = 0
        
        # Combine all metrics
        return {
            "pointCount": point_count,
            "focus_areas": focus_areas,
            "attention_score": attention_score,
            "coverage": coverage,
            "kld": round(kld, 2),
            "nss": round(nss, 2),
            "similarity": round(sim, 2),
            "cc": round(cc, 2),
            "auc": round(auc_score, 2),
            **intensity_metrics  # Include all intensity metrics
        }
    except Exception as e:
        print(f"Error calculating heatmap stats: {str(e)}")
        return {
            "pointCount": point_count if 'point_count' in locals() else 0,
            "focus_areas": 0,
            "attention_score": 0,
            "coverage": 0,
            "error": str(e)
        }

def normalize_heatmap(hm):
    """Normalize heatmap to sum to 1"""
    total = np.sum(hm)
    return hm / total if total != 0 else hm

def calculate_correlation_metrics(gaze_heatmap, cursor_heatmap):
    """
    Calculate correlation metrics between gaze and cursor heatmaps
    
    Args:
        gaze_heatmap: 2D numpy array of gaze heatmap
        cursor_heatmap: 2D numpy array of cursor heatmap
        
    Returns:
        Dictionary of correlation metrics
    """
    print(f"calculate_correlation_metrics called with heatmaps of shapes: gaze={gaze_heatmap.shape if gaze_heatmap is not None else 'None'}, cursor={cursor_heatmap.shape if cursor_heatmap is not None else 'None'}")
    
    # Validate inputs at start
    if gaze_heatmap is None or cursor_heatmap is None:
        print("Error: One or both heatmaps are None")
        return {
            "correlation_coefficient": 0,
            "histogram_intersection": 0,
            "kl_divergence": 0,
            "iou": 0,
            "common_hotspots": 0,
            "hotspot_locations": [],
            "error": "Missing heatmap data"
        }
    
    if not isinstance(gaze_heatmap, np.ndarray) or not isinstance(cursor_heatmap, np.ndarray):
        print(f"Error: Heatmaps are not numpy arrays: gaze={type(gaze_heatmap)}, cursor={type(cursor_heatmap)}")
        return {
            "correlation_coefficient": 0,
            "histogram_intersection": 0,
            "kl_divergence": 0,
            "iou": 0,
            "common_hotspots": 0,
            "hotspot_locations": [],
            "error": "Invalid heatmap data types"
        }
    
    if gaze_heatmap.size == 0 or cursor_heatmap.size == 0:
        print(f"Error: One or both heatmaps are empty: gaze size={gaze_heatmap.size}, cursor size={cursor_heatmap.size}")
        return {
            "correlation_coefficient": 0,
            "histogram_intersection": 0,
            "kl_divergence": 0,
            "iou": 0,
            "common_hotspots": 0,
            "hotspot_locations": [],
            "error": "Empty heatmap data"
        }
    
    try:
        # Normalize both heatmaps
        gaze_norm = normalize_heatmap(gaze_heatmap)
        cursor_norm = normalize_heatmap(cursor_heatmap)
        
        print(f"Normalized heatmaps - gaze: min={gaze_norm.min()}, max={gaze_norm.max()}, mean={gaze_norm.mean()}")
        print(f"Normalized heatmaps - cursor: min={cursor_norm.min()}, max={cursor_norm.max()}, mean={cursor_norm.mean()}")
        
        # Calculate Pearson's Correlation Coefficient
        cc = np.corrcoef(gaze_norm.flatten(), cursor_norm.flatten())[0, 1]
        print(f"Calculated correlation coefficient: {cc}")
        
        # Calculate Histogram Intersection
        hi = np.sum(np.minimum(gaze_norm, cursor_norm))
        print(f"Calculated histogram intersection: {hi}")
        
        # Calculate KL Divergence (with small epsilon to avoid log(0))
        epsilon = 1e-10
        kl = np.sum(gaze_norm * np.log((gaze_norm + epsilon) / (cursor_norm + epsilon)))
        print(f"Calculated KL divergence: {kl}")
        
        # Calculate IoU for hotspots (using 90th percentile threshold)
        threshold = 0.9
        try:
            t1 = np.percentile(gaze_norm, threshold * 100)
            t2 = np.percentile(cursor_norm, threshold * 100)
            print(f"Percentile thresholds - gaze: {t1}, cursor: {t2}")
            
            mask1 = gaze_norm >= t1
            mask2 = cursor_norm >= t2
            
            intersection = np.logical_and(mask1, mask2).sum()
            union = np.logical_or(mask1, mask2).sum()
            iou = intersection / union if union != 0 else 0
            print(f"IoU calculation - intersection: {intersection}, union: {union}, iou: {iou}")
            
            # Find common hotspots
            common_hotspots = np.argwhere(np.logical_and(mask1, mask2))
            hotspot_count = len(common_hotspots)
            print(f"Found {hotspot_count} common hotspots")
        except Exception as iou_error:
            print(f"Error calculating IoU: {str(iou_error)}")
            iou = 0
            hotspot_count = 0
            common_hotspots = np.array([])
        
        result = {
            "correlation_coefficient": float(cc),
            "histogram_intersection": float(hi),
            "kl_divergence": float(kl),
            "iou": float(iou),
            "common_hotspots": hotspot_count,
            "hotspot_locations": common_hotspots.tolist() if hotspot_count > 0 else []
        }
        
        print(f"Returning correlation metrics: {result}")
        return result
    except Exception as e:
        print(f"Error calculating correlation metrics: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "correlation_coefficient": 0,
            "histogram_intersection": 0,
            "kl_divergence": 0,
            "iou": 0,
            "common_hotspots": 0,
            "hotspot_locations": [],
            "error": str(e)
        } 
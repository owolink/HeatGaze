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
    # Create an empty heatmap
    heatmap = np.zeros((height, width))
    
    # Sigma for Gaussian filter (adjust as needed for smoothness)
    sigma = 30
    
    # Maximum number of points to process to avoid timeouts
    max_points = 5000
    if len(gaze_data) > max_points:
        # Take a sample of points if there are too many
        import random
        gaze_data = random.sample(gaze_data, max_points)
    
    # Process gaze points - just mark their positions on the heatmap
    for point in gaze_data:
        try:
            x, y = int(point['x']), int(point['y'])
            # Skip points outside the screen
            if 0 <= x < width and 0 <= y < height:
                heatmap[y, x] += 1
        except (ValueError, TypeError, KeyError):
            # Skip invalid points
            continue
    
    # Apply Gaussian filter for smoothing (much faster than manual calculation)
    heatmap = gaussian_filter(heatmap, sigma=sigma)
    
    # Normalize the heatmap
    if np.max(heatmap) > 0:
        heatmap = heatmap / np.max(heatmap)
    
    # Create a custom colormap (transparent blue to red)
    colors = [(0, 0, 0, 0), (0, 0, 1, 0.3), (0, 1, 1, 0.5), (0, 1, 0, 0.7), (1, 1, 0, 0.8), (1, 0, 0, 0.9)]
    cmap = LinearSegmentedColormap.from_list('heatmap_cmap', colors)
    
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
    
    # Also return the raw heatmap data as a compressed version (for statistics)
    raw_buf = io.BytesIO()
    np.save(raw_buf, heatmap)
    raw_buf.seek(0)
    heatmap_raw = base64.b64encode(raw_buf.getvalue()).decode('utf-8')
    
    return heatmap_colored, heatmap_raw

# Function to convert an image to base64
def img_to_base64(img):
    """Convert an image to base64 string"""
    # Dummy implementation that doesn't require PIL
    # In a real implementation, this would convert an image to base64
    return "base64_encoded_image_data"

# Function to calculate heatmap statistics
def calculate_heatmap_stats(image):
    """Calculate basic statistics for an image to be used with heatmaps"""
    try:
        # Convert to grayscale if it's a color image
        if len(image.shape) > 2:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
            
        # Calculate basic statistics
        stats = {
            'mean': float(np.mean(gray)),
            'median': float(np.median(gray)),
            'std_dev': float(np.std(gray)),
            'variance': float(np.var(gray)),
            'max': float(np.max(gray)),
            'min': float(np.min(gray)),
            'high_intensity_ratio': float(np.sum(gray > 200) / gray.size)
        }
        
        return stats
    except Exception as e:
        print(f"Error calculating heatmap stats: {str(e)}")
        return {} 
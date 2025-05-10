"""
Test script for the mouse_heatmap module
Run this script directly to test the heatmap generation functionality
"""
import os
import sys
import json
import base64
from datetime import datetime, timedelta

# Add the parent directory to sys.path to allow importing utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    # Try to import the module
    from utils.mouse_heatmap import create_mouse_heatmap, create_time_based_heatmap, create_trajectory_plot
    print("Successfully imported mouse_heatmap module")
except ImportError as e:
    print(f"Failed to import mouse_heatmap module: {e}")
    sys.exit(1)

def generate_test_data(num_points=100):
    """Generate test cursor data points in a circular pattern"""
    import math
    import random
    
    data = []
    center_x, center_y = 1000, 500
    radius = 300
    now = datetime.now()
    
    for i in range(num_points):
        # Create points in a circular pattern with some randomness
        angle = (i / num_points) * 2 * math.pi
        jitter = random.uniform(-50, 50)
        x = center_x + (radius * math.cos(angle)) + jitter
        y = center_y + (radius * math.sin(angle)) + jitter
        
        # Add timestamp (ms) with increasing values
        timestamp = int((now + timedelta(milliseconds=i*100)).timestamp() * 1000)
        
        data.append({
            "x": x,
            "y": y,
            "timestamp": timestamp
        })
    
    return data

def save_image(img_base64, filename):
    """Save a base64 encoded image to a file"""
    with open(filename, 'wb') as f:
        f.write(base64.b64decode(img_base64))
    print(f"Saved image to {filename}")

def run_tests():
    """Run tests for all heatmap types"""
    print("Generating test data...")
    test_data = generate_test_data(200)
    
    # Save test data to a file for reference
    with open('test_cursor_data.json', 'w') as f:
        json.dump(test_data, f, indent=2)
    print("Saved test data to test_cursor_data.json")
    
    print("\nTesting density heatmap...")
    try:
        img, stats = create_mouse_heatmap(test_data, width=1920, height=1080, bin_size=50)
        if img:
            save_image(img, 'test_density_heatmap.png')
            print("Density heatmap stats:", json.dumps(stats, indent=2))
        else:
            print("Failed to generate density heatmap")
    except Exception as e:
        print(f"Error generating density heatmap: {e}")
    
    print("\nTesting time-based heatmap...")
    try:
        img, stats = create_time_based_heatmap(test_data, width=1920, height=1080)
        if img:
            save_image(img, 'test_time_heatmap.png')
            print("Time-based heatmap stats:", json.dumps(stats, indent=2))
        else:
            print("Failed to generate time-based heatmap")
    except Exception as e:
        print(f"Error generating time-based heatmap: {e}")
    
    print("\nTesting trajectory plot...")
    try:
        img, stats = create_trajectory_plot(test_data, width=1920, height=1080)
        if img:
            save_image(img, 'test_trajectory.png')
            print("Trajectory stats:", json.dumps(stats, indent=2))
        else:
            print("Failed to generate trajectory plot")
    except Exception as e:
        print(f"Error generating trajectory plot: {e}")
    
    print("\nAll tests completed!")

if __name__ == "__main__":
    run_tests() 
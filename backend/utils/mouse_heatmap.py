"""
Module for creating mouse movement heatmaps
"""

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.graph_objects import Figure
import base64
import io
from datetime import datetime
from typing import List, Dict, Tuple, Any, Optional


def create_mouse_heatmap(
    data: List[Dict[str, Any]], 
    width: int = 1920, 
    height: int = 1080, 
    bin_size: int = 50,
    colorscale: str = 'Inferno'
) -> Tuple[str, Dict[str, Any]]:
    """
    Create a density heatmap of mouse cursor positions
    
    Args:
        data: List of cursor data points with x, y, and timestamp
        width: Width of the screen in pixels
        height: Height of the screen in pixels
        bin_size: Size of bins for heatmap
        colorscale: Plotly colorscale name
        
    Returns:
        Tuple containing (base64_encoded_image, stats_dict)
    """
    if not data or len(data) < 5:
        return None, {"error": "Not enough data points for heatmap"}
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Make sure required columns exist
        if 'x' not in df.columns or 'y' not in df.columns:
            return None, {"error": "Missing required columns x or y"}
        
        # Create 2D histogram
        fig = px.density_heatmap(
            df, 
            x='x', 
            y='y',
            nbinsx=width//bin_size,
            nbinsy=height//bin_size,
            color_continuous_scale=colorscale,
            range_x=[0, width],
            range_y=[0, height],
            title="Mouse Movement Density Heatmap"
        )
        
        # Invert y-axis to match screen coordinates
        fig.update_yaxes(autorange="reversed")
        
        # Add size reference
        fig.update_layout(
            width=900,
            height=600,
            xaxis_title="X Position",
            yaxis_title="Y Position",
            coloraxis_colorbar=dict(
                title="Density"
            )
        )
        
        # Convert to image
        img_bytes = fig.to_image(format="png", scale=2)
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        # Calculate stats
        counts = []
        for x in range(0, width, bin_size):
            for y in range(0, height, bin_size):
                count = len(df[(df['x'] >= x) & (df['x'] < x+bin_size) & 
                             (df['y'] >= y) & (df['y'] < y+bin_size)])
                if count > 0:
                    counts.append((x, y, count))
        
        df_counts = pd.DataFrame(counts, columns=['x', 'y', 'count'])
        
        if len(df_counts) > 0:
            max_count_row = df_counts.loc[df_counts['count'].idxmax()]
            max_location = {'x': max_count_row['x'] + bin_size/2, 'y': max_count_row['y'] + bin_size/2}
            max_value = max_count_row['count']
            
            # Calculate coverage
            total_bins = (width // bin_size) * (height // bin_size)
            active_bins = len(df_counts)
            percentage = (active_bins / total_bins) * 100
            
            stats = {
                "count": len(df),
                "hotspots": {
                    "max_location": max_location,
                    "max_value": float(max_value)
                },
                "coverage": {
                    "total_bins": total_bins,
                    "active_bins": active_bins,
                    "percentage": float(percentage)
                }
            }
        else:
            stats = {
                "count": len(df),
                "hotspots": {
                    "max_location": {"x": 0, "y": 0},
                    "max_value": 0
                },
                "coverage": {
                    "total_bins": (width // bin_size) * (height // bin_size),
                    "active_bins": 0,
                    "percentage": 0.0
                }
            }
        
        return img_base64, stats
        
    except Exception as e:
        import traceback
        return None, {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def create_time_based_heatmap(
    data: List[Dict[str, Any]],
    width: int = 1920,
    height: int = 1080,
    bin_size: int = 50,
    colorscale: str = 'Viridis'
) -> Tuple[str, Dict[str, Any]]:
    """
    Create a heatmap showing dwell time at different cursor positions
    
    Args:
        data: List of cursor data points with x, y, and timestamp
        width: Width of the screen in pixels
        height: Height of the screen in pixels
        bin_size: Size of bins for heatmap
        colorscale: Plotly colorscale name
        
    Returns:
        Tuple containing (base64_encoded_image, stats_dict)
    """
    if not data or len(data) < 5:
        return None, {"error": "Not enough data points for heatmap"}
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Make sure required columns exist
        if 'x' not in df.columns or 'y' not in df.columns or 'timestamp' not in df.columns:
            return None, {"error": "Missing required columns x, y, or timestamp"}
        
        # Ensure timestamp is in datetime format
        if isinstance(df['timestamp'][0], str):
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Sort by timestamp
        df = df.sort_values('timestamp')
        
        # Calculate time spent in each bin
        df['bin_x'] = (df['x'] // bin_size) * bin_size
        df['bin_y'] = (df['y'] // bin_size) * bin_size
        df['next_timestamp'] = df['timestamp'].shift(-1)
        
        # Handle the last row
        df.loc[df.index[-1], 'next_timestamp'] = df.loc[df.index[-1], 'timestamp']
        
        # Calculate dwell time in seconds
        df['dwell_time'] = (df['next_timestamp'] - df['timestamp']).dt.total_seconds()
        
        # Filter out too large values (e.g., when there's a big gap)
        df = df[df['dwell_time'] < 10]  # Max 10 seconds dwell
        
        # Group by bins and sum dwell time
        bin_times = df.groupby(['bin_x', 'bin_y'])['dwell_time'].sum().reset_index()
        
        # Create figure
        fig = go.Figure()
        
        # Add heatmap
        fig.add_trace(go.Heatmap(
            x=bin_times['bin_x'],
            y=bin_times['bin_y'],
            z=bin_times['dwell_time'],
            colorscale=colorscale,
            colorbar=dict(title="Dwell Time (s)"),
        ))
        
        # Set layout
        fig.update_layout(
            title="Cursor Dwell Time Heatmap",
            width=900,
            height=600,
            xaxis=dict(title="X Position", range=[0, width]),
            yaxis=dict(title="Y Position", range=[height, 0]),
        )
        
        # Convert to image
        img_bytes = fig.to_image(format="png", scale=2)
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        # Calculate stats
        total_time = df['dwell_time'].sum()
        avg_time = df['dwell_time'].mean()
        max_time = bin_times['dwell_time'].max()
        max_bin = bin_times.loc[bin_times['dwell_time'].idxmax()]
        
        stats = {
            "count": len(df),
            "timing": {
                "total_tracking_time": float(total_time),
                "average_dwell_time": float(avg_time),
                "max_dwell_time": float(max_time),
                "max_dwell_location": {
                    "x": float(max_bin['bin_x'] + bin_size/2),
                    "y": float(max_bin['bin_y'] + bin_size/2)
                }
            }
        }
        
        return img_base64, stats
        
    except Exception as e:
        import traceback
        return None, {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def create_trajectory_plot(
    data: List[Dict[str, Any]],
    width: int = 1920,
    height: int = 1080,
    max_points: int = 1000,
    line_color: str = 'rgb(0, 100, 255)',
    point_color: str = 'rgba(30, 150, 255, 0.5)'
) -> Tuple[str, Dict[str, Any]]:
    """
    Create a trajectory plot showing the path of cursor movement
    
    Args:
        data: List of cursor data points with x, y, and timestamp
        width: Width of the screen in pixels
        height: Height of the screen in pixels
        max_points: Maximum number of points to plot
        line_color: Color of the trajectory line
        point_color: Color of the cursor points
        
    Returns:
        Tuple containing (base64_encoded_image, stats_dict)
    """
    if not data or len(data) < 5:
        return None, {"error": "Not enough data points for trajectory plot"}
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Make sure required columns exist
        if 'x' not in df.columns or 'y' not in df.columns or 'timestamp' not in df.columns:
            return None, {"error": "Missing required columns x, y, or timestamp"}
        
        # Ensure timestamp is in datetime format
        if isinstance(df['timestamp'][0], str):
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Sort by timestamp
        df = df.sort_values('timestamp')
        
        # Sample points if too many
        if len(df) > max_points:
            step = len(df) // max_points
            df = df.iloc[::step].copy()
        
        # Create figure
        fig = go.Figure()
        
        # Add trajectory line
        fig.add_trace(go.Scatter(
            x=df['x'],
            y=df['y'],
            mode='lines',
            line=dict(color=line_color, width=2),
            name='Cursor Path'
        ))
        
        # Add points
        fig.add_trace(go.Scatter(
            x=df['x'],
            y=df['y'],
            mode='markers',
            marker=dict(color=point_color, size=8),
            name='Cursor Points'
        ))
        
        # Add arrows to show direction
        arrow_step = max(len(df) // 20, 1)  # Show ~20 arrows
        for i in range(0, len(df) - arrow_step, arrow_step):
            x1, y1 = df.iloc[i]['x'], df.iloc[i]['y']
            x2, y2 = df.iloc[i + arrow_step]['x'], df.iloc[i + arrow_step]['y']
            
            # Skip if points are too close
            if abs(x2 - x1) < 5 and abs(y2 - y1) < 5:
                continue
                
            # Calculate arrow properties
            dx, dy = x2 - x1, y2 - y1
            length = np.sqrt(dx**2 + dy**2)
            
            # Skip if too short
            if length < 20:
                continue
                
            # Normalize and scale
            dx, dy = dx / length * 10, dy / length * 10
            
            # Add arrow annotation
            fig.add_annotation(
                x=x1 + dx * 3,  # Place arrow along the path
                y=y1 + dy * 3,
                ax=x1,
                ay=y1,
                xref="x",
                yref="y",
                axref="x",
                ayref="y",
                showarrow=True,
                arrowhead=2,
                arrowsize=1,
                arrowwidth=2,
                arrowcolor='rgba(255, 0, 0, 0.6)'
            )
        
        # Set layout
        fig.update_layout(
            title="Cursor Movement Trajectory",
            width=900,
            height=600,
            xaxis=dict(title="X Position", range=[0, width]),
            yaxis=dict(title="Y Position", range=[height, 0]),
            showlegend=True
        )
        
        # Convert to image
        img_bytes = fig.to_image(format="png", scale=2)
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        # Calculate stats
        df['next_x'] = df['x'].shift(-1)
        df['next_y'] = df['y'].shift(-1)
        df = df.dropna()
        
        # Calculate distances between consecutive points
        df['distance'] = np.sqrt((df['next_x'] - df['x'])**2 + (df['next_y'] - df['y'])**2)
        
        # Calculate time differences
        df['next_timestamp'] = df['timestamp'].shift(-1)
        df['time_diff'] = (df['next_timestamp'] - df['timestamp']).dt.total_seconds()
        
        # Calculate speed (pixels per second)
        df['speed'] = df['distance'] / df['time_diff']
        
        # Filter out invalid speeds (too large or infinite)
        df = df[(df['speed'] < 5000) & (df['speed'] > 0)]
        
        total_distance = df['distance'].sum()
        avg_speed = df['speed'].mean()
        
        stats = {
            "count": len(data),
            "trajectory": {
                "total_distance": float(total_distance),
                "avg_speed": float(avg_speed),
                "points_plotted": len(df)
            }
        }
        
        return img_base64, stats
        
    except Exception as e:
        import traceback
        return None, {
            "error": str(e),
            "traceback": traceback.format_exc()
        } 
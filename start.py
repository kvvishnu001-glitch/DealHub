#!/usr/bin/env python3
"""
DealSphere Production Startup Script
Use this script to start the application in production
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    # Set environment variables
    os.environ["PYTHONPATH"] = str(Path(__file__).parent)
    
    # Change to python_backend directory
    backend_dir = Path(__file__).parent / "python_backend"
    os.chdir(backend_dir)
    
    # Get port from environment or use default
    port = int(os.getenv("PORT", 8000))
    
    # Determine if we're in production
    is_production = os.getenv("ENVIRONMENT") == "production"
    
    print(f"🚀 Starting DealSphere on port {port}")
    print(f"📁 Working directory: {backend_dir}")
    print(f"🌍 Environment: {'production' if is_production else 'development'}")
    
    try:
        # Start the server
        cmd = [
            sys.executable, "-m", "uvicorn", 
            "app:app", 
            "--host", "0.0.0.0", 
            "--port", str(port)
        ]
        
        # Add reload for development
        if not is_production:
            cmd.append("--reload")
            
        print(f"💻 Running: {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
        
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
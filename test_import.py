#!/usr/bin/env python
import sys
import os

# Add the project root to sys.path
sys.path.insert(0, os.path.dirname(__file__))

print("=" * 60)
print("STARTING TEST")
print("=" * 60)

try:
    print("\n[TEST] Attempting to import app...")
    import app
    print("[TEST] App imported successfully!")
    
    print("\n[Result] App routes:")
    for rule in app.app.url_map.iter_rules():
        print(f"  {rule}")
        
except Exception as e:
    print(f"[ERROR] Failed to import app: {e}")
    import traceback
    traceback.print_exc()

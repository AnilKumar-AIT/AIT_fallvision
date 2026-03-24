#!/usr/bin/env python3
"""Test if the adls route can be imported"""
import sys
sys.path.insert(0, 'backend')

try:
    from app.routes import adls
    print("SUCCESS: adls module imported successfully")
    print(f"Router prefix: {adls.router.prefix}")
    print(f"Router tags: {adls.router.tags}")
    print(f"Number of routes: {len(adls.router.routes)}")
    for route in adls.router.routes:
        print(f"  - {route.methods} {route.path}")
except Exception as e:
    print(f"ERROR importing adls: {e}")
    import traceback
    traceback.print_exc()

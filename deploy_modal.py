#!/usr/bin/env python3
"""
Deploy Modal GPU functions for vocal separator app.
Run this script to deploy the GPU processing functions to Modal.
"""

import modal
from modal_functions import app

def deploy():
    """Deploy the Modal app with GPU functions"""
    print("🚀 Deploying Modal GPU functions...")
    
    try:
        # Deploy the app
        with modal.enter():
            result = modal.deploy(app)
            print(f"✅ Modal app deployed successfully!")
            print(f"📍 App URL: {result}")
            print("\n🔧 Set these environment variables in HuggingFace Spaces:")
            print("MODAL_TOKEN_ID=<your_modal_token_id>")
            print("MODAL_TOKEN_SECRET=<your_modal_token_secret>")
            return True
            
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        print("\n🔍 Make sure you have:")
        print("1. Modal account set up: modal.com")
        print("2. Modal token configured: modal token new")
        print("3. Modal CLI installed: pip install modal")
        return False

if __name__ == "__main__":
    success = deploy()
    if success:
        print("\n✨ Next steps:")
        print("1. Set Modal environment variables in HuggingFace Spaces")
        print("2. Set up Supabase database (see supabase_setup.sql)")
        print("3. Restart HuggingFace Spaces to apply changes")
    else:
        print("\n📖 See Modal docs: https://modal.com/docs")
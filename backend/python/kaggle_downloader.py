#!/usr/bin/env python3
"""
Kaggle Competition Data Downloader
Downloads competition data using Kaggle CLI
"""

import sys
import os
import subprocess
import json

def setup_kaggle_credentials(api_token):
    """Set up Kaggle API credentials via environment variable"""
    if api_token and api_token.startswith('KGAT_'):
        # KGAT_ tokens use the KAGGLE_API_TOKEN env var
        os.environ['KAGGLE_API_TOKEN'] = api_token
        print(f"✓ Kaggle API token set via environment variable")
    elif api_token and not api_token.startswith('KGAT_'):
        # Legacy username:key format — write to kaggle.json
        kaggle_dir = os.path.expanduser('~/.kaggle')
        os.makedirs(kaggle_dir, exist_ok=True)
        credentials_path = os.path.join(kaggle_dir, 'kaggle.json')
        try:
            creds = json.loads(api_token)
            with open(credentials_path, 'w') as f:
                json.dump(creds, f)
            os.chmod(credentials_path, 0o600)
            print(f"✓ Kaggle credentials configured via kaggle.json")
        except json.JSONDecodeError:
            print("⚠ Could not parse credentials, using system defaults")
    else:
        print("⚠ No Kaggle credentials provided, using system defaults")

def download_competition_data(competition_name, data_dir):
    """Download competition data using Kaggle CLI"""
    print(f"📥 Downloading data for competition: {competition_name}")
    print(f"📁 Target directory: {data_dir}")

    try:
        # Download competition files
        cmd = ['kaggle', 'competitions', 'download', '-c', competition_name, '-p', data_dir]
        print(f"Running: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )

        print(result.stdout)

        # Unzip files
        print("📦 Extracting downloaded files...")
        for filename in os.listdir(data_dir):
            if filename.endswith('.zip'):
                zip_path = os.path.join(data_dir, filename)
                print(f"Extracting {filename}...")
                subprocess.run(
                    ['unzip', '-o', zip_path, '-d', data_dir],
                    capture_output=True,
                    check=True
                )
                os.remove(zip_path)
                print(f"✓ Extracted and removed {filename}")

        # List downloaded files
        files = os.listdir(data_dir)
        print(f"\n✓ Downloaded {len(files)} file(s):")
        for f in files:
            file_path = os.path.join(data_dir, f)
            size = os.path.getsize(file_path)
            print(f"  - {f} ({size:,} bytes)")

        return True

    except subprocess.CalledProcessError as e:
        print(f"❌ Error downloading data: {e}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    if len(sys.argv) < 3:
        print("Usage: python kaggle_downloader.py <competition_name> <api_token> <data_dir>")
        sys.exit(1)

    competition_name = sys.argv[1]
    api_token = sys.argv[2] if len(sys.argv) > 2 else ""
    data_dir = sys.argv[3] if len(sys.argv) > 3 else "./data"

    print("=" * 60)
    print("KAGGLE DATA DOWNLOADER")
    print("=" * 60)

    # Set up credentials
    if api_token:
        setup_kaggle_credentials(api_token)

    # Download data
    success = download_competition_data(competition_name, data_dir)

    if success:
        print("\n✓ Download completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Download failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()

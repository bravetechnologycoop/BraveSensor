#
# clang-format-all.py - Formats all
#
# This script formats all .cpp and .h files within the specified directories
# using clang-format. It is intended to be run locally or as part of a CI/CD
# pipeline to ensure consistent code formatting.
# 
# Use clang-format version 12 
#
# To run this script, use the command "python clang-format-all.py".
# Make sure you are in firmware/boron-ins-fsm as directory paths are relative
# Ensure that clang-format is installed and available in your PATH.
#

import os
import subprocess

def check_clang_format_version(required_version="12"):
    result = subprocess.run(['clang-format', '--version'], capture_output=True, text=True)
    version_output = result.stdout.strip()
    if required_version not in version_output:
        print(f"Error: clang-format version {required_version} is required.")
        print(f"Current version: {version_output}")
        return False
    return True

def format_code(directories):
    if not check_clang_format_version():
        return
    for directory in directories:
        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith(('.cpp', '.h')):
                    file_path = os.path.join(root, file)
                    subprocess.run(['clang-format', '-i', file_path], check=True)
    print("Code formatted successfully.")

if __name__ == "__main__":
    directories_to_format = ['src', 'test']
    format_code(directories_to_format)
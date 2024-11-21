#
# clang-format-check.py
#
# Checks whether all files with filetype .cpp or .h are formatted correctly.
# This script is intended to be run locally or as part of a CI/CD pipeline.
#
# Use clang-format version 12
#
# To run this script, use the command "python clang-format-check.py".
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

def check_formatting(directories):
    if not check_clang_format_version():
        return False
    for directory in directories:
        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith(('.cpp', '.h')):
                    file_path = os.path.join(root, file)
                    result = subprocess.run(['clang-format', '--dry-run', '--Werror', file_path], capture_output=True)
                    if result.returncode != 0:
                        print(f"Formatting error in file: {file_path}")
                        return False
    return True

if __name__ == "__main__":
    directories_to_check = ['src', 'test']
    if not check_formatting(directories_to_check):
        print("Formatting error(s) found, please run 'python3 clang-format-all.py' to fix them.")
        os._exit(1)
    else:
        print("No formatting errors found.")
        os._exit(0)
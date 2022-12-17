#
# clang-format-check.py
#
# Checks whether all files with filetype .cpp or .h in the src and test directories are formatted correctly.
# To run this script, use the command "python clang-format-check.py". 
# On Windows, you must run this script using Git Bash or WSL. It will not work in Command Prompt or Powershell. 
#
# For clang-format to parse the formatting options specified in .clang-format correctly, you must be using
# version 12.0.0.
#

import os

os.system("find src -iname *.h -o -iname *.cpp | xargs clang-format-12 --Werror --dry-run")
os.system("find test -iname *.h -o -iname *.cpp | xargs clang-format-12 --Werror --dry-run")
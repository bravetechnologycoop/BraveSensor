#
# clang-format-check.py
#
# Checks whether all files with filetype .cpp or .h in the src and test directories are formatted correctly.
# To run this script, use the command "python clang-format-check.py". 
# On Windows, you must run this script using Git Bash or WSL. It will not work in Command Prompt or Powershell. 
#
# Important: For clang-format to parse the formatting options specified in .clang-format correctly, you must
# be using version 12.0.0.
#

import os

if os.system("find src -iname *.h -o -iname *.cpp | xargs clang-format-12 --Werror --dry-run") or os.system("find test -iname *.h -o -iname *.cpp | xargs clang-format-12 --Werror --dry-run"):
    os.system("echo \"Formatting error(s) found, run clang-format-all.py and try again!\n\"")
    os._exit(1)

os.system("echo \"No Formatting errors found!\n\"")  
os._exit(0)
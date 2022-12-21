#
# clang-format-check.py
#
# Checks whether all files with filetype .cpp, .ino or .h in the src and test directories are formatted correctly. 
# The syntax of this script has been modified to work in Travis CI. In order to run it locally, change all references to clang-format-12 to clang-format. 
# You must have clang-format version 12.0.0 installed in order to run this script. 
# To run this script, use the command "python clang-format-check.py". 
# On Windows, you must run this script using Git Bash or WSL. It will not work in Command Prompt or Powershell. 
#

import os

if os.system("find src -iname *.h -o -iname *.cpp | xargs clang-format-12 --Werror --dry-run") or os.system("find test -iname *.h -o -iname *.cpp | xargs clang-format-12 --Werror --dry-run"):
    os.system("echo \"Formatting error(s) found, run clang-format-all.py and try again!\"")
    os._exit(1)

os.system("echo \"No Formatting errors found!\"")  
os._exit(0)
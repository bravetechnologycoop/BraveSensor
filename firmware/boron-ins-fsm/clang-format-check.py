#
# clang-format-check.py
#
# Checks whether all files with filetype .cpp or .h in the src and test directories are formatted correctly.
# To run this script, use the command "python clang-format-check.py". 
# On Windows, you must run this script using Git Bash or WSL. It will not work in Command Prompt or Powershell. 
#

import os
os.system("clang-format -help")
os.system("find src -iname *.h -o -iname *.cpp | xargs clang-format -Werror -dry-run")
os.system("find test -iname *.h -o -iname *.cpp | xargs clang-format -Werror -dry-run")
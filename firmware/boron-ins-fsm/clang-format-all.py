#
# clang-format-all.py
#
# Formats all files with filetype .cpp or .h in the src and test directories using clang-format. 
# You must have clang-format version 12.0.0 installed in order to run this script. 
# To run this script, use the command "python clang-format-all.py". 
# On Windows, you must run this script using Git Bash or WSL. It will not work in Command Prompt or Powershell. 
#

import os

os.system("find src -iname *.h -o -iname *.cpp -o -iname *.ino | xargs clang-format -i")
os.system("find test -iname *.h -o -iname *.cpp -o -iname *.ino | xargs clang-format -i")
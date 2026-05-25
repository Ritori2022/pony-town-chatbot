#!/bin/bash

current_dir=$(pwd)

osascript -e 'tell application "Terminal"
    set window1 to do script "cd '"$current_dir"'; node gpt_login.js"
    set the custom title of window1 to "GPT Login"
end tell'

osascript -e 'tell application "Terminal"
    set window2 to do script "cd '"$current_dir"'; node pt_login.js"  
    set the custom title of window2 to "PT Login"
end tell'
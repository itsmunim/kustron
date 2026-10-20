Output docs/assets/demo.mp4

Set FontSize 14
Set LineHeight 1.35
Set Width 1600
Set Height 900
Set Shell "zsh"
Set Theme "Dracula"
Set Margin 0
Set Padding 24
Set BorderRadius 10
Set TypingSpeed 0.02
Set CursorBlink false
Set PlaybackSpeed 1.4

Type "cd demo/webapi" Enter
Sleep 1.5s

Type "kustron --version" Enter
Sleep 2s

Type "kustron doctor" Enter
Sleep 4s
Ctrl+L
Sleep 1s

Type "cat kustron-env.yaml" Enter
Sleep 3s
Ctrl+L
Sleep 1s

Type "kustron env up" Enter
Sleep 55s

Sleep 2s
Type "curl localhost:30000" Enter
Sleep 3s

Type "kustron env status" Enter
Sleep 4s

Type "kustron app logs webapi --tail 5" Enter
Sleep 4s
Ctrl+L
Sleep 1.5s

Type "./bump.sh" Enter
Sleep 2.5s
Type "curl localhost:30000" Enter
Sleep 3s

Type "kustron env up" Enter
Sleep 35s

Sleep 2s
Type "curl localhost:30000" Enter
Sleep 3s
Ctrl+L
Sleep 1s

Type "kustron env destroy --yes" Enter
Sleep 15s
Sleep 2s

# kustron demo — zero to fullstack environment
Output "/tmp/opencode/fullstack-take3.mp4"
Set Shell zsh
Set FontSize 14
Set Width 1600
Set Height 900
Set Padding 28
Set Theme {"background": "#0b0e14", "foreground": "#e6edf3", "cursor": "#4ec9b0"}
Set PlaybackSpeed 1.4

# ── intro ──
Type "cd demo/fullstack" Enter
Sleep 2
Type "./title.sh 0" Enter
Sleep 3
Ctrl+L
Type "kustron doctor" Enter
Sleep 6
Type "cat kustron-env.yaml" Enter
Sleep 8

# ── part 1: CRUD app on kivo ──
Type "./title.sh 1" Enter
Sleep 3
Ctrl+L
Set PlaybackSpeed 2.6
Type "kustron env up" Enter
Sleep 74
Set PlaybackSpeed 1.4
Type "./post-item.sh" Enter
Sleep 4
Type "curl -s localhost:30000/items" Enter
Sleep 3

# ── part 2: live rebuild via env watch (split terminal) ──
Type "./title.sh 2" Enter
Sleep 3
Ctrl+L
Type "tmux new -s demo" Enter
Sleep 2
Type "kustron env watch" Enter
Sleep 5
Ctrl+b
Type "%" Enter
Sleep 1
Type "curl -si localhost:30000/orders" Enter
Sleep 3
Type "./add-orders.sh" Enter
Sleep 6
Set PlaybackSpeed 2.2
Sleep 34
Set PlaybackSpeed 1.4
Type "curl -s localhost:30000/orders" Enter
Sleep 3

# ── part 3: rabbitmq chart + order stream ──
Type "./title.sh 3" Enter
Sleep 3
Ctrl+L
Type "./add-rabbit.sh" Enter
Sleep 6
Set PlaybackSpeed 2.6
Sleep 130
Set PlaybackSpeed 1.4
Type "./post-order.sh" Enter
Sleep 3
Type "kustron app logs webapi" Enter
Sleep 4
Type "curl -s localhost:30000/orders" Enter
Sleep 3

# ── part 4: deploy straight from GitHub ──
Type "./title.sh 4" Enter
Sleep 3
Ctrl+L
Type "./add-hello.sh" Enter
Sleep 6
Set PlaybackSpeed 2.6
Sleep 50
Set PlaybackSpeed 1.4
Type "curl -sL localhost:30001/v1/hello" Enter
Sleep 3

# ── outro ──
Type "./title.sh 5" Enter
Sleep 3
Set PlaybackSpeed 1.6
Type "kustron env destroy --yes" Enter
Sleep 9

# stop the watcher pane so the tmux session ends cleanly
Ctrl+b
Type "o"
Ctrl+C
Sleep 1
Type "exit" Enter
Sleep 1
Type "exit" Enter

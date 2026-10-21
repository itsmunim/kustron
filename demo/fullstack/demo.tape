# kustron demo — zero to fullstack environment
# NOTE: PlaybackSpeed must be top-level (vhs ignores mid-tape Set).
# Sleeps cover real work: up 64, rebuild 27, rabbit 112, hello 40, destroy 8: up ~60s, rebuild ~25s,
# rabbit ~115s, hello ~40s, destroy ~5s. Global speed 2.2 => ~2:50 video.
Output "/tmp/opencode/fullstack-take6.mp4"
Set Shell zsh
Set FontSize 14
Set Width 1600
Set Height 900
Set Padding 28
Set Theme {"background": "#0b0e14", "foreground": "#e6edf3", "cursor": "#4ec9b0"}
Set PlaybackSpeed 2.4

# ── intro ──
Type "cd demo/fullstack" Enter
Sleep 4
Type "./title.sh 0" Enter
Sleep 6
Ctrl+L
Type "kustron doctor" Enter
Sleep 7
Type "cat kustron-env.yaml" Enter
Sleep 12

# ── part 1: CRUD app on kivo ──
Type "./title.sh 1" Enter
Sleep 6
Ctrl+L
Type "kustron env up" Enter
Sleep 64
Type "./post-item.sh" Enter
Sleep 6
Type "curl -s localhost:30000/items" Enter
Sleep 5

# ── part 2: live rebuild via env watch (split terminal) ──
Type "./title.sh 2" Enter
Sleep 6
Ctrl+L
Type "tmux new -s demo" Enter
Sleep 3
Type "kustron env watch" Enter
Sleep 6
Ctrl+b
Type "%" Enter
Sleep 2
Type "curl -si localhost:30000/orders" Enter
Sleep 6
Type "./add-orders.sh" Enter
Sleep 27
Type "curl -s localhost:30000/orders" Enter
Sleep 6

# ── part 3: rabbitmq chart + order stream ──
Type "./title.sh 3" Enter
Sleep 6
Ctrl+L
Type "./add-rabbit.sh" Enter
Sleep 6
Sleep 112
Type "./post-order.sh" Enter
Sleep 5
Type "kustron app logs webapi" Enter
Sleep 7
Type "curl -s localhost:30000/orders" Enter
Sleep 6

# ── part 4: deploy straight from GitHub ──
Type "./title.sh 4" Enter
Sleep 6
Ctrl+L
Type "./add-hello.sh" Enter
Sleep 7
Sleep 40
Type "curl -sL localhost:30001/v1/hello" Enter
Sleep 6

# ── outro ──
Type "./title.sh 5" Enter
Sleep 6
Type "kustron env destroy --yes" Enter
Sleep 8

# stop watcher pane; end tmux cleanly (probes verified this chord)
Ctrl+b
Type "o"
Ctrl+C
Sleep 2
Type "exit" Enter
Type "exit" Enter
